import type { Prisma } from "@prisma/client";
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
  /** Individuální tréninky, které si hráč zapsal sám. */
  soloCount: number;
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

  const [players, attendances, solos, duels, ratings] = await Promise.all([
    // Vyřazení hráči se nepočítají ani nezobrazují — trenér je zatím
    // vede jen kvůli platbám.
    prisma.player.findMany({
      where: { userId, active: true, inRating: true },
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
    prisma.soloSession.findMany({
      where: { userId, performedOn: { gte: from, lte: to } },
      select: { playerId: true },
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

  const soloCount = new Map<string, number>();
  for (const so of solos) {
    const key = String(so.playerId);
    soloCount.set(key, (soloCount.get(key) ?? 0) + 1);
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
      const solo = soloCount.get(id) ?? 0;
      const count = (attendanceCount.get(id) ?? 0) + solo;
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
        soloCount: solo,
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

  const [rating, count, solo] = await Promise.all([
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
    prisma.soloSession.count({
      where: { playerId, performedOn: { gte: from, lte: to } },
    }),
  ]);

  return (
    (rating?.points ?? STARTING_RATING) + (count + solo) * RATING_PER_ATTENDANCE
  );
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
  const [ratings, counts, solos] = await Promise.all([
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
    prisma.soloSession.groupBy({
      by: ["playerId"],
      where: { playerId: { in: unique }, performedOn: { gte: from, lte: to } },
      _count: { playerId: true },
    }),
  ]);

  const pointsById = new Map<string, number>(
    ratings.map((r) => [String(r.playerId), r.points]),
  );
  const countById = new Map<string, number>(
    counts.map((c) => [String(c.playerId), Number(c._count.playerId ?? 0)]),
  );
  const soloById = new Map<string, number>(
    solos.map((c) => [String(c.playerId), Number(c._count.playerId ?? 0)]),
  );

  for (const id of unique) {
    out.set(
      id,
      (pointsById.get(id) ?? STARTING_RATING) +
        ((countById.get(id) ?? 0) + (soloById.get(id) ?? 0)) *
          RATING_PER_ATTENDANCE,
    );
  }
  return out;
}

/**
 * Zapíše změnu ratingu hráči i do historie.
 * Volá se uvnitř transakce, aby se rating a záznam nemohly rozejít.
 */
export async function applyRatingChange(
  // Typ dodává sama Prisma. Ručně psaný tvar `tx` sem prošel, protože
  // náhradní typy pro místní kontrolu jsou volnější — skutečný klient
  // je přísnější a build spadl až na Vercelu. Nevymýšlet ho znovu.
  tx: Prisma.TransactionClient,
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

/**
 * Vrátí rating rozdaný jednou akcí — duelem, zápasem nebo výzvou.
 *
 * Bez tohohle nešlo špatně zapsaný výsledek opravit: jakmile se rating
 * jednou rozdal, zůstal v žebříčku napořád a jediná cesta zpátky vedla
 * přes ruční úpravu, která v historii vypadá jako svévole trenéra.
 * Takhle se odečte přesně to, co se přičetlo, a záznamy z historie
 * zmizí, takže po opravě nezůstane dvojí stopa.
 *
 * Vrací počet vrácených záznamů. Volá se uvnitř transakce.
 */
export async function revertRatingChanges(
  tx: Prisma.TransactionClient,
  where: { duelId?: string; matchId?: string; challengeId?: string },
): Promise<number> {
  const entries = await tx.ratingEntry.findMany({
    where,
    select: { id: true, playerId: true, seasonId: true, delta: true },
  });
  if (entries.length === 0) return 0;

  for (const e of entries) {
    await tx.playerRating.updateMany({
      where: { seasonId: e.seasonId, playerId: e.playerId },
      data: { points: { decrement: e.delta } },
    });
  }

  await tx.ratingEntry.deleteMany({
    where: { id: { in: entries.map((e) => e.id) } },
  });
  return entries.length;
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

export type SoloRow = {
  id: string;
  playerName: string;
  name: string;
  performedOn: Date;
};

/** Co si kdo zapsal jako individuální trénink — kontrola pro trenéra. */
export async function getSoloSessions(
  userId: string,
  season: SeasonInfo | null,
  limit = 40,
): Promise<SoloRow[]> {
  if (!season) return [];

  const rows = await prisma.soloSession.findMany({
    where: {
      userId,
      performedOn: { gte: season.startsOn, lte: season.endsOn },
    },
    orderBy: { performedOn: "desc" },
    take: limit,
    include: { player: { select: { name: true } } },
  });

  return rows.map((r) => ({
    id: String(r.id),
    playerName: r.player.name,
    name: r.name,
    performedOn: r.performedOn,
  }));
}

export type PlayerActivity = {
  playerId: string;
  playerName: string;
  inRating: boolean;
  seasonName: string | null;
  rating: number;
  rank: number | null;
  band: string;
  /**
   * Rozpad ratingu podle toho, odkud se vzal. Bez něj je rating jen
   * číslo, o kterém se dá leda hádat.
   */
  fromDuelsAndMatches: number;
  fromChallenges: number;
  fromCoach: number;
  fromAttendance: number;
  fromSolo: number;
  attendanceCount: number;
  soloCount: number;
  duelsWon: number;
  duelsLost: number;
  entries: {
    id: string;
    source: string;
    delta: number;
    ratingAfter: number;
    label: string;
    createdAt: Date;
    /** Na co se dá prokliknout. */
    duelId: string | null;
    matchId: string | null;
    challengeId: string | null;
  }[];
  solos: { id: string; name: string; performedOn: Date }[];
};

/**
 * Co za sezónu udělal jeden hráč.
 *
 * Dřív visel pod žebříčkem jeden dlouhý výpis změn celého týmu, ve kterém
 * se nedalo nic najít. Tohle je totéž po jednom hráči — dostupné
 * kliknutím na jeho jméno v žebříčku.
 */
export async function getPlayerActivity(
  userId: string,
  season: SeasonInfo | null,
  playerId: string,
): Promise<PlayerActivity | null> {
  const player = await prisma.player.findFirst({
    where: { id: playerId, userId },
    select: { id: true, name: true, inRating: true },
  });
  if (!player) return null;

  if (!season) {
    return {
      playerId: String(player.id),
      playerName: player.name,
      inRating: player.inRating,
      seasonName: null,
      rating: STARTING_RATING,
      rank: null,
      band: ratingBand(STARTING_RATING),
      fromDuelsAndMatches: 0,
      fromChallenges: 0,
      fromCoach: 0,
      fromAttendance: 0,
      fromSolo: 0,
      attendanceCount: 0,
      soloCount: 0,
      duelsWon: 0,
      duelsLost: 0,
      entries: [],
      solos: [],
    };
  }

  const from = new Date(season.startsOn);
  const to = new Date(season.endsOn);
  to.setUTCHours(23, 59, 59, 999);

  // Žebříček kvůli pořadí a docházkové části — počítá se stejně jako
  // všude jinde, aby profil a žebříček neukazovaly jiné číslo.
  const [board, entries, solos] = await Promise.all([
    getLeaderboard(userId, season),
    prisma.ratingEntry.findMany({
      where: { userId, seasonId: season.id, playerId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.soloSession.findMany({
      where: { userId, playerId, performedOn: { gte: from, lte: to } },
      orderBy: { performedOn: "desc" },
      take: 100,
    }),
  ]);

  const row = board.find((r) => r.playerId === String(player.id));

  // Rozpad podle zdroje. Docházková část se nikam neukládá — dopočítává
  // se z počtu účastí, aby se sama srovnala, když trenér účast opraví.
  let fromDuelsAndMatches = 0;
  let fromChallenges = 0;
  let fromCoach = 0;
  for (const e of entries) {
    if (e.source === "CHALLENGE") fromChallenges += e.delta;
    else if (e.source === "COACH") fromCoach += e.delta;
    else fromDuelsAndMatches += e.delta;
  }

  const soloCount = row?.soloCount ?? 0;
  // attendanceCount ze žebříčku už individuální tréninky obsahuje —
  // tady je chceme zvlášť.
  const klubovych = Math.max(0, (row?.attendanceCount ?? 0) - soloCount);

  return {
    playerId: String(player.id),
    playerName: player.name,
    inRating: player.inRating,
    seasonName: season.name,
    rating: row?.rating ?? STARTING_RATING,
    rank: row?.rank ?? null,
    band: row?.band ?? ratingBand(STARTING_RATING),
    fromDuelsAndMatches,
    fromChallenges,
    fromCoach,
    fromAttendance: klubovych * RATING_PER_ATTENDANCE,
    fromSolo: soloCount * RATING_PER_ATTENDANCE,
    attendanceCount: klubovych,
    soloCount,
    duelsWon: row?.duelsWon ?? 0,
    duelsLost: row?.duelsLost ?? 0,
    entries: entries.map((e) => ({
      id: String(e.id),
      source: String(e.source),
      delta: e.delta,
      ratingAfter: e.ratingAfter,
      label: e.label,
      createdAt: e.createdAt,
      duelId: e.duelId == null ? null : String(e.duelId),
      matchId: e.matchId == null ? null : String(e.matchId),
      challengeId: e.challengeId == null ? null : String(e.challengeId),
    })),
    solos: solos.map((s) => ({
      id: String(s.id),
      name: s.name,
      performedOn: s.performedOn,
    })),
  };
}

/**
 * Jeden duel se vším, co je o něm vidět — kdo, kolik, o kolik se hnul
 * rating. Slouží stránce s detailem, na kterou se dá prokliknout
 * z profilu hráče.
 */
export async function getDuelDetail(userId: string, duelId: string) {
  const duel = await prisma.duel.findFirst({
    where: { id: duelId, userId },
    include: {
      challenger: { select: { id: true, name: true } },
      opponent: { select: { id: true, name: true } },
    },
  });
  if (!duel) return null;

  const a = duel.challengerValue;
  const b = duel.opponentValue;
  const rozhodnuto = a != null && b != null && a !== b;
  const vyhraviVyzyvatel = rozhodnuto
    ? duel.higherWins
      ? a > b
      : a < b
    : false;

  return {
    id: String(duel.id),
    name: duel.name,
    description: duel.description,
    note: duel.note,
    measure: duel.measure,
    higherWins: duel.higherWins,
    weightPercent: duel.weightPercent,
    status: String(duel.status),
    createdAt: duel.createdAt,
    confirmedAt: duel.confirmedAt,
    players: [
      {
        playerId: String(duel.challengerId),
        name: duel.challenger.name,
        value: a,
        delta: duel.challengerDelta,
        wins: rozhodnuto && vyhraviVyzyvatel,
      },
      {
        playerId: String(duel.opponentId),
        name: duel.opponent.name,
        value: b,
        delta: duel.opponentDelta,
        wins: rozhodnuto && !vyhraviVyzyvatel,
      },
    ],
  };
}
