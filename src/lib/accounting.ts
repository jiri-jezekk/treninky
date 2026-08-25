import { prisma } from "@/lib/prisma";
import type { IncomeKind } from "@/lib/player-balance";
import { formatRangeCs, isPrepaidOn, type PrepaidRange } from "@/lib/prepaid";
import {
  discountPriceCentsFor,
  priceCentsForTrainingSession,
} from "@/lib/training-pricing";

export const INCOME_KINDS: IncomeKind[] = [
  "MEMBERSHIP",
  "TRAINING",
  "EVENT",
  "GOODS",
  "OTHER",
];

export type AccountingEntry = {
  /** Datum, kdy platba dorazila — spolek vede peněžní deník, tedy hotovostní princip. */
  paidAt: Date;
  playerName: string;
  playerNumber: number;
  label: string;
  kind: IncomeKind;
  amountCents: number;
  variableSymbol: string;
};

export type AccountingMonth = {
  month: number;
  byKind: Record<IncomeKind, number>;
  total: number;
};

/**
 * Souhrnná platba: jedna částka ve výpisu, víc účelů. Rozpad je to,
 * co z ní dělá doložitelný záznam — bez něj by ji musel někdo ručně
 * rozdělit mezi členské příspěvky a ostatní příjmy.
 */
export type AccountingBatch = {
  vs: string;
  playerName: string;
  createdAt: Date;
  totalCents: number;
  items: { label: string; kind: IncomeKind; amountCents: number }[];
};

export type AccountingSummary = {
  year: number;
  months: AccountingMonth[];
  byKind: Record<IncomeKind, number>;
  total: number;
  entries: AccountingEntry[];
  batches: AccountingBatch[];
};

function emptyByKind(): Record<IncomeKind, number> {
  return { MEMBERSHIP: 0, TRAINING: 0, EVENT: 0, GOODS: 0, OTHER: 0 };
}

/**
 * Přehled přijatých plateb za rok, rozdělený podle účetního druhu příjmu.
 *
 * Řadí se podle **data přijetí platby**, ne podle měsíce, kterého se týká —
 * spolek vede peněžní deník a rozhoduje okamžik, kdy peníze dorazily.
 * Platba za červnové tréninky označená v srpnu tedy patří do srpna.
 */
export async function getAccountingSummary(
  userId: string,
  year: number,
): Promise<AccountingSummary> {
  const from = new Date(year, 0, 1, 0, 0, 0, 0);
  const to = new Date(year, 11, 31, 23, 59, 59, 999);

  const [user, marks, parts, players, attendances, rawBatches, prepayments] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { monthlyIncomeKind: true },
    }),
    prisma.monthlyPaymentMark.findMany({
      where: { userId, createdAt: { gte: from, lte: to } },
      include: { player: { select: { name: true, number: true } } },
    }),
    prisma.sharedPaymentParticipant.findMany({
      where: {
        sharedPayment: { userId },
        paidAt: { gte: from, lte: to },
      },
      include: {
        player: { select: { name: true, number: true } },
        sharedPayment: { select: { title: true, number: true, incomeKind: true } },
      },
    }),
    prisma.player.findMany({
      where: { userId },
      select: {
        id: true,
        groupMembers: { select: { group: { select: { discountPriceCents: true } } } },
      },
    }),
    prisma.attendance.findMany({
      where: { status: "PRESENT", training: { userId, cancelled: false } },
      include: { training: true },
    }),
    prisma.paymentBatch.findMany({
      where: { userId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        player: { select: { name: true } },
      },
    }),
    // Všechna předplatná, ne jen letošní: starší období ovlivňují, které
    // tréninky se mají počítat do dopočtu měsíčních částek.
    prisma.prepayment.findMany({
      where: { userId },
      include: {
        player: { select: { name: true, number: true } },
        season: { select: { name: true } },
      },
    }),
  ]);

  const monthlyKind = user.monthlyIncomeKind as IncomeKind;

  const discountByPlayer = new Map<string, number | null>(
    players.map((p) => [
      String(p.id),
      discountPriceCentsFor(p.groupMembers.map((m) => m.group)),
    ]),
  );

  const prepaidByPlayer = new Map<string, PrepaidRange[]>();
  for (const p of prepayments) {
    const key = String(p.playerId);
    const range: PrepaidRange = { startsOn: p.startsOn, endsOn: p.endsOn };
    const list = prepaidByPlayer.get(key);
    if (list) list.push(range);
    else prepaidByPlayer.set(key, [range]);
  }

  // Kolik dělal který hráč v kterém měsíci — potřeba k dopočtu částky
  // u označené měsíční platby, protože ta se v databázi neukládá.
  // Tréninky krytého období se vynechávají, jinak by se příjem započetl
  // dvakrát: jednou v předplatném a podruhé v měsíci.
  const owedByPlayerMonth = new Map<string, number>();
  for (const a of attendances) {
    const ranges = prepaidByPlayer.get(String(a.playerId)) ?? [];
    if (isPrepaidOn(ranges, a.training.startsAt)) continue;
    const d = a.training.startsAt;
    const key = `${a.playerId}|${d.getFullYear()}|${d.getMonth() + 1}`;
    const cents = priceCentsForTrainingSession(
      a.training,
      discountByPlayer.get(String(a.playerId)) ?? null,
    );
    owedByPlayerMonth.set(key, (owedByPlayerMonth.get(key) ?? 0) + cents);
  }

  const entries: AccountingEntry[] = [];

  for (const p of prepayments) {
    if (!p.paidAt || p.amountCents <= 0) continue;
    if (p.paidAt < from || p.paidAt > to) continue;
    entries.push({
      paidAt: p.paidAt,
      playerName: p.player.name,
      playerNumber: p.player.number,
      label: `${p.season?.name ?? "Předplatné"} (${formatRangeCs({ startsOn: p.startsOn, endsOn: p.endsOn })})`,
      kind: p.incomeKind as IncomeKind,
      amountCents: p.amountCents,
      variableSymbol: p.vs,
    });
  }

  for (const m of marks) {
    const amount = owedByPlayerMonth.get(`${m.playerId}|${m.year}|${m.month}`) ?? 0;
    if (amount <= 0) continue;
    entries.push({
      paidAt: m.createdAt,
      playerName: m.player.name,
      playerNumber: m.player.number,
      label: `Tréninky ${m.month}/${m.year}`,
      kind: monthlyKind,
      amountCents: amount,
      variableSymbol: `1${String(m.player.number).padStart(4, "0")}${String(m.year % 100).padStart(2, "0")}${String(m.month).padStart(2, "0")}`,
    });
  }

  for (const p of parts) {
    if (!p.paidAt || p.amountCents <= 0) continue;
    entries.push({
      paidAt: p.paidAt,
      playerName: p.player.name,
      playerNumber: p.player.number,
      label: p.sharedPayment.title,
      kind: p.sharedPayment.incomeKind as IncomeKind,
      amountCents: p.amountCents,
      variableSymbol: `2${String(p.player.number).padStart(4, "0")}${String(p.sharedPayment.number).padStart(3, "0")}`,
    });
  }

  entries.sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());

  const months: AccountingMonth[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    byKind: emptyByKind(),
    total: 0,
  }));
  const byKind = emptyByKind();
  let total = 0;

  for (const e of entries) {
    const m = months[e.paidAt.getMonth()]!;
    m.byKind[e.kind] += e.amountCents;
    m.total += e.amountCents;
    byKind[e.kind] += e.amountCents;
    total += e.amountCents;
  }

  const batches: AccountingBatch[] = rawBatches.map((b) => ({
    vs: b.vs,
    playerName: b.player.name,
    createdAt: b.createdAt,
    totalCents: b.totalCents,
    items: b.items.map((i) => ({
      label: i.label,
      kind: i.kind as IncomeKind,
      amountCents: i.amountCents,
    })),
  }));

  return { year, months, byKind, total, entries, batches };
}
