import { prisma } from "@/lib/prisma";
import { ratingBand, STARTING_RATING } from "@/lib/elo";

/**
 * Kolik ratingu přidá jeden odchozený trénink.
 *
 * Schválně málo. Docházka má být znát, ale nesmí přebít duely —
 * jinak by se dalo šplhat žebříčkem tím, že člověk jen chodí
 * a nikdy nikoho nevyzve.
 */
export const RATING_PER_ATTENDANCE = 1;

export type RatingRow = {
  playerId: string;
  playerName: string;
  /** Celkový rating: z duelů a výzev plus docházka. */
  rating: number;
  /** Rozpad, ať je poznat, odkud se číslo vzalo. */
  fromDuels: number;
  fromAttendance: number;
  attendanceCount: number;
  band: string;
  /** Pořadí od 1; při shodě sdílené. */
  rank: number;
  duelsWon: number;
  duelsLost: number;
};

/**
 * Žebříček klubu.
 *
 * Docházková část se dopočítává, neukládá — když trenér dodatečně
 * opraví účast, rating se srovná sám a nikde nezůstane osiřelý zápis.
 */
export async function getLeaderboard(userId: string): Promise<RatingRow[]> {
  const [players, attendances, duels] = await Promise.all([
    prisma.player.findMany({
      where: { userId, active: true },
      select: { id: true, name: true, ratingPoints: true },
    }),
    prisma.attendance.findMany({
      where: { status: "PRESENT", training: { userId, cancelled: false } },
      select: { playerId: true },
    }),
    prisma.duel.findMany({
      where: { userId, status: "CONFIRMED" },
      select: {
        challengerId: true,
        opponentId: true,
        challengerDelta: true,
      },
    }),
  ]);

  const attendanceCount = new Map<string, number>();
  for (const a of attendances) {
    const key = String(a.playerId);
    attendanceCount.set(key, (attendanceCount.get(key) ?? 0) + 1);
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
      return {
        playerId: id,
        playerName: p.name,
        rating: p.ratingPoints + fromAttendance,
        fromDuels: p.ratingPoints - STARTING_RATING,
        fromAttendance,
        attendanceCount: count,
        band: ratingBand(p.ratingPoints + fromAttendance),
        rank: 0,
        duelsWon: won.get(id) ?? 0,
        duelsLost: lost.get(id) ?? 0,
      };
    })
    .sort((a, b) => b.rating - a.rating || a.playerName.localeCompare(b.playerName, "cs"));

  // Shodný rating = shodné pořadí.
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && prev.rating === r.rating ? prev.rank : i + 1;
  });

  return rows;
}

/** Rating jednoho hráče včetně docházkové části — vstup do výpočtu Ela. */
export async function getEffectiveRating(playerId: string): Promise<number> {
  const [player, count] = await Promise.all([
    prisma.player.findUnique({
      where: { id: playerId },
      select: { ratingPoints: true },
    }),
    prisma.attendance.count({
      where: { playerId, status: "PRESENT", training: { cancelled: false } },
    }),
  ]);
  return (player?.ratingPoints ?? STARTING_RATING) + count * RATING_PER_ATTENDANCE;
}

/**
 * Zapíše změnu ratingu hráči i do historie.
 * Volá se uvnitř transakce, aby rating a záznam nemohly rozejít.
 */
export async function applyRatingChange(
  tx: {
    player: {
      update(args: Record<string, unknown>): Promise<{ ratingPoints: number }>;
    };
    ratingEntry: { create(args: Record<string, unknown>): Promise<unknown> };
  },
  params: {
    userId: string;
    playerId: string;
    delta: number;
    source: "DUEL" | "CHALLENGE" | "COACH";
    label: string;
    duelId?: string;
    challengeId?: string;
  },
): Promise<void> {
  const updated = await tx.player.update({
    where: { id: params.playerId },
    data: { ratingPoints: { increment: params.delta } },
    select: { ratingPoints: true },
  });

  await tx.ratingEntry.create({
    data: {
      userId: params.userId,
      playerId: params.playerId,
      source: params.source,
      delta: params.delta,
      ratingAfter: updated.ratingPoints,
      label: params.label,
      duelId: params.duelId ?? null,
      challengeId: params.challengeId ?? null,
    },
  });
}
