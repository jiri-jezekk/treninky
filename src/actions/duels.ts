"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { hasPortalSession } from "@/lib/player-portal-session";
import { duelDeltas, scoreFromValues } from "@/lib/elo";
import { applyRatingChange, getEffectiveRating } from "@/lib/rating";

function revalidateRating(payToken?: string) {
  revalidatePath("/rating");
  revalidatePath("/prehled");
  if (payToken) revalidatePath(`/p/${payToken}`);
}

/**
 * Kdo tuhle akci vyvolal.
 *
 * Duely obsluhují dvě různé strany: hráč ze svého odkazu a trenér
 * z aplikace. Trenér smí všechno, hráč jen to, co se týká jeho.
 */
type Actor =
  | { kind: "coach"; userId: string }
  | { kind: "player"; userId: string; playerId: string; payToken: string };

async function resolveActor(payToken: string | null): Promise<Actor | null> {
  if (payToken) {
    if (!(await hasPortalSession(payToken))) return null;
    const player = await prisma.player.findUnique({
      where: { payToken },
      select: { id: true, userId: true },
    });
    if (!player) return null;
    return {
      kind: "player",
      userId: String(player.userId),
      playerId: String(player.id),
      payToken,
    };
  }
  return { kind: "coach", userId: await requireUserId() };
}

function parseValue(raw: unknown): number | null {
  const value = String(raw ?? "").trim().replace(",", ".");
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Hráč vyzve jiného hráče. Zakládá to i trenér za někoho. */
export async function createDuel(formData: FormData) {
  const payToken = String(formData.get("payToken") ?? "") || null;
  const actor = await resolveActor(payToken);
  if (!actor) return;

  const disciplineId = String(formData.get("disciplineId") ?? "");
  const opponentId = String(formData.get("opponentId") ?? "");
  const challengerId =
    actor.kind === "player" ? actor.playerId : String(formData.get("challengerId") ?? "");

  if (!disciplineId || !opponentId || !challengerId) return;
  if (opponentId === challengerId) return;

  const [discipline, challenger, opponent] = await Promise.all([
    prisma.discipline.findFirst({
      where: { id: disciplineId, userId: actor.userId, archived: false },
      select: { id: true },
    }),
    prisma.player.findFirst({
      where: { id: challengerId, userId: actor.userId, active: true },
      select: { id: true },
    }),
    prisma.player.findFirst({
      where: { id: opponentId, userId: actor.userId, active: true },
      select: { id: true },
    }),
  ]);
  if (!discipline || !challenger || !opponent) return;

  // Otevřená výzva na totéž se stejným soupeřem už být nemá — jinak
  // by se seznam zaplnil duplikáty, které nikdo nedohraje.
  const open = await prisma.duel.findFirst({
    where: {
      userId: actor.userId,
      disciplineId,
      status: { in: ["PENDING", "ACCEPTED", "REPORTED"] },
      OR: [
        { challengerId, opponentId },
        { challengerId: opponentId, opponentId: challengerId },
      ],
    },
    select: { id: true },
  });
  if (open) return;

  await prisma.duel.create({
    data: {
      userId: actor.userId,
      disciplineId,
      challengerId,
      opponentId,
      note: String(formData.get("note") ?? "").trim() || null,
      // Trenér domlouvá duel za oba, takže se nemá kdo hlásit.
      status: actor.kind === "coach" ? "ACCEPTED" : "PENDING",
    },
  });
  revalidateRating(payToken ?? undefined);
}

/** Vyzvaný přijme nebo odmítne. */
export async function respondToDuel(duelId: string, accept: boolean, payToken?: string) {
  const actor = await resolveActor(payToken ?? null);
  if (!actor) return;

  const duel = await prisma.duel.findFirst({
    where: { id: duelId, userId: actor.userId, status: "PENDING" },
    select: { id: true, opponentId: true },
  });
  if (!duel) return;
  // Přijmout smí jen vyzvaný, ne ten, kdo vyzval.
  if (actor.kind === "player" && String(duel.opponentId) !== actor.playerId) return;

  await prisma.duel.update({
    where: { id: duelId },
    data: { status: accept ? "ACCEPTED" : "DECLINED" },
  });
  revalidateRating(payToken);
}

/** Zápis výsledku. Rating se zatím nehýbe — čeká se na potvrzení druhým. */
export async function reportDuelResult(duelId: string, formData: FormData) {
  const payToken = String(formData.get("payToken") ?? "") || null;
  const actor = await resolveActor(payToken);
  if (!actor) return;

  const duel = await prisma.duel.findFirst({
    where: {
      id: duelId,
      userId: actor.userId,
      status: { in: ["ACCEPTED", "PENDING", "REPORTED"] },
    },
    select: { id: true, challengerId: true, opponentId: true },
  });
  if (!duel) return;

  const isParticipant =
    actor.kind === "coach" ||
    String(duel.challengerId) === actor.playerId ||
    String(duel.opponentId) === actor.playerId;
  if (!isParticipant) return;

  const challengerValue = parseValue(formData.get("challengerValue"));
  const opponentValue = parseValue(formData.get("opponentValue"));
  if (challengerValue == null || opponentValue == null) return;

  await prisma.duel.update({
    where: { id: duelId },
    data: {
      status: "REPORTED",
      challengerValue,
      opponentValue,
      reportedById: actor.kind === "player" ? actor.playerId : null,
      note: String(formData.get("note") ?? "").trim() || null,
    },
  });
  revalidateRating(payToken ?? undefined);
}

/**
 * Potvrzení výsledku — teprve tady se propíše rating.
 *
 * Potvrdit nesmí ten, kdo výsledek zapsal. Trenér může vždycky,
 * kdyby soupeř nereagoval.
 */
export async function confirmDuel(duelId: string, payToken?: string) {
  const actor = await resolveActor(payToken ?? null);
  if (!actor) return;

  const duel = await prisma.duel.findFirst({
    where: { id: duelId, userId: actor.userId, status: "REPORTED" },
    include: { discipline: { select: { higherWins: true, name: true } } },
  });
  if (!duel) return;
  if (duel.challengerValue == null || duel.opponentValue == null) return;

  if (actor.kind === "player") {
    const isParticipant =
      String(duel.challengerId) === actor.playerId ||
      String(duel.opponentId) === actor.playerId;
    if (!isParticipant) return;
    // Kdo výsledek zapsal, ten si ho nemůže sám odklepnout.
    if (duel.reportedById && String(duel.reportedById) === actor.playerId) return;
  }

  const [ratingChallenger, ratingOpponent] = await Promise.all([
    getEffectiveRating(String(duel.challengerId)),
    getEffectiveRating(String(duel.opponentId)),
  ]);

  const score = scoreFromValues(
    duel.challengerValue,
    duel.opponentValue,
    duel.discipline.higherWins,
  );
  const { deltaA, deltaB } = duelDeltas(ratingChallenger, ratingOpponent, score);

  await prisma.$transaction(async (tx) => {
    // Podmínka na stav uvnitř transakce — dvojí potvrzení by jinak
    // propsalo rating dvakrát.
    const claimed = await tx.duel.updateMany({
      where: { id: duelId, status: "REPORTED" },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        challengerDelta: deltaA,
        opponentDelta: deltaB,
      },
    });
    if (claimed.count === 0) return;

    const label = `Duel — ${duel.discipline.name}`;
    await applyRatingChange(tx, {
      userId: actor.userId,
      playerId: String(duel.challengerId),
      delta: deltaA,
      source: "DUEL",
      label,
      duelId,
    });
    await applyRatingChange(tx, {
      userId: actor.userId,
      playerId: String(duel.opponentId),
      delta: deltaB,
      source: "DUEL",
      label,
      duelId,
    });
  });

  revalidateRating(payToken);
}

/**
 * Smaže duel. Potvrzený se nemaže — rating už je rozdaný a smazáním
 * by v žebříčku zůstala díra, kterou nejde dohledat.
 */
export async function deleteDuel(duelId: string) {
  const userId = await requireUserId();
  await prisma.duel.deleteMany({
    where: { id: duelId, userId, status: { not: "CONFIRMED" } },
  });
  revalidateRating();
}

/** Ruční úprava ratingu trenérem — za nasazení, pokrok, pomoc ostatním. */
export async function awardCoachRating(formData: FormData) {
  const userId = await requireUserId();
  const playerId = String(formData.get("playerId") ?? "");
  const delta = Number(String(formData.get("delta") ?? "").trim());
  const label = String(formData.get("label") ?? "").trim();

  if (!playerId || !Number.isFinite(delta) || delta === 0) return;
  if (Math.abs(delta) > 200) return;

  const player = await prisma.player.findFirst({
    where: { id: playerId, userId },
    select: { id: true },
  });
  if (!player) return;

  await prisma.$transaction(async (tx) => {
    await applyRatingChange(tx, {
      userId,
      playerId,
      delta: Math.round(delta),
      source: "COACH",
      label: label || "Úprava trenérem",
    });
  });
  revalidateRating();
}
