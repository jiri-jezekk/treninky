import Link from "next/link";
import { getAccountingSummary, INCOME_KINDS } from "@/lib/accounting";
import { INCOME_KIND_LABELS } from "@/lib/player-balance";
import { formatCzkFromCents } from "@/lib/money";
import { formatDateDdMmYyyy } from "@/lib/date-display";
import { formatMonthLabelCs } from "@/lib/training-pricing";
import { requireUserId } from "@/lib/session";

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";

export default async function UcetnictviPage({
  searchParams,
}: {
  searchParams: Promise<{ rok?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;

  const parsed = Number.parseInt(sp.rok ?? "", 10);
  const year =
    Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100
      ? parsed
      : new Date().getFullYear();

  const summary = await getAccountingSummary(userId, year);
  const usedKinds = INCOME_KINDS.filter((k) => summary.byKind[k] > 0);
  const kinds = usedKinds.length > 0 ? usedKinds : (["TRAINING"] as const);

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-extrabold uppercase tracking-wide text-slate-800">
            Pro účetní
          </h1>
          <div className="mt-3 h-1 w-14 rounded bg-club" />
          <p className="mt-3 max-w-prose text-sm text-slate-600">
            Přijaté platby za rok {year} podle druhu příjmu. Řadí se podle data, kdy
            platba dorazila — spolek vede peněžní deník, takže rozhoduje okamžik
            přijetí, ne měsíc, kterého se platba týká.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/platby/ucetnictvi?rok=${year - 1}`}
            className="grid h-9 w-9 place-items-center rounded-full border-2 border-slate-300 text-slate-600 transition hover:border-club hover:bg-club-soft"
            aria-label="Předchozí rok"
          >
            ←
          </Link>
          <span className="min-w-[5ch] text-center font-heading text-lg font-extrabold text-slate-800">
            {year}
          </span>
          <Link
            href={`/platby/ucetnictvi?rok=${year + 1}`}
            className="grid h-9 w-9 place-items-center rounded-full border-2 border-slate-300 text-slate-600 transition hover:border-club hover:bg-club-soft"
            aria-label="Další rok"
          >
            →
          </Link>
          <a
            href={`/platby/ucetnictvi/export?rok=${year}`}
            className="ml-2 inline-flex items-center gap-2 rounded-full border-2 border-club bg-club px-4 py-2 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover"
          >
            Stáhnout CSV
          </a>
        </div>
      </div>

      <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-100 pb-5">
        <Link
          href="/platby"
          className="inline-flex items-center rounded-full border-2 border-slate-300 px-5 py-2 font-heading text-sm font-semibold text-slate-600 transition hover:border-club hover:bg-club-soft"
        >
          ← Zpět na Platby
        </Link>
      </nav>

      <dl className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <dt className={label}>Přijato celkem</dt>
          <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-emerald-800">
            {formatCzkFromCents(summary.total)}
          </dd>
        </div>
        {kinds.slice(0, 3).map((k) => (
          <div key={k} className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <dt className={label}>{INCOME_KIND_LABELS[k]}</dt>
            <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-slate-800">
              {formatCzkFromCents(summary.byKind[k])}
            </dd>
          </div>
        ))}
      </dl>

      <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <h2 className={`border-b border-slate-100 px-5 py-3 ${label}`}>
          Po měsících
        </h2>
        <div className="table-scroll-wrapper">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-club bg-slate-50">
                <th className={`px-4 py-3 ${label}`}>Měsíc</th>
                {kinds.map((k) => (
                  <th key={k} className={`px-4 py-3 text-right ${label}`}>
                    {INCOME_KIND_LABELS[k]}
                  </th>
                ))}
                <th className={`px-4 py-3 text-right ${label}`}>Celkem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.months
                .filter((m) => m.total > 0)
                .map((m) => (
                  <tr key={m.month} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-800">
                      {formatMonthLabelCs(year, m.month)}
                    </td>
                    {kinds.map((k) => (
                      <td
                        key={k}
                        className="px-4 py-3 text-right tabular-nums text-slate-600"
                      >
                        {m.byKind[k] > 0 ? formatCzkFromCents(m.byKind[k]) : "—"}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-heading font-bold tabular-nums text-slate-800">
                      {formatCzkFromCents(m.total)}
                    </td>
                  </tr>
                ))}
              {summary.total === 0 && (
                <tr>
                  <td
                    colSpan={kinds.length + 2}
                    className="px-4 py-12 text-center text-sm italic text-slate-500"
                  >
                    V roce {year} nebyla přijata žádná platba.
                  </td>
                </tr>
              )}
            </tbody>
            {summary.total > 0 && (
              <tfoot>
                <tr className="border-t-2 border-club bg-slate-50">
                  <td className="px-4 py-3 font-heading font-bold text-slate-800">
                    Celkem {year}
                  </td>
                  {kinds.map((k) => (
                    <td
                      key={k}
                      className="px-4 py-3 text-right font-heading font-bold tabular-nums text-slate-800"
                    >
                      {formatCzkFromCents(summary.byKind[k])}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-heading font-extrabold tabular-nums text-emerald-800">
                    {formatCzkFromCents(summary.total)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <h2 className={`border-b border-slate-100 px-5 py-3 ${label}`}>
          Jednotlivé platby ({summary.entries.length})
        </h2>
        <div className="table-scroll-wrapper">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-club bg-slate-50">
                <th className={`px-4 py-3 ${label}`}>Datum</th>
                <th className={`px-4 py-3 ${label}`}>Hráč</th>
                <th className={`px-4 py-3 ${label}`}>Za co</th>
                <th className={`px-4 py-3 ${label}`}>Druh příjmu</th>
                <th className={`px-4 py-3 ${label}`}>VS</th>
                <th className={`px-4 py-3 text-right ${label}`}>Částka</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.entries.map((e, i) => (
                <tr key={`${e.variableSymbol}-${i}`} className="transition hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">
                    {formatDateDdMmYyyy(e.paidAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-800">{e.playerName}</td>
                  <td className="px-4 py-3 text-slate-600">{e.label}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {INCOME_KIND_LABELS[e.kind]}
                  </td>
                  <td className="px-4 py-3 font-heading text-xs tabular-nums text-slate-500">
                    {e.variableSymbol}
                  </td>
                  <td className="px-4 py-3 text-right font-heading font-bold tabular-nums text-slate-800">
                    {formatCzkFromCents(e.amountCents)}
                  </td>
                </tr>
              ))}
              {summary.entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm italic text-slate-500">
                    Zatím nic.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-6 text-xs leading-relaxed text-slate-500">
        Částky u měsíčních tréninků se dopočítávají z docházky a sazeb platných teď.
        Když zpětně změníte sazbu kategorie, změní se i tento přehled — pro uzávěrku
        si proto CSV stáhněte a uložte.
      </p>
    </div>
  );
}
