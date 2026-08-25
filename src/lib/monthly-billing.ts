import { prisma } from "@/lib/prisma";
import { splitChargesByMonth } from "@/lib/billing-math";
import type { PrepaidRange } from "@/lib/prepaid";
import { discountPriceCentsFor } from "@/lib/training-pricing";

export type MonthlyPlayerRow = {
  playerId: string;
  playerName: string;
  /** Číslo hráče — základ variabilního symbolu. */
  playerNumber: number;
  sessionCount: number;
  totalCents: number;
  paymentReceived: boolean;
  /** Kolik tréninků v měsíci pokrylo předplatné — kvůli popisku „vše předplacené“. */
  prepaidSessionCount: number;
};

/** Předplacená období všech hráčů uživatele, sdružená podle hráče. */
export async function getPrepaidRangesByPlayer(
  userId: string,
): Promise<Map<string, PrepaidRange[]>> {
  const rows = await prisma.prepayment.findMany({
    where: { userId },
    select: { playerId: true, startsOn: true, endsOn: true },
  });

  const map = new Map<string, PrepaidRange[]>();
  for (const r of rows) {
    const key = String(r.playerId);
    const list = map.get(key);
    const range: PrepaidRange = { startsOn: r.startsOn, endsOn: r.endsOn };
    if (list) list.push(range);
    else map.set(key, [range]);
  }
  return map;
}

export async function getMonthlyBillingRows(
  userId: string,
  year: number,
  month1to12: number,
): Promise<MonthlyPlayerRow[]> {
  const start = new Date(year, month1to12 - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month1to12, 0, 23, 59, 59, 999);

  const [players, marks, attendances, prepaidByPlayer] = await Promise.all([
    // Předplacení se už nevyřazují dotazem — o tom, jestli se trénink
    // účtuje, rozhoduje jeho datum, ne přepínač u hráče.
    prisma.player.findMany({
      where: { userId, active: true },
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
    getPrepaidRangesByPlayer(userId),
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
    const ranges = prepaidByPlayer.get(String(player.id)) ?? [];
    const split = splitChargesByMonth(
      mine.map((a) => a.training),
      ranges,
      discount,
    );

    return {
      playerId: player.id,
      playerName: player.name,
      playerNumber: player.number,
      sessionCount: mine.length,
      totalCents: split.totalCents,
      paymentReceived: paidIds.has(player.id),
      prepaidSessionCount: split.prepaidCount,
    };
  });
}
