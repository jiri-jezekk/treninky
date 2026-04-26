import Link from "next/link";
import { notFound } from "next/navigation";
import { setMonthlyPaymentMark } from "@/actions/monthly-payment";
import { MonthlyPlayerQr } from "@/components/MonthlyPlayerQr";
import { Panel } from "@/components/ui";
import {
  PRICE_JUNIOR_CENTS,
  PRICE_THURSDAY_CENTS,
  PRICE_TUESDAY_CENTS,
  formatMonthLabelCs,
} from "@/lib/training-pricing";
import { getMonthlyBillingRows, type MonthlyPlayerRow } from "@/lib/monthly-billing";
import { formatCzkFromCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import {
  PAYMENT_MARK_PAID_BUTTON_CLASS,
  PAYMENT_MARK_UNDO_BUTTON_CLASS,
} from "@/components/payment-mark-styles";

function PaymentMarkForms({
  row,
  year,
  month,
}: {
  row: MonthlyPlayerRow;
  year: number;
  month: number;
}) {
  if (row.totalCents <= 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!row.paymentReceived ? (
        <form action={setMonthlyPaymentMark} className="inline">
          <input type="hidden" name="playerId" value={row.playerId} />
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="marked" value="true" />
          <button type="submit" className={PAYMENT_MARK_PAID_BUTTON_CLASS}>
            Zaplaceno
          </button>
        </form>
      ) : (
        <form action={setMonthlyPaymentMark} className="inline">
          <input type="hidden" name="playerId" value={row.playerId} />
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="marked" value="false" />
          <button type="submit" className={PAYMENT_MARK_UNDO_BUTTON_CLASS}>
            Zrušit označení
          </button>
        </form>
      )}
    </div>
  );
}

export default async function PlatbaMesicPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year: yStr, month: mStr } = await params;
  const year = Number.parseInt(yStr, 10);
  const month = Number.parseInt(mStr, 10);
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    month < 1 ||
    month > 12 ||
    year < 2000 ||
    year > 2100
  ) {
    notFound();
  }

  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { bankIban: true },
  });

  const rows = await getMonthlyBillingRows(userId, year, month);
  const label = formatMonthLabelCs(year, month);

  const withAmount = rows.filter((r) => r.totalCents > 0);
  const unpaid = withAmount.filter((r) => !r.paymentReceived);
  const paid = withAmount.filter((r) => r.paymentReceived);

  const prev = new Date(year, month - 2, 1);
  const next = new Date(year, month, 1);

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6">
      <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-800">Platba za tréninky</h1>
          <p className="mt-1 text-sm text-slate-600">
            QR jen pro hráče s částkou k úhradě. Po označení platby zmizí z hlavního
            seznamu a přejdou níže jako zaplacení.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href={`/platba/${prev.getFullYear()}/${prev.getMonth() + 1}`}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            ← Předchozí měsíc
          </Link>
          <Link
            href={`/platba/${next.getFullYear()}/${next.getMonth() + 1}`}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Další měsíc →
          </Link>
        </div>
      </div>

      <Panel>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          Automaticky: úterý {formatCzkFromCents(PRICE_TUESDAY_CENTS)}, čtvrtek{" "}
          {formatCzkFromCents(PRICE_THURSDAY_CENTS)}, hráč s kategorií Junioři vždy{" "}
          {formatCzkFromCents(PRICE_JUNIOR_CENTS)} za trénink. Výjimka je ručně zadaná
          cena u jednorázového tréninku (junior stále {formatCzkFromCents(PRICE_JUNIOR_CENTS)}).
          Hráči s předplacenou sezónou se v tomto přehledu vůbec nezobrazují (měsíční QR
          jen pro ostatní).
        </p>
      </Panel>

      {unpaid.length === 0 && paid.length === 0 && (
        <Panel>
          <p className="text-sm text-slate-600">
            V tomto měsíci nikdo nemá částku k úhradě přes QR (žádná přítomnost s cenou
            &gt; 0).
          </p>
        </Panel>
      )}

      {unpaid.length > 0 && (
        <Panel className="!p-0">
          <p className="border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-xs font-medium text-slate-600">
            K úhradě
          </p>
          <div className="table-scroll-wrapper">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
              <tr>
                <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">
                  Hráč
                </th>
                <th className="max-w-[5rem] whitespace-normal px-2 py-2 text-left text-xs font-medium leading-snug sm:max-w-none sm:px-4 sm:py-3 sm:text-sm">
                  Tréninky (přítomen)
                </th>
                <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">
                  Částka
                </th>
                <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">
                  QR
                </th>
                <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">
                  Platba
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {unpaid.map((r) => (
                <tr key={r.playerId}>
                  <td className="min-w-0 break-words px-2 py-2.5 text-sm font-medium text-slate-800 sm:px-4 sm:py-3 sm:text-base">
                    {r.playerName}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-sm text-slate-700 sm:px-4 sm:py-3 sm:text-base">
                    {r.sessionCount}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-sm text-slate-700 sm:px-4 sm:py-3 sm:text-base">
                    {formatCzkFromCents(r.totalCents)}
                  </td>
                  <td className="px-2 py-2.5 sm:px-4 sm:py-3">
                    <MonthlyPlayerQr
                      iban={user.bankIban}
                      playerName={r.playerName}
                      totalCents={r.totalCents}
                      year={year}
                      month={month}
                    />
                  </td>
                  <td className="align-middle px-2 py-2.5 sm:px-4 sm:py-3">
                    <PaymentMarkForms row={r} year={year} month={month} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Panel>
      )}

      {unpaid.length === 0 && paid.length > 0 && (
        <Panel>
          <p className="text-sm text-slate-600">
            Všichni s částkou v tomto měsíci jsou označeni jako zaplacení (viz níže).
          </p>
        </Panel>
      )}

      {paid.length > 0 && (
        <Panel className="!p-0">
          <p className="border-b border-slate-100 bg-emerald-50/60 px-4 py-2 text-xs font-medium text-emerald-900">
            Zaplaceno (tento měsíc)
          </p>
          <div className="table-scroll-wrapper">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
              <tr>
                <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">
                  Hráč
                </th>
                <th className="max-w-[5rem] whitespace-normal px-2 py-2 text-left text-xs font-medium leading-snug sm:max-w-none sm:px-4 sm:py-3 sm:text-sm">
                  Tréninky (přítomen)
                </th>
                <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">
                  Částka
                </th>
                <th className="whitespace-nowrap px-2 py-2 text-left text-xs font-medium sm:px-4 sm:py-3 sm:text-sm">
                  Platba
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paid.map((r) => (
                <tr key={r.playerId} className="bg-slate-50/40 text-slate-600">
                  <td className="min-w-0 break-words px-2 py-2.5 text-sm font-medium text-slate-700 sm:px-4 sm:py-3 sm:text-base">
                    {r.playerName}
                    <span className="ml-2 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-normal text-emerald-800">
                      zaplaceno
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-sm sm:px-4 sm:py-3 sm:text-base">
                    {r.sessionCount}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-sm sm:px-4 sm:py-3 sm:text-base">
                    {formatCzkFromCents(r.totalCents)}
                  </td>
                  <td className="align-middle px-2 py-2.5 sm:px-4 sm:py-3">
                    <PaymentMarkForms row={r} year={year} month={month} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Panel>
      )}

      <p className="text-xs text-slate-500">
        Docházku doplňuj u jednotlivých tréninků; částky podle zaškrtnutí „Přítomen“.
        Označení platby je jen pro přehled — účetní údaje si ověř u banky.
      </p>
    </div>
  );
}
