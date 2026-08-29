import type { ReviewStats } from "@/lib/review-stats";
import { czPlural } from "@/lib/czech";

/**
 * Rozpad zápisů po tlačítkách — kolikrát která akce padla a komu.
 *
 * „Pro nás / proti nám“ říká, jak zápas dopadl, ale ne proč. Na to je
 * tohle: když má klub tlačítka Hit counter slow, Hit counter fast a Hit
 * předhoz, teprve jejich poměr ukáže, co funguje. Jedna komponenta pro
 * trenéra i pro hráče, ať se čísla nerozejdou.
 */

const th =
  "border-b border-slate-200 px-2 py-1.5 font-heading text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-500";

function tonStrany(side: "FOR" | "AGAINST" | "NEUTRAL"): string {
  return side === "FOR"
    ? "text-emerald-800"
    : side === "AGAINST"
      ? "text-red-800"
      : "text-slate-700";
}

export function RozpadAkci({ stats }: { stats: ReviewStats }) {
  const radky = stats.balance.byType;
  const nejvic = Math.max(1, ...radky.map((t) => t.count));

  if (radky.length === 0) {
    return (
      <p className="text-sm italic text-slate-500">
        Zatím není co rozebírat — v rozboru nejsou žádné zápisy.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {radky.map((t) => (
        <li key={t.typeId} className="flex items-center gap-2.5">
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <i
              aria-hidden
              style={{ background: t.color }}
              className="inline-block h-1.5 w-1.5 shrink-0 rotate-45 rounded-[2px]"
            />
            <span className="min-w-0 truncate text-[13px] text-slate-700" title={t.label}>
              {t.label}
            </span>
          </span>
          {/* Pruh je tu kvůli poměru: čísla vedle sebe se na telefonu
              porovnávají špatně. */}
          <span
            aria-hidden
            className="hidden h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100 sm:block"
          >
            <span
              className="block h-full rounded-full"
              style={{ width: `${(t.count / nejvic) * 100}%`, background: t.color }}
            />
          </span>
          <span
            className={`w-7 shrink-0 text-right font-heading text-sm font-bold tabular-nums ${tonStrany(t.side)}`}
          >
            {t.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Hráči proti jednotlivým akcím. Sloupce jsou jen akce, které v zápase
 * padly — prázdné sloupce by tabulku jen rozšířily.
 */
export function HraciPodleAkci({
  stats,
  zvyraznit,
}: {
  stats: ReviewStats;
  /** Hráč, který se dívá — svůj řádek má najít bez hledání. */
  zvyraznit?: string;
}) {
  const sloupce = stats.balance.byType.filter((t) => t.count > 0);

  if (stats.players.length === 0) {
    return (
      <p className="text-xs italic text-slate-500">
        Zatím bez určených hráčů — zápisy jsou vedené za tým.
      </p>
    );
  }

  return (
    <>
      <div className="table-scroll-wrapper">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={`${th} text-left`}>Hráč</th>
              {sloupce.map((t) => (
                <th key={t.typeId} className={`${th} whitespace-nowrap text-right`} title={t.label}>
                  <span className="inline-flex items-center gap-1">
                    <i
                      aria-hidden
                      style={{ background: t.color }}
                      className="inline-block h-1.5 w-1.5 shrink-0 rotate-45 rounded-[2px]"
                    />
                    {t.label}
                  </span>
                </th>
              ))}
              <th className={`${th} whitespace-nowrap text-right`}>Rozdíl</th>
            </tr>
          </thead>
          <tbody>
            {stats.players.map((p) => (
              <tr
                key={p.playerId}
                className={`border-b border-slate-100 last:border-0 ${
                  p.playerId === zvyraznit ? "bg-club-soft" : ""
                }`}
              >
                <td className="whitespace-nowrap px-2 py-2 text-slate-800">
                  {p.playerName}
                  {p.playerId === zvyraznit && (
                    <span className="ml-1.5 text-[11px] text-club">ty</span>
                  )}
                </td>
                {sloupce.map((t) => {
                  const n = p.counts[t.typeId] ?? 0;
                  return (
                    <td
                      key={t.typeId}
                      className={`px-2 py-2 text-right tabular-nums ${
                        n === 0 ? "text-slate-400" : tonStrany(t.side)
                      }`}
                    >
                      {n}
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-right font-medium tabular-nums text-slate-800">
                  {p.diff > 0 ? `+${p.diff}` : p.diff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bez téhle věty čísla nesedí a nikdo nepozná proč. */}
      {stats.withoutPlayer > 0 && (
        <p className="mt-2.5 text-xs text-slate-500">
          Tabulka počítá jen zápisy s hráčem. {stats.withoutPlayer}{" "}
          {czPlural(stats.withoutPlayer, "zápis ho nemá", "zápisy ho nemají", "zápisů ho nemá")} —
          v přehledu nahoře jsou.
        </p>
      )}
    </>
  );
}
