import { prisma } from "@/lib/prisma";
import { playerIsJunior, priceCentsForTrainingSession } from "@/lib/training-pricing";

export type MonthlyPlayerRow = {
  playerId: string;
  playerName: string;
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

  const players = await prisma.player.findMany({
    where: { userId, active: true, prepaidSeason: false },
    include: { groupMembers: true },
    orderBy: { name: "asc" },
  });

  const marks = await prisma.monthlyPaymentMark.findMany({
    where: { userId, year, month: month1to12 },
    select: { playerId: true },
  });
  const paidIds = new Set(marks.map((m) => m.playerId));

  const rows: MonthlyPlayerRow[] = [];

  for (const player of players) {
    const attendances = await prisma.attendance.findMany({
      where: {
        playerId: player.id,
        status: "PRESENT",
        training: {
          userId,
          cancelled: false,
          startsAt: { gte: start, lte: end },
        },
      },
      include: { training: true },
    });

    const isJ = playerIsJunior(player.groupMembers);
    let totalCents = 0;
    for (const a of attendances) {
      totalCents += priceCentsForTrainingSession(a.training, isJ);
    }

    rows.push({
      playerId: player.id,
      playerName: player.name,
      sessionCount: attendances.length,
      totalCents,
      paymentReceived: paidIds.has(player.id),
    });
  }

  return rows;
}
