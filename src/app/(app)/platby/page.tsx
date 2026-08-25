import { PaymentsView, type EventRow, type MonthlyRow } from "./PaymentsView";
import { getDebtors } from "@/lib/player-balance";
import { getMonthlyBillingRows } from "@/lib/monthly-billing";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { variableSymbolMonthly } from "@/lib/variable-symbol";

function parseMonth(sp: { rok?: string; mesic?: string }): {
  year: number;
  month: number;
} {
  const now = new Date();
  const year = Number.parseInt(sp.rok ?? "", 10);
  const month = Number.parseInt(sp.mesic ?? "", 10);
  const okYear = Number.isInteger(year) && year >= 2000 && year <= 2100;
  const okMonth = Number.isInteger(month) && month >= 1 && month <= 12;
  return okYear && okMonth
    ? { year, month }
    : { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default async function PlatbyPage({
  searchParams,
}: {
  searchParams: Promise<{ zalozka?: string; rok?: string; mesic?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const { year, month } = parseMonth(sp);

  const [user, debtors, monthly, events, tokens] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { bankIban: true, clubName: true },
    }),
    getDebtors(userId),
    getMonthlyBillingRows(userId, year, month),
    prisma.sharedPayment.findMany({
      where: { userId },
      orderBy: [{ archived: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        number: true,
        archived: true,
        createdAt: true,
        participants: { select: { amountCents: true, paidAt: true } },
      },
    }),
    prisma.player.findMany({
      where: { userId },
      select: { id: true, payToken: true },
    }),
  ]);

  const tokenById = new Map<string, string>(
    tokens.map((t) => [String(t.id), String(t.payToken)]),
  );

  const monthlyRows: MonthlyRow[] = monthly
    .filter((r) => r.totalCents > 0)
    .map((r) => ({
      playerId: r.playerId,
      playerName: r.playerName,
      playerNumber: r.playerNumber,
      sessionCount: r.sessionCount,
      totalCents: r.totalCents,
      paid: r.paymentReceived,
      variableSymbol: variableSymbolMonthly(r.playerNumber, year, month),
    }));

  const eventRows: EventRow[] = events.map((e) => {
    const total = e.participants.reduce((s, p) => s + p.amountCents, 0);
    const collected = e.participants
      .filter((p) => p.paidAt != null)
      .reduce((s, p) => s + p.amountCents, 0);
    return {
      id: e.id,
      number: e.number,
      title: e.title,
      description: e.description,
      archived: e.archived,
      createdAt: e.createdAt.toISOString(),
      participantCount: e.participants.length,
      paidCount: e.participants.filter((p) => p.paidAt != null).length,
      totalCents: total,
      collectedCents: collected,
    };
  });

  return (
    <PaymentsView
      tab={sp.zalozka === "mesicni" || sp.zalozka === "akce" ? sp.zalozka : "dluznici"}
      year={year}
      month={month}
      hasIban={Boolean(user.bankIban)}
      clubName={user.clubName?.trim() || "DC Liberec"}
      debtors={debtors.map((d) => ({
        playerId: d.playerId,
        playerName: d.playerName,
        payToken: tokenById.get(d.playerId) ?? "",
        totalCents: d.totalCents,
        items: d.unpaid.map((i) => ({
          key: i.key,
          label: i.label,
          amountCents: i.amountCents,
          kind: i.kind,
          sortKey: i.sortKey,
          year: i.year,
          month: i.month,
        })),
      }))}
      monthly={monthlyRows}
      events={eventRows}
    />
  );
}
