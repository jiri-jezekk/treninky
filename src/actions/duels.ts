"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { hasPortalSession } from "@/lib/player-portal-session";
import { duelOutcome } from "@/lib/elo";
import {
  applyRatingChange,
  getActiveSeason,
  getEffectiveRating,
  revertRatingChanges,
} from "@/lib/rating";
import type { ActionResult } from "@/lib/action-result";
import { parseMeasured, parseScoreMode } from "@/lib/duration";

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

/** Hráč vyzve jiného hráče. Zakládá to i trenér za někoho. */
export async function createDuel(formData: FormData) {
  const payToken = String(formData.get("payToken") ?? "") || null;
  const actor = await resolveActor(payToken);
  if (!actor) return;

  const name = String(formData.get("name") ?? "").trim();
  const opponentId = String(formData.get("opponentId") ?? "");
  const challengerId =
    actor.kind === "player" ? actor.playerId : String(formData.get("challengerId") ?? "");

  if (!name || !opponentId || !challengerId) return;
  if (opponentId === challengerId) return;

  const [challenger, opponent] = await Promise.all([
    prisma.player.findFirst({
      where: { id: challengerId, userId: actor.userId, active: true },
      select: { id: true },
    }),
    prisma.player.findFirst({
      where: { id: opponentId, userId: actor.userId, active: true },
      select: { id: true },
    }),
  ]);
  if (!challenger || !opponent) return;

  const season = await getActiveSeason(actor.userId);
  if (!season) return;

  // Otevřený duel téhož jména se stejným soupeřem už být nemá — jinak
  // by se seznam zaplnil duplikáty, které nikdo nedohraje.
  const open = await prisma.duel.findFirst({
    where: {
      userId: actor.userId,
      seasonId: season.id,
      name,
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
      seasonId: season.id,
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      ...parseScoreMode(formData.get("mode")),
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
    select: {
      id: true,
      challengerId: true,
      opponentId: true,
      measure: true,
    },
  });
  if (!duel) return;

  const isParticipant =
    actor.kind === "coach" ||
    String(duel.challengerId) === actor.playerId ||
    String(duel.opponentId) === actor.playerId;
  if (!isParticipant) return;

  // Čte se podle druhu měření — na čas projde i „1:23,45“.
  const challengerValue = parseMeasured(
    formData.get("challengerValue"),
    duel.measure,
  );
  const opponentValue = parseMeasured(formData.get("opponentValue"), duel.measure);
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
    include: { season: true },
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
    getEffectiveRating(String(duel.challengerId), duel.season),
    getEffectiveRating(String(duel.opponentId), duel.season),
  ]);

  // Stejná funkce jako u náhledu „co se stane, když potvrdíš“ —
  // hráč nesmí vidět jedno číslo a dostat jiné.
  const { challengerDelta: deltaA, opponentDelta: deltaB } = duelOutcome({
    ratingChallenger,
    ratingOpponent,
    challengerValue: duel.challengerValue,
    opponentValue: duel.opponentValue,
    higherWins: duel.higherWins,
    weightPercent: duel.weightPercent,
  });

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

    const label = `Duel — ${duel.name}`;
    await applyRatingChange(tx, {
      userId: actor.userId,
      seasonId: duel.seasonId,
      playerId: String(duel.challengerId),
      delta: deltaA,
      source: "DUEL",
      label,
      duelId,
    });
    await applyRatingChange(tx, {
      userId: actor.userId,
      seasonId: duel.seasonId,
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
 * Vrátí potvrzený duel zpátky k opravě.
 *
 * Rating se oběma odečte a duel se vrátí do stavu „domluveno“, takže
 * jde zapsat správný výsledek. Bez tohohle byl překlep ve skóre
 * nevratný — jediná cesta zpět vedla přes ruční úpravu ratingu, což
 * v historii vypadá, jako by trenér někomu nadržoval.
 *
 * Smí to jen trenér: kdyby si duel mohl otevřít kterýkoli účastník,
 * dal by se prohraný výsledek rušit tak dlouho, dokud nevyjde.
 */
export async function reopenDuel(duelId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const duel = await prisma.duel.findFirst({
      where: { id: duelId, userId, status: "CONFIRMED" },
      select: { id: true },
    });
    if (!duel) return { ok: false, error: "Duel není potvrzený." };

    let vraceno = 0;
    await prisma.$transaction(async (tx) => {
      vraceno = await revertRatingChanges(tx, { duelId });
      await tx.duel.updateMany({
        where: { id: duelId, userId },
        data: {
          status: "ACCEPTED",
          confirmedAt: null,
          challengerDelta: null,
          opponentDelta: null,
        },
      });
    });

    revalidateRating();
    return {
      ok: true,
      message: `Vráceno zpět, rating odebrán ${vraceno} hráčům. Zapiš výsledek znovu.`,
    };
  } catch (e) {
    console.error("[reopenDuel]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Vrácení se nepovedlo.",
    };
  }
}

/**
 * Smaže duel. Potvrzený se nejdřív musí vrátit — rating je rozdaný
 * a smazáním by v žebříčku zůstala díra, kterou nejde dohledat.
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

  const [player, season] = await Promise.all([
    prisma.player.findFirst({
      where: { id: playerId, userId },
      select: { id: true },
    }),
    getActiveSeason(userId),
  ]);
  if (!player || !season) return;

  await prisma.$transaction(async (tx) => {
    await applyRatingChange(tx, {
      userId,
      seasonId: season.id,
      playerId,
      delta: Math.round(delta),
      source: "COACH",
      label: label || "Úprava trenérem",
    });
  });
  revalidateRating();
}
