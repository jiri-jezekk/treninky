import Link from "next/link";
import {
  buildStatistikyHref,
  lastNMonthsPeriod,
  previousMonthPeriod,
} from "@/lib/statistics-period";

const INPUT_CLASS =
  "mt-1.5 block w-full min-w-0 max-w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 tabular-nums outline-none focus:border-club sm:max-w-[11rem]";

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";

const presetCls =
  "rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900";

const presetActiveCls =
  "rounded-full border border-club-line bg-club-soft px-3 py-1 text-xs text-slate-900";

export type SeasonPreset = {
  name: string;
  odIso: string;
  doIso: string;
};

export function StatisticsPeriodControls({
  odIso,
  doIso,
  skupina,
  seasons = [],
}: {
  odIso: string;
  doIso: string;
  /** Id vybrané kategorie, nebo null pro všechny. */
  skupina: string | null;
  /** Sezóny z číselníku — nabízejí se jako rychlá volba období. */
  seasons?: SeasonPreset[];
}) {
  const base = "/statistiky";
  const prev = previousMonthPeriod();
  const thisMonth = lastNMonthsPeriod(1);
  const last12 = lastNMonthsPeriod(12);

  /** Zvýrazní volbu, která odpovídá právě zobrazenému období. */
  const isActive = (od: string, doo: string) => od === odIso && doo === doIso;

  return (
    <div className="space-y-4">
      <form
        method="get"
        action={base}
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        {skupina ? <input type="hidden" name="skupina" value={skupina} /> : null}
        <label className={label}>
          Od
          <input
            type="date"
            name="od"
            defaultValue={odIso}
            className={INPUT_CLASS}
            required
          />
        </label>
        <label className={label}>
          Do
          <input
            type="date"
            name="do"
            defaultValue={doIso}
            className={INPUT_CLASS}
            required
          />
        </label>
        <button
          type="submit"
          className="inline-flex items-center rounded-full border-2 border-slate-300 px-4 py-2 font-heading text-sm font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft"
        >
          Použít
        </button>
      </form>

      <nav className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Rychle:</span>
        <Link
          href={buildStatistikyHref(base, { skupina })}
          className={
            isActive(thisMonth.odIso, thisMonth.doIso) ? presetActiveCls : presetCls
          }
        >
          Tento měsíc
        </Link>
        <Link
          href={buildStatistikyHref(base, {
            skupina,
            od: prev.odIso,
            do: prev.doIso,
          })}
          className={isActive(prev.odIso, prev.doIso) ? presetActiveCls : presetCls}
        >
          Předchozí měsíc
        </Link>
        {seasons.map((s) => (
          <Link
            key={s.name}
            href={buildStatistikyHref(base, {
              skupina,
              od: s.odIso,
              do: s.doIso,
            })}
            className={isActive(s.odIso, s.doIso) ? presetActiveCls : presetCls}
          >
            {s.name}
          </Link>
        ))}
        <Link
          href={buildStatistikyHref(base, {
            skupina,
            od: last12.odIso,
            do: last12.doIso,
          })}
          className={isActive(last12.odIso, last12.doIso) ? presetActiveCls : presetCls}
        >
          12 měsíců
        </Link>
      </nav>
    </div>
  );
}
