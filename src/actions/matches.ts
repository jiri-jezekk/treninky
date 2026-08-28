"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { averageRating, teamDeltas } from "@/lib/elo";
import { parseDateInput } from "@/lib/prepaid";
import { applyRatingChange, getActiveSeason, getEffectiveRating } from "@/lib/rating";

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
  const n = Number(String(raw ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
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
 * Uzavře zápas a rozdá rating.
 *
 * Tým vystupuje jako jeden hráč s průměrným ratingem svých členů;
 * spočítaná změna pak platí pro každého z nich. Jde to jen jednou —
 * hlídá to podmínka na `closedAt` uvnitř transakce.
 */
export async function closeMatch(matchId: string) {
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
  if (!match) return;
  if (match.teams.length < 2) return;

  // Rating každého člena včetně docházkové části, ať tým vychází
  // ze stejných čísel, jaká hráči vidí v žebříčku.
  const ratingByPlayer = new Map<string, number>();
  for (const team of match.teams) {
    for (const m of team.members) {
      const id = String(m.playerId);
      if (!ratingByPlayer.has(id)) {
        ratingByPlayer.set(id, await getEffectiveRating(id, match.season));
      }
    }
  }

  const deltas = teamDeltas(
    match.teams.map((t) => ({
      teamId: String(t.id),
      rating: averageRating(
        t.members.map((m) => ratingByPlayer.get(String(m.playerId)) ?? 1000),
      ),
      score: t.score,
    })),
    match.weightPercent,
  );
  const deltaByTeam = new Map(deltas.map((d) => [d.teamId, d]));

  await prisma.$transaction(async (tx) => {
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
  });

  revalidateMatches();
}

/**
 * Smaže zápas. Uzavřený se nemaže — rating už je rozdaný a v historii
 * by zůstal záznam, ke kterému nevede cesta.
 */
export async function deleteMatch(matchId: string) {
  const userId = await requireUserId();
  await prisma.match.deleteMany({ where: { id: matchId, userId, closedAt: null } });
  revalidateMatches();
}
