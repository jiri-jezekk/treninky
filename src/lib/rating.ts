import { prisma } from "@/lib/prisma";
import { ratingBand, STARTING_RATING } from "@/lib/elo";

/**
 * Kolik ratingu přidá jedna účast — trénink i posilovna.
 *
 * Schválně málo. Docházka má být znát, ale nesmí přebít duely —
 * jinak by se dalo šplhat žebříčkem tím, že člověk jen chodí
 * a nikdy nikoho nevyzve.
 */
export const RATING_PER_ATTENDANCE = 1;

export type SeasonInfo = {
  id: string;
  name: string;
  startsOn: Date;
  endsOn: Date;
};

/**
 * Sezóna, do které se teď sbírá.
 *
 * Bere tu, do jejíhož období spadá dnešek; když žádná neběží
 * (mezi sezónami), vezme poslední skončenou, aby žebříček nezmizel.
 */
export async function getActiveSeason(userId: string): Promise<SeasonInfo | null> {
  const today = new Date();
  const running = await prisma.ratingSeason.findFirst({
    where: { userId, startsOn: { lte: today }, endsOn: { gte: today } },
    orderBy: { startsOn: "desc" },
  });
  if (running) return running;

  return prisma.ratingSeason.findFirst({
    where: { userId },
    orderBy: { startsOn: "desc" },
  });
}

export type RatingRow = {
  playerId: string;
  playerName: string;
  rating: number;
  fromDuels: number;
  fromAttendance: number;
  attendanceCount: number;
  gymCount: number;
  band: string;
  rank: number;
  duelsWon: number;
  duelsLost: number;
};

/**
 * Žebříček sezóny.
 *
 * Docházková část se dopočítává, neukládá — když trenér dodatečně
 * opraví účast, rating se srovná sám a nikde nezůstane osiřelý zápis.
 * Počítají se jen tréninky spadající do sezóny.
 */
export async function getLeaderboard(
  userId: string,
  season: SeasonInfo | null,
): Promise<RatingRow[]> {
  if (!season) return [];

  const from = new Date(season.startsOn);
  const to = new Date(season.endsOn);
  to.setUTCHours(23, 59, 59, 999);

  const [players, attendances, duels, ratings] = await Promise.all([
    prisma.player.findMany({
      where: { userId, active: true },
      select: { id: true, name: true },
    }),
    prisma.attendance.findMany({
      where: {
        status: "PRESENT",
        training: {
          userId,
          cancelled: false,
          startsAt: { gte: from, lte: to },
        },
      },
      select: { playerId: true, training: { select: { kind: true } } },
    }),
    prisma.duel.findMany({
      where: { userId, seasonId: season.id, status: "CONFIRMED" },
      select: { challengerId: true, opponentId: true, challengerDelta: true },
    }),
    prisma.playerRating.findMany({
      where: { seasonId: season.id },
      select: { playerId: true, points: true },
    }),
  ]);

  const pointsById = new Map<string, number>(
    ratings.map((r) => [String(r.playerId), r.points]),
  );

  const attendanceCount = new Map<string, number>();
  const gymCount = new Map<string, number>();
  for (const a of attendances) {
    const key = String(a.playerId);
    attendanceCount.set(key, (attendanceCount.get(key) ?? 0) + 1);
    if (a.training.kind === "GYM") {
      gymCount.set(key, (gymCount.get(key) ?? 0) + 1);
    }
  }

  const won = new Map<string, number>();
  const lost = new Map<string, number>();
  const bump = (map: Map<string, number>, id: string) =>
    map.set(id, (map.get(id) ?? 0) + 1);

  for (const d of duels) {
    const delta = d.challengerDelta ?? 0;
    if (delta === 0) continue; // remíza
    const challenger = String(d.challengerId);
    const opponent = String(d.opponentId);
    if (delta > 0) {
      bump(won, challenger);
      bump(lost, opponent);
    } else {
      bump(won, opponent);
      bump(lost, challenger);
    }
  }

  const rows = players
    .map((p) => {
      const id = String(p.id);
      const count = attendanceCount.get(id) ?? 0;
      const fromAttendance = count * RATING_PER_ATTENDANCE;
      const points = pointsById.get(id) ?? STARTING_RATING;
      return {
        playerId: id,
        playerName: p.name,
        rating: points + fromAttendance,
        fromDuels: points - STARTING_RATING,
        fromAttendance,
        attendanceCount: count,
        gymCount: gymCount.get(id) ?? 0,
        band: ratingBand(points + fromAttendance),
        rank: 0,
        duelsWon: won.get(id) ?? 0,
        duelsLost: lost.get(id) ?? 0,
      };
    })
    .sort(
      (a, b) => b.rating - a.rating || a.playerName.localeCompare(b.playerName, "cs"),
    );

  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && prev.rating === r.rating ? prev.rank : i + 1;
  });

  return rows;
}

/** Rating hráče v sezóně včetně docházkové části — vstup do výpočtu Ela. */
export async function getEffectiveRating(
  playerId: string,
  season: SeasonInfo,
): Promise<number> {
  const from = new Date(season.startsOn);
  const to = new Date(season.endsOn);
  to.setUTCHours(23, 59, 59, 999);

  const [rating, count] = await Promise.all([
    prisma.playerRating.findFirst({
      where: { seasonId: season.id, playerId },
      select: { points: true },
    }),
    prisma.attendance.count({
      where: {
        playerId,
        status: "PRESENT",
        training: { cancelled: false, startsAt: { gte: from, lte: to } },
      },
    }),
  ]);

  return (rating?.points ?? STARTING_RATING) + count * RATING_PER_ATTENDANCE;
}

/** Rating několika hráčů najednou — pro náhledy, kde se počítá víc duelů. */
export async function getEffectiveRatings(
  playerIds: string[],
  season: SeasonInfo | null,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!season || playerIds.length === 0) return out;

  const from = new Date(season.startsOn);
  const to = new Date(season.endsOn);
  to.setUTCHours(23, 59, 59, 999);

  const unique = [...new Set(playerIds)];
  const [ratings, counts] = await Promise.all([
    prisma.playerRating.findMany({
      where: { seasonId: season.id, playerId: { in: unique } },
      select: { playerId: true, points: true },
    }),
    prisma.attendance.groupBy({
      by: ["playerId"],
      where: {
        playerId: { in: unique },
        status: "PRESENT",
        training: { cancelled: false, startsAt: { gte: from, lte: to } },
      },
      _count: { playerId: true },
    }),
  ]);

  const pointsById = new Map<string, number>(
    ratings.map((r) => [String(r.playerId), r.points]),
  );
  const countById = new Map<string, number>(
    counts.map((c) => [String(c.playerId), Number(c._count.playerId ?? 0)]),
  );

  for (const id of unique) {
    out.set(
      id,
      (pointsById.get(id) ?? STARTING_RATING) +
        (countById.get(id) ?? 0) * RATING_PER_ATTENDANCE,
    );
  }
  return out;
}

/**
 * Zapíše změnu ratingu hráči i do historie.
 * Volá se uvnitř transakce, aby se rating a záznam nemohly rozejít.
 */
export async function applyRatingChange(
  tx: {
    playerRating: {
      upsert(args: Record<string, unknown>): Promise<{ points: number }>;
    };
    ratingEntry: { create(args: Record<string, unknown>): Promise<unknown> };
  },
  params: {
    userId: string;
    seasonId: string;
    playerId: string;
    delta: number;
    source: "DUEL" | "MATCH" | "CHALLENGE" | "COACH";
    label: string;
    duelId?: string;
    matchId?: string;
    challengeId?: string;
  },
): Promise<void> {
  // Upsert, ne update: hráč přidaný v půlce sezóny ještě žádný
  // řádek ratingu nemá a první duel by mu spadl.
  const updated = await tx.playerRating.upsert({
    where: {
      seasonId_playerId: { seasonId: params.seasonId, playerId: params.playerId },
    },
    create: {
      seasonId: params.seasonId,
      playerId: params.playerId,
      points: STARTING_RATING + params.delta,
    },
    update: { points: { increment: params.delta } },
    select: { points: true },
  });

  await tx.ratingEntry.create({
    data: {
      userId: params.userId,
      seasonId: params.seasonId,
      playerId: params.playerId,
      source: params.source,
      delta: params.delta,
      ratingAfter: updated.points,
      label: params.label,
      duelId: params.duelId ?? null,
      matchId: params.matchId ?? null,
      challengeId: params.challengeId ?? null,
    },
  });
}

export type HistoryRow = {
  id: string;
  playerName: string;
  source: string;
  delta: number;
  ratingAfter: number;
  label: string;
  createdAt: Date;
};

export const RATING_SOURCE_LABELS: Record<string, string> = {
  DUEL: "Duel",
  MATCH: "Zápas",
  CHALLENGE: "Výzva",
  COACH: "Trenér",
};

/**
 * Historie změn ratingu v sezóně — vidí ji trenér i hráči.
 *
 * Právě to dělá ze žebříčku něco, co se dá zkontrolovat: u každého
 * čísla je vidět, odkud se vzalo.
 */
export async function getRatingHistory(
  userId: string,
  season: SeasonInfo | null,
  limit = 60,
): Promise<HistoryRow[]> {
  if (!season) return [];

  const entries = await prisma.ratingEntry.findMany({
    where: { userId, seasonId: season.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { player: { select: { name: true } } },
  });

  return entries.map((e) => ({
    id: String(e.id),
    playerName: e.player.name,
    source: String(e.source),
    delta: e.delta,
    ratingAfter: e.ratingAfter,
    label: e.label,
    createdAt: e.createdAt,
  }));
}
