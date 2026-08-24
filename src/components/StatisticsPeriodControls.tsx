import Link from "next/link";
import {
  buildStatistikyHref,
  lastNMonthsPeriod,
  previousMonthPeriod,
} from "@/lib/statistics-period";

const INPUT_CLASS =
  "mt-1 block w-full min-w-0 max-w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums sm:max-w-[11rem]";

const presetCls =
  "rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-800";

export function StatisticsPeriodControls({
  odIso,
  doIso,
  skupina,
}: {
  odIso: string;
  doIso: string;
  /** Id vybrané kategorie, nebo null pro všechny. */
  skupina: string | null;
}) {
  const base = "/statistiky";
  const prev = previousMonthPeriod();
  const last12 = lastNMonthsPeriod(12);
  const season = lastNMonthsPeriod(10);

  return (
    <div className="space-y-4">
      <form
        method="get"
        action={base}
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        {skupina ? <input type="hidden" name="skupina" value={skupina} /> : null}
        <label className="text-sm text-slate-600">
          Od
          <input type="date" name="od" defaultValue={odIso} className={INPUT_CLASS} required />
        </label>
        <label className="text-sm text-slate-600">
          Do
          <input type="date" name="do" defaultValue={doIso} className={INPUT_CLASS} required />
        </label>
        <button
          type="submit"
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
        >
          Použít
        </button>
      </form>
      <nav className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Rychle:</span>
        <Link href={buildStatistikyHref(base, { skupina })} className={presetCls}>
          Tento měsíc
        </Link>
        <Link
          href={buildStatistikyHref(base, {
            skupina,
            od: prev.odIso,
            do: prev.doIso,
          })}
          className={presetCls}
        >
          Předchozí měsíc
        </Link>
        <Link
          href={buildStatistikyHref(base, {
            skupina,
            od: last12.odIso,
            do: last12.doIso,
          })}
          className={presetCls}
        >
          Posledních 12 měsíců
        </Link>
        <Link
          href={buildStatistikyHref(base, {
            skupina,
            od: season.odIso,
            do: season.doIso,
          })}
          className={presetCls}
          title="Přibližně jedna sportovní sezóna (10 měsíců zpět od dneška)"
        >
          ~Sezóna (10 měs.)
        </Link>
      </nav>
    </div>
  );
}
