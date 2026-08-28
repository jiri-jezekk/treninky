"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { hasPortalSession } from "@/lib/player-portal-session";
import { challengeDeltas } from "@/lib/elo";
import { parseDateInput } from "@/lib/prepaid";
import { applyRatingChange, RATING_PER_ATTENDANCE } from "@/lib/rating";
import { STARTING_RATING } from "@/lib/elo";

function revalidateChallenges(payToken?: string) {
  revalidatePath("/rating");
  revalidatePath("/prehled");
  if (payToken) revalidatePath(`/p/${payToken}`);
}

function parseValue(raw: unknown): number | null {
  const value = String(raw ?? "").trim().replace(",", ".");
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function createChallenge(formData: FormData) {
  const userId = await requireUserId();

  const name = String(formData.get("name") ?? "").trim();
  const startsOn = parseDateInput(formData.get("startsOn"));
  const endsOn = parseDateInput(formData.get("endsOn"));
  if (!name || !startsOn || !endsOn || endsOn < startsOn) return;

  const disciplineIdRaw = String(formData.get("disciplineId") ?? "");
  const disciplineId =
    disciplineIdRaw === "" || disciplineIdRaw === "vlastni" ? null : disciplineIdRaw;

  const discipline = disciplineId
    ? await prisma.discipline.findFirst({
        where: { id: disciplineId, userId },
        select: { id: true, unit: true, higherWins: true },
      })
    : null;
  if (disciplineId && !discipline) return;

  await prisma.challenge.create({
    data: {
      userId,
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      disciplineId: discipline?.id ?? null,
      unit: String(formData.get("unit") ?? "").trim() || discipline?.unit || null,
      higherWins: discipline
        ? discipline.higherWins
        : formData.get("higherWins") !== "off",
      startsOn,
      endsOn,
    },
  });
  revalidateChallenges();
}

/** Zápis výsledku do výzvy. Hráč zapisuje jen sám za sebe. */
export async function submitChallengeEntry(challengeId: string, formData: FormData) {
  const payTokenRaw = String(formData.get("payToken") ?? "");
  const payToken = payTokenRaw || null;

  let userId: string;
  let playerId: string;

  if (payToken) {
    if (!(await hasPortalSession(payToken))) return;
    const player = await prisma.player.findUnique({
      where: { payToken },
      select: { id: true, userId: true },
    });
    if (!player) return;
    userId = String(player.userId);
    playerId = String(player.id);
  } else {
    userId = await requireUserId();
    playerId = String(formData.get("playerId") ?? "");
    if (!playerId) return;
    const owned = await prisma.player.findFirst({
      where: { id: playerId, userId },
      select: { id: true },
    });
    if (!owned) return;
  }

  const challenge = await prisma.challenge.findFirst({
    where: { id: challengeId, userId },
    select: { id: true, closedAt: true },
  });
  // Do uzavřené výzvy se dopisovat nedá — pořadí i rating už platí.
  if (!challenge || challenge.closedAt) return;

  const value = parseValue(formData.get("value"));
  if (value == null) return;

  const note = String(formData.get("note") ?? "").trim() || null;

  await prisma.challengeEntry.upsert({
    where: { challengeId_playerId: { challengeId, playerId } },
    create: { challengeId, playerId, value, note },
    update: { value, note },
  });
  revalidateChallenges(payToken ?? undefined);
}

export async function deleteChallengeEntry(entryId: string) {
  const userId = await requireUserId();
  const entry = await prisma.challengeEntry.findFirst({
    where: { id: entryId, challenge: { userId, closedAt: null } },
    select: { id: true },
  });
  if (!entry) return;

  await prisma.challengeEntry.delete({ where: { id: entryId } });
  revalidateChallenges();
}

/**
 * Uzavře výzvu a rozdá rating podle pořadí.
 *
 * Jde to jen jednou — podruhé by se rating rozdal znovu. Hlídá to
 * podmínka `closedAt: null` uvnitř transakce.
 */
export async function closeChallenge(challengeId: string) {
  const userId = await requireUserId();

  const challenge = await prisma.challenge.findFirst({
    where: { id: challengeId, userId, closedAt: null },
    include: {
      entries: {
        include: {
          player: { select: { id: true, name: true, ratingPoints: true } },
        },
      },
    },
  });
  if (!challenge) return;
  if (challenge.entries.length < 2) return;

  // Docházková část se do ratingu započítá i tady, aby výpočet
  // vycházel ze stejného čísla, jaké hráči vidí v žebříčku.
  const counts = await prisma.attendance.groupBy({
    by: ["playerId"],
    where: {
      status: "PRESENT",
      training: { userId, cancelled: false },
      playerId: { in: challenge.entries.map((e) => e.playerId) },
    },
    _count: { playerId: true },
  });
  const attendanceById = new Map<string, number>(
    counts.map((c) => [String(c.playerId), Number(c._count.playerId ?? 0)]),
  );

  const deltas = challengeDeltas(
    challenge.entries.map((e) => ({
      playerId: String(e.playerId),
      rating:
        (e.player.ratingPoints ?? STARTING_RATING) +
        (attendanceById.get(String(e.playerId)) ?? 0) * RATING_PER_ATTENDANCE,
      value: e.value,
    })),
    challenge.higherWins,
  );

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.challenge.updateMany({
      where: { id: challengeId, closedAt: null },
      data: { closedAt: new Date() },
    });
    if (claimed.count === 0) return;

    for (const d of deltas) {
      if (d.delta === 0) continue;
      await applyRatingChange(tx, {
        userId,
        playerId: d.playerId,
        delta: d.delta,
        source: "CHALLENGE",
        label: `${challenge.name} — ${d.rank}. místo`,
        challengeId,
      });
    }
  });

  revalidateChallenges();
}

/**
 * Smaže výzvu. Uzavřená se nemaže — rating už je rozdaný a bez výzvy
 * by v historii zůstal záznam, ke kterému nevede cesta.
 */
export async function deleteChallenge(challengeId: string) {
  const userId = await requireUserId();
  await prisma.challenge.deleteMany({
    where: { id: challengeId, userId, closedAt: null },
  });
  revalidateChallenges();
}

/* --------------------------------------------------------- disciplíny */

export async function createDiscipline(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const clash = await prisma.discipline.findFirst({
    where: { userId, name },
    select: { id: true },
  });
  if (clash) return;

  await prisma.discipline.create({
    data: {
      userId,
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      unit: String(formData.get("unit") ?? "").trim() || null,
      higherWins: formData.get("higherWins") !== "off",
    },
  });
  revalidateChallenges();
}

export async function updateDiscipline(disciplineId: string, formData: FormData) {
  const userId = await requireUserId();
  const owned = await prisma.discipline.findFirst({
    where: { id: disciplineId, userId },
    select: { id: true },
  });
  if (!owned) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const clash = await prisma.discipline.findFirst({
    where: { userId, name, id: { not: disciplineId } },
    select: { id: true },
  });
  if (clash) return;

  await prisma.discipline.update({
    where: { id: disciplineId },
    data: {
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      unit: String(formData.get("unit") ?? "").trim() || null,
      higherWins: formData.get("higherWins") !== "off",
      archived: formData.get("archived") === "on",
    },
  });
  revalidateChallenges();
}
