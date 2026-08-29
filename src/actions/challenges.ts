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
  getEffectiveRatings,
  revertRatingChanges,
} from "@/lib/rating";
import { STARTING_RATING } from "@/lib/elo";
import { parseMeasured, parseScoreMode } from "@/lib/duration";
import { MAX_ATTEMPTS_PER_CHALLENGE } from "@/lib/rating-limits";
import { standings, type Attempt } from "@/lib/challenge-attempts";
import type { ActionResult } from "@/lib/action-result";

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
      ...parseScoreMode(formData.get("mode")),
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
    select: { id: true, closedAt: true, measure: true },
  });
  // Do uzavřené výzvy se dopisovat nedá — pořadí i rating už platí.
  if (!challenge || challenge.closedAt) return;

  // Na čas projde i „38:24“ — dřív se muselo psát 2304.
  const value = parseMeasured(formData.get("value"), challenge.measure);
  if (value == null) return;

  const note = String(formData.get("note") ?? "").trim() || null;

  // Strop na počet pokusů. Ne kvůli ratingu — do pořadí se stejně
  // počítá jen nejlepší — ale aby se seznam nezaplnil stovkou řádků
  // a historie zůstala čitelná.
  const existing = await prisma.challengeEntry.count({
    where: { challengeId, playerId },
  });
  if (existing >= MAX_ATTEMPTS_PER_CHALLENGE) return;

  // Create, ne upsert: každý zápis je samostatný pokus. Dřív tu byl
  // upsert a druhý pokus ten první přepsal, takže nebylo vidět,
  // jak se kdo za měsíc posunul.
  await prisma.challengeEntry.create({
    data: { challengeId, playerId, value, note },
  });
  revalidateChallenges(payToken ?? undefined);
}

/**
 * Oprava pokusu, když se někdo překlepl.
 *
 * Hráč smí opravit jen svůj, trenér kterýkoli. Do uzavřené výzvy se
 * nesahá — pořadí i rating už platí.
 */
export async function updateChallengeEntry(entryId: string, formData: FormData) {
  const payToken = String(formData.get("payToken") ?? "") || null;
  // Druh měření se bere z výzvy, ne z formuláře — hráč ho neurčuje.
  const entry = await prisma.challengeEntry.findUnique({
    where: { id: entryId },
    select: { challenge: { select: { measure: true } } },
  });
  if (!entry) return;
  const value = parseMeasured(formData.get("value"), entry.challenge.measure);
  if (value == null) return;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (payToken) {
    if (!(await hasPortalSession(payToken))) return;
    const player = await prisma.player.findUnique({
      where: { payToken },
      select: { id: true },
    });
    if (!player) return;
    await prisma.challengeEntry.updateMany({
      where: {
        id: entryId,
        playerId: String(player.id),
        challenge: { closedAt: null },
      },
      data: { value, note },
    });
    revalidateChallenges(payToken);
    return;
  }

  const userId = await requireUserId();
  await prisma.challengeEntry.updateMany({
    where: { id: entryId, challenge: { userId, closedAt: null } },
    data: { value, note },
  });
  revalidateChallenges();
}

/** Smaže pokus. Hráč jen svůj, trenér kterýkoli. */
export async function deleteChallengeEntry(entryId: string, payToken?: string) {
  if (payToken) {
    if (!(await hasPortalSession(payToken))) return;
    const player = await prisma.player.findUnique({
      where: { payToken },
      select: { id: true },
    });
    if (!player) return;
    await prisma.challengeEntry.deleteMany({
      where: {
        id: entryId,
        playerId: String(player.id),
        challenge: { closedAt: null },
      },
    });
    revalidateChallenges(payToken);
    return;
  }

  const userId = await requireUserId();
  await prisma.challengeEntry.deleteMany({
    where: { id: entryId, challenge: { userId, closedAt: null } },
  });
  revalidateChallenges();
}

/**
 * Uzavře výzvu a rozdá rating podle pořadí.
 *
 * Do pořadí jde nejlepší pokus každého hráče, ne poslední — jinak by
 * se nikdo neodvážil zkusit to znovu, protože horší pokus by mu srazil
 * umístění. Používá se stejná funkce jako pro výpis, aby žebříček
 * výzvy a rozdaný rating nemohly říct každý něco jiného.
 *
 * Jde to jen jednou — podruhé by se rating rozdal znovu. Hlídá to
 * podmínka `closedAt: null` uvnitř transakce.
 *
 * Nevyhazuje; co se nepovede, vrátí textem.
 */
export async function closeChallenge(challengeId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();

    const challenge = await prisma.challenge.findFirst({
      where: { id: challengeId, userId, closedAt: null },
      include: {
        season: true,
        entries: { include: { player: { select: { id: true, name: true } } } },
      },
    });
    if (!challenge) {
      return { ok: false, error: "Výzva nenalezena, nebo je už vyhodnocená." };
    }

    const poradi = standings(
      challenge.entries.map(
        (e): Attempt => ({
          id: String(e.id),
          playerId: String(e.playerId),
          playerName: e.player.name,
          value: e.value,
          note: e.note,
          createdAt: e.createdAt,
        }),
      ),
      challenge.higherWins,
    );
    if (poradi.length < 2) {
      return {
        ok: false,
        error: "Výzvu má zapsanou míň než dva hráči — není co porovnávat.",
      };
    }

    // Docházková část se do ratingu započítá i tady, aby výpočet
    // vycházel ze stejného čísla, jaké hráči vidí v žebříčku.
    const ratings = await getEffectiveRatings(
      poradi.map((r) => r.playerId),
      challenge.season,
    );

    const deltas = challengeDeltas(
      poradi.map((r) => ({
        playerId: r.playerId,
        rating: ratings.get(r.playerId) ?? STARTING_RATING,
        value: r.best,
      })),
      challenge.higherWins,
      { weightPercent: challenge.weightPercent },
    );

    await prisma.$transaction(
      async (tx) => {
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
      },
      { timeout: 20000, maxWait: 10000 },
    );

    revalidateChallenges();
    return { ok: true, message: "Výzva vyhodnocena, rating rozdaný." };
  } catch (e) {
    console.error("[closeChallenge]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Vyhodnocení se nepovedlo.",
    };
  }
}

/** Vrátí vyhodnocení výzvy — rating se odečte a dá se opravit. */
export async function reopenChallenge(challengeId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const challenge = await prisma.challenge.findFirst({
      where: { id: challengeId, userId, closedAt: { not: null } },
      select: { id: true },
    });
    if (!challenge) return { ok: false, error: "Výzva není vyhodnocená." };

    let vraceno = 0;
    await prisma.$transaction(
      async (tx) => {
        vraceno = await revertRatingChanges(tx, { challengeId });
        await tx.challenge.updateMany({
          where: { id: challengeId, userId },
          data: { closedAt: null },
        });
      },
      { timeout: 20000, maxWait: 10000 },
    );

    revalidateChallenges();
    return { ok: true, message: `Vráceno zpět, rating odebrán ${vraceno} hráčům.` };
  } catch (e) {
    console.error("[reopenChallenge]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Vrácení se nepovedlo.",
    };
  }
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
