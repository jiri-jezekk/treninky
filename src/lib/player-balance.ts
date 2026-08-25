import { prisma } from "@/lib/prisma";
import { splitChargesByMonth } from "@/lib/billing-math";
import { formatRangeCs, type PrepaidRange } from "@/lib/prepaid";
import {
  discountPriceCentsFor,
  formatMonthLabelCs,
} from "@/lib/training-pricing";
import {
  variableSymbolEvent,
  variableSymbolMonthly,
} from "@/lib/variable-symbol";

/** Účetní druh příjmu — zrcadlí enum IncomeKind ve schématu. */
export type IncomeKind = "MEMBERSHIP" | "TRAINING" | "EVENT" | "GOODS" | "OTHER";

export const INCOME_KIND_LABELS: Record<IncomeKind, string> = {
  MEMBERSHIP: "Členský příspěvek",
  TRAINING: "Tréninkové",
  EVENT: "Akce",
  GOODS: "Zboží",
  OTHER: "Ostatní",
};

export type BalanceItem = {
  /** Stabilní klíč pro React i pro výběr položek do souhrnné platby. */
  key: string;
  kind: "monthly" | "event" | "prepaid";
  label: string;
  meta: string;
  amountCents: number;
  variableSymbol: string;
  incomeKind: IncomeKind;
  paid: boolean;
  /** Řazení od nejstaršího dluhu; akce jdou nakonec. */
  sortKey: number;
  year?: number;
  month?: number;
  sharedPaymentId?: string;
  prepaymentId?: string;
};

export type PlayerBalance = {
  playerId: string;
  playerName: string;
  playerNumber: number;
  unpaid: BalanceItem[];
  paid: BalanceItem[];
  totalCents: number;
};

type PlayerForBalance = {
  id: string;
  name: string;
  number: number;
  active: boolean;
  groupMembers: { group: { discountPriceCents: number | null } }[];
};

/**
 * Co hráč dluží — měsíční tréninky, předplatné i jednorázové akce dohromady.
 *
 * Trénink spadající do předplaceného období se do měsíční platby nepočítá;
 * místo něj je v seznamu samotné předplatné jako jedna položka. Neaktivní
 * hráč se měsíčně neúčtuje. Akcí se to netýká — ty se platí bez ohledu na to.
 */
export async function getPlayerBalance(
  userId: string,
  playerId: string,
  /** Předané, když se počítá víc hráčů najednou — ušetří dotaz na uživatele. */
  monthlyIncomeKind?: IncomeKind,
): Promise<PlayerBalance | null> {
  const player = await prisma.player.findFirst({
    where: { id: playerId, userId },
    select: {
      id: true,
      name: true,
      number: true,
      active: true,
      groupMembers: { select: { group: { select: { discountPriceCents: true } } } },
    },
  });
  if (!player) return null;

  const kind =
    monthlyIncomeKind ??
    ((
      await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { monthlyIncomeKind: true },
      })
    ).monthlyIncomeKind as IncomeKind);

  const items = await buildItems(userId, player, kind);

  const unpaid = items.filter((i) => !i.paid).sort((a, b) => a.sortKey - b.sortKey);
  const paid = items.filter((i) => i.paid).sort((a, b) => b.sortKey - a.sortKey);

  return {
    playerId: player.id,
    playerName: player.name,
    playerNumber: player.number,
    unpaid,
    paid,
    totalCents: unpaid.reduce((sum, i) => sum + i.amountCents, 0),
  };
}

async function buildItems(
  userId: string,
  player: PlayerForBalance,
  monthlyIncomeKind: IncomeKind,
): Promise<BalanceItem[]> {
  const items: BalanceItem[] = [];
  const discount = discountPriceCentsFor(player.groupMembers.map((m) => m.group));

  // --- předplacená období ---
  const prepayments = await prisma.prepayment.findMany({
    where: { userId, playerId: player.id },
    include: { season: { select: { name: true } } },
    orderBy: { startsOn: "asc" },
  });

  const ranges: PrepaidRange[] = prepayments.map((p) => ({
    startsOn: p.startsOn,
    endsOn: p.endsOn,
  }));

  for (const p of prepayments) {
    // Nulové předplatné je jen vyjmutí z účtování, ne platba k úhradě.
    if (p.amountCents <= 0) continue;
    items.push({
      key: `p-${p.id}`,
      kind: "prepaid",
      label: p.season?.name ?? "Předplatné",
      meta: formatRangeCs({ startsOn: p.startsOn, endsOn: p.endsOn }),
      amountCents: p.amountCents,
      variableSymbol: p.vs,
      incomeKind: p.incomeKind as IncomeKind,
      paid: p.paidAt != null,
      // Řadí se podle začátku období, aby stálo mezi měsíci na svém místě.
      sortKey: p.startsOn.getUTCFullYear() * 12 + p.startsOn.getUTCMonth() + 1,
      prepaymentId: p.id,
    });
  }

  // --- měsíční tréninky ---
  if (player.active) {
    const [attendances, marks] = await Promise.all([
      prisma.attendance.findMany({
        where: {
          playerId: player.id,
          status: "PRESENT",
          training: { userId, cancelled: false },
        },
        include: { training: true },
      }),
      prisma.monthlyPaymentMark.findMany({
        where: { userId, playerId: player.id },
        select: { year: true, month: true },
      }),
    ]);

    const paidMonths = new Set(marks.map((m) => `${m.year}-${m.month}`));
    const split = splitChargesByMonth(
      attendances.map((a) => a.training),
      ranges,
      discount,
    );

    for (const { year, month, cents, count } of split.months) {
      if (cents <= 0) continue;
      items.push({
        key: `m-${year}-${month}`,
        kind: "monthly",
        label: `Tréninky ${formatMonthLabelCs(year, month)}`,
        meta: `${count} ${czTrainings(count)}`,
        amountCents: cents,
        variableSymbol: variableSymbolMonthly(player.number, year, month),
        incomeKind: monthlyIncomeKind,
        paid: paidMonths.has(`${year}-${month}`),
        sortKey: year * 12 + month,
        year,
        month,
      });
    }
  }

  // --- jednorázové akce ---
  const parts = await prisma.sharedPaymentParticipant.findMany({
    where: { playerId: player.id, sharedPayment: { userId } },
    include: { sharedPayment: true },
  });

  for (const p of parts) {
    if (p.amountCents <= 0) continue;
    const sp = p.sharedPayment;
    items.push({
      key: `e-${sp.id}`,
      kind: "event",
      label: sp.title,
      meta: sp.description ?? "Jednorázová akce",
      amountCents: p.amountCents,
      variableSymbol: variableSymbolEvent(player.number, sp.number),
      incomeKind: sp.incomeKind as IncomeKind,
      paid: p.paidAt != null,
      sortKey: 100000 + sp.number,
      sharedPaymentId: sp.id,
    });
  }

  return items;
}

function czTrainings(n: number): string {
  if (n === 1) return "odchozený trénink";
  if (n >= 2 && n <= 4) return "odchozené tréninky";
  return "odchozených tréninků";
}

/** Přehled dlužníků pro trenéra — všichni, kdo něco dluží, od největšího dluhu. */
export async function getDebtors(userId: string): Promise<PlayerBalance[]> {
  const [players, user] = await Promise.all([
    prisma.player.findMany({
      where: { userId },
      select: { id: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { monthlyIncomeKind: true },
    }),
  ]);

  const kind = user.monthlyIncomeKind as IncomeKind;
  const balances = await Promise.all(
    players.map((p) => getPlayerBalance(userId, p.id, kind)),
  );

  return balances
    .filter((b): b is PlayerBalance => b != null && b.totalCents > 0)
    .sort((a, b) => b.totalCents - a.totalCents);
}
