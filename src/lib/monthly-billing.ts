import { prisma } from "@/lib/prisma";
import {
  discountPriceCentsFor,
  priceCentsForTrainingSession,
} from "@/lib/training-pricing";

export type MonthlyPlayerRow = {
  playerId: string;
  playerName: string;
  /** Číslo hráče — základ variabilního symbolu. */
  playerNumber: number;
  sessionCount: number;
  totalCents: number;
  paymentReceived: boolean;
};

export async function getMonthlyBillingRows(
  userId: string,
  year: number,
  month1to12: number,
): Promise<MonthlyPlayerRow[]> {
  const start = new Date(year, month1to12 - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month1to12, 0, 23, 59, 59, 999);

  const [players, marks, attendances] = await Promise.all([
    prisma.player.findMany({
      where: { userId, active: true, prepaidSeason: false },
      include: { groupMembers: { include: { group: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.monthlyPaymentMark.findMany({
      where: { userId, year, month: month1to12 },
      select: { playerId: true },
    }),
    // Jeden dotaz na celý měsíc místo jednoho na hráče.
    prisma.attendance.findMany({
      where: {
        status: "PRESENT",
        training: { userId, cancelled: false, startsAt: { gte: start, lte: end } },
      },
      include: { training: true },
    }),
  ]);

  const paidIds = new Set(marks.map((m) => m.playerId));

  const byPlayer = new Map<string, typeof attendances>();
  for (const a of attendances) {
    const list = byPlayer.get(a.playerId);
    if (list) list.push(a);
    else byPlayer.set(a.playerId, [a]);
  }

  return players.map((player) => {
    const mine = byPlayer.get(player.id) ?? [];
    const discount = discountPriceCentsFor(player.groupMembers.map((m) => m.group));
    let totalCents = 0;
    for (const a of mine) {
      totalCents += priceCentsForTrainingSession(a.training, discount);
    }
    return {
      playerId: player.id,
      playerName: player.name,
      playerNumber: player.number,
      sessionCount: mine.length,
      totalCents,
      paymentReceived: paidIds.has(player.id),
    };
  });
}
