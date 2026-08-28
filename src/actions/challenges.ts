"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { hasPortalSession } from "@/lib/player-portal-session";
import { challengeDeltas } from "@/lib/elo";
import { parseDateInput } from "@/lib/prepaid";
import {
  applyRatingChange,
  getActiveSeason,
  RATING_PER_ATTENDANCE,
} from "@/lib/rating";
import { STARTING_RATING } from "@/lib/elo";

function revalidateChallenges(payToken?: string) {
  revalidatePath("/rating");
  revalidatePath("/prehled");
  if (payToken) revalidatePath(`/p/${payToken}`);
}

/** Váha v procentech. Mimo rozumný rozsah se vrátí výchozí hodnota. */
function parseWeight(raw: unknown, fallback: number): number {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n < 10 || n > 500) return fallback;
  return Math.round(n);
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

  const season = await getActiveSeason(userId);
  if (!season) return;

  await prisma.challenge.create({
    data: {
      userId,
      seasonId: season.id,
      weightPercent: parseWeight(formData.get("weightPercent"), 200),
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      unit: String(formData.get("unit") ?? "").trim() || null,
      higherWins: formData.get("higherWins") !== "off",
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
      season: true,
      entries: { include: { player: { select: { id: true, name: true } } } },
    },
  });
  if (!challenge) return;
  if (challenge.entries.length < 2) return;

  // Docházková část se do ratingu započítá i tady, aby výpočet
  // vycházel ze stejného čísla, jaké hráči vidí v žebříčku.
  const from = new Date(challenge.season.startsOn);
  const to = new Date(challenge.season.endsOn);
  to.setUTCHours(23, 59, 59, 999);

  const playerIds = challenge.entries.map((e) => e.playerId);
  const [counts, ratings] = await Promise.all([
    prisma.attendance.groupBy({
      by: ["playerId"],
      where: {
        status: "PRESENT",
        training: { userId, cancelled: false, startsAt: { gte: from, lte: to } },
        playerId: { in: playerIds },
      },
      _count: { playerId: true },
    }),
    prisma.playerRating.findMany({
      where: { seasonId: challenge.seasonId, playerId: { in: playerIds } },
      select: { playerId: true, points: true },
    }),
  ]);

  const attendanceById = new Map<string, number>(
    counts.map((c) => [String(c.playerId), Number(c._count.playerId ?? 0)]),
  );
  const pointsById = new Map<string, number>(
    ratings.map((r) => [String(r.playerId), r.points]),
  );

  const deltas = challengeDeltas(
    challenge.entries.map((e) => ({
      playerId: String(e.playerId),
      rating:
        (pointsById.get(String(e.playerId)) ?? STARTING_RATING) +
        (attendanceById.get(String(e.playerId)) ?? 0) * RATING_PER_ATTENDANCE,
      value: e.value,
    })),
    challenge.higherWins,
    { weightPercent: challenge.weightPercent },
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
        seasonId: challenge.seasonId,
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
