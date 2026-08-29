"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { averageRating, teamDeltas } from "@/lib/elo";
import { parseDateInput } from "@/lib/prepaid";
import { parseDecimal } from "@/lib/form-values";
import type { ActionResult, MatchPreviewTeam } from "@/lib/action-result";
import {
  applyRatingChange,
  getActiveSeason,
  getEffectiveRatings,
  revertRatingChanges,
} from "@/lib/rating";

function revalidateMatches() {
  revalidatePath("/rating");
  revalidatePath("/prehled");
}

function parseWeight(raw: unknown, fallback: number): number {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n < 10 || n > 500) return fallback;
  return Math.round(n);
}

function parseScore(raw: unknown): number {
  return parseDecimal(raw) ?? 0;
}

/**
 * Založí zápas i s týmy.
 *
 * Formulář posílá `teamName` a `teamPlayers` opakovaně — pořadí polí
 * je pořadí týmů. Hráč smí být jen v jednom týmu; kdyby ho někdo
 * zaškrtl dvakrát, počítal by se jeho rating dvakrát.
 */
export async function createMatch(formData: FormData) {
  const userId = await requireUserId();
  const season = await getActiveSeason(userId);
  if (!season) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const playedOn = parseDateInput(formData.get("playedOn")) ?? new Date();

  const names = formData.getAll("teamName").map((v) => String(v).trim());
  const scores = formData.getAll("teamScore");
  // Hráči jednoho týmu chodí jako `teamPlayers0`, `teamPlayers1`, …
  const teams = names
    .map((teamName, i) => ({
      name: teamName || `Tým ${i + 1}`,
      score: parseScore(scores[i]),
      playerIds: formData.getAll(`teamPlayers${i}`).map(String).filter(Boolean),
    }))
    .filter((t) => t.playerIds.length > 0);

  if (teams.length < 2) return;

  const owned = await prisma.player.findMany({
    where: {
      id: { in: teams.flatMap((t) => t.playerIds) },
      userId,
    },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((p) => String(p.id)));

  const used = new Set<string>();
  const clean = teams
    .map((t) => ({
      ...t,
      playerIds: t.playerIds.filter((id) => {
        if (!ownedIds.has(id) || used.has(id)) return false;
        used.add(id);
        return true;
      }),
    }))
    .filter((t) => t.playerIds.length > 0);

  if (clean.length < 2) return;

  const trainingIdRaw = String(formData.get("trainingId") ?? "").trim();
  const trainingId =
    trainingIdRaw === "" || trainingIdRaw === "zadny" ? null : trainingIdRaw;

  await prisma.match.create({
    data: {
      userId,
      seasonId: season.id,
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      weightPercent: parseWeight(formData.get("weightPercent"), 150),
      playedOn,
      trainingId,
      teams: {
        create: clean.map((t, i) => ({
          name: t.name,
          sortOrder: i,
          score: t.score,
          members: { create: t.playerIds.map((playerId) => ({ playerId })) },
        })),
      },
    },
  });
  revalidateMatches();
}

/** Úprava skóre před uzavřením. Po uzavření se skóre nemění. */
export async function updateMatchScores(matchId: string, formData: FormData) {
  const userId = await requireUserId();
  const match = await prisma.match.findFirst({
    where: { id: matchId, userId, closedAt: null },
    include: { teams: { orderBy: { sortOrder: "asc" } } },
  });
  if (!match) return;

  for (const team of match.teams) {
    const raw = formData.get(`score-${team.id}`);
    if (raw == null) continue;
    await prisma.matchTeam.update({
      where: { id: team.id },
      data: { score: parseScore(raw) },
    });
  }
  revalidateMatches();
}

/**
 * Co udělá vyhodnocení s ratingem, ještě než se na něj klikne.
 *
 * Bez tohohle bylo tlačítko „Vyhodnotit“ skok do tmy: rating se rozdal
 * a teprve pak bylo vidět kolik komu. Počítá se toutéž funkcí jako
 * samotné uzavření, aby náhled a skutečnost nemohly říct každý něco
 * jiného.
 */
export async function previewMatch(
  matchId: string,
): Promise<MatchPreviewTeam[] | null> {
  const userId = await requireUserId();
  const match = await prisma.match.findFirst({
    where: { id: matchId, userId },
    include: {
      season: true,
      teams: {
        orderBy: { sortOrder: "asc" },
        include: { members: { include: { player: { select: { name: true } } } } },
      },
    },
  });
  if (!match || match.teams.length < 2) return null;

  const ratings = await getEffectiveRatings(
    match.teams.flatMap((t) => t.members.map((m) => String(m.playerId))),
    match.season,
  );

  const deltas = teamDeltas(
    match.teams.map((t) => ({
      teamId: String(t.id),
      rating: averageRating(
        t.members.map((m) => ratings.get(String(m.playerId)) ?? 1000),
      ),
      score: t.score,
    })),
    match.weightPercent,
  );
  const byTeam = new Map(deltas.map((d) => [d.teamId, d]));

  return match.teams.map((t) => {
    const d = byTeam.get(String(t.id));
    return {
      teamId: String(t.id),
      teamName: t.name,
      rank: d?.rank ?? 1,
      rating: averageRating(
        t.members.map((m) => ratings.get(String(m.playerId)) ?? 1000),
      ),
      delta: d?.delta ?? 0,
      members: t.members.map((m) => ({
        playerId: String(m.playerId),
        playerName: m.player.name,
        rating: ratings.get(String(m.playerId)) ?? 1000,
      })),
    };
  });
}

/**
 * Uzavře zápas a rozdá rating.
 *
 * Tým vystupuje jako jeden hráč s průměrným ratingem svých členů;
 * spočítaná změna pak platí pro každého z nich. Jde to jen jednou —
 * hlídá to podmínka na `closedAt` uvnitř transakce.
 *
 * Nevyhazuje. Co se nepovede, vrátí textem — viz ActionResult.
 */
export async function closeMatch(matchId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();

    const match = await prisma.match.findFirst({
      where: { id: matchId, userId, closedAt: null },
      include: {
        season: true,
        teams: {
          orderBy: { sortOrder: "asc" },
          include: { members: true },
        },
      },
    });
    if (!match) {
      return { ok: false, error: "Zápas nenalezen, nebo je už vyhodnocený." };
    }
    if (match.teams.length < 2) {
      return { ok: false, error: "Zápas potřebuje aspoň dva týmy." };
    }

    // Tým bez hráčů by šel do průměru jako začátečnický a bral by
    // ostatním rating za nikoho.
    const empty = match.teams.filter((t) => t.members.length === 0);
    if (empty.length > 0) {
      return {
        ok: false,
        error: `Tým bez hráčů: ${empty.map((t) => t.name).join(", ")}. Doplň hráče, nebo zápas smaž.`,
      };
    }

    // Remíza je legitimní výsledek, samé nuly ale znamenají, že skóre
    // nikdo nezapsal — a vyhodnocovat prázdný zápas nemá smysl.
    if (match.teams.every((t) => t.score === 0)) {
      return {
        ok: false,
        error: "Skóre je všude nula — nejdřív zapiš výsledek a ulož ho.",
      };
    }

    // Jedním dotazem, ne jedním na hráče: v transakci pak zbývá jen
    // zápis a nehrozí, že vyprší, než se vůbec začne psát.
    const ratings = await getEffectiveRatings(
      match.teams.flatMap((t) => t.members.map((m) => String(m.playerId))),
      match.season,
    );

    const deltas = teamDeltas(
      match.teams.map((t) => ({
        teamId: String(t.id),
        rating: averageRating(
          t.members.map((m) => ratings.get(String(m.playerId)) ?? 1000),
        ),
        score: t.score,
      })),
      match.weightPercent,
    );
    const deltaByTeam = new Map(deltas.map((d) => [d.teamId, d]));

    await prisma.$transaction(
      async (tx) => {
        const claimed = await tx.match.updateMany({
          where: { id: matchId, closedAt: null },
          data: { closedAt: new Date() },
        });
        if (claimed.count === 0) return;

        for (const team of match.teams) {
          const d = deltaByTeam.get(String(team.id));
          if (!d) continue;

          await tx.matchTeam.update({
            where: { id: team.id },
            data: { delta: d.delta },
          });
          if (d.delta === 0) continue;

          for (const m of team.members) {
            await applyRatingChange(tx, {
              userId,
              seasonId: match.seasonId,
              playerId: String(m.playerId),
              delta: d.delta,
              source: "MATCH",
              label: `${match.name} — ${team.name}, ${d.rank}. místo`,
              matchId,
            });
          }
        }
      },
      // Velký zápas je hodně zápisů za sebou. Výchozích 5 s je málo,
      // jakmile je databáze dál nebo je hráčů přes dvacet.
      { timeout: 20000, maxWait: 10000 },
    );

    revalidateMatches();
    return { ok: true, message: "Zápas vyhodnocen, rating rozdaný." };
  } catch (e) {
    console.error("[closeMatch]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Vyhodnocení se nepovedlo.",
    };
  }
}

/**
 * Vrátí vyhodnocení zpátky — rating se odečte a zápas se dá opravit.
 *
 * Bez tohohle byl špatně zapsaný výsledek nevratný: rating zůstal
 * v žebříčku a jediná cesta zpět vedla přes ruční úpravu trenérem,
 * což v historii vypadá jako svévole.
 */
export async function reopenMatch(matchId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const match = await prisma.match.findFirst({
      where: { id: matchId, userId, closedAt: { not: null } },
      select: { id: true },
    });
    if (!match) return { ok: false, error: "Zápas není vyhodnocený." };

    let vraceno = 0;
    await prisma.$transaction(
      async (tx) => {
        vraceno = await revertRatingChanges(tx, { matchId });
        await tx.matchTeam.updateMany({ where: { matchId }, data: { delta: null } });
        await tx.match.updateMany({
          where: { id: matchId, userId },
          data: { closedAt: null },
        });
      },
      { timeout: 20000, maxWait: 10000 },
    );

    revalidateMatches();
    return { ok: true, message: `Vráceno zpět, rating odebrán ${vraceno} hráčům.` };
  } catch (e) {
    console.error("[reopenMatch]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Vrácení se nepovedlo.",
    };
  }
}

/**
 * Smaže zápas. Vyhodnocený se nejdřív musí vrátit — jinak by rating
 * zůstal rozdaný a v historii by visel záznam, ke kterému nevede cesta.
 */
export async function deleteMatch(matchId: string) {
  const userId = await requireUserId();
  await prisma.match.deleteMany({ where: { id: matchId, userId, closedAt: null } });
  revalidateMatches();
}
