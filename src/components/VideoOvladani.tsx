"use client";

/**
 * Ovládání pod videem: krok po pár sekundách, spuštění a rychlost.
 *
 * Vlastní tlačítka proto, že rozbor se kouká jinak než film — pořád
 * dokola o pět sekund zpátky a zpomaleně. Klikat se do YouTube lišty
 * na telefonu nedá přesně a klávesové zkratky tam nejsou.
 */

export const RYCHLOSTI = [0.5, 1, 1.5] as const;

const tl =
  "rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12.5px] text-slate-700 transition hover:bg-slate-100 hover:text-slate-800";

export function VideoOvladani({
  bezi,
  rychlost,
  onKrok,
  onPrehrat,
  onRychlost,
}: {
  bezi: boolean;
  rychlost: number;
  onKrok: (sekundy: number) => void;
  onPrehrat: () => void;
  onRychlost: (r: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" className={tl} onClick={() => onKrok(-5)} aria-label="O pět sekund zpět">
        ‹ 5 s
      </button>
      <button type="button" className={tl} onClick={onPrehrat} aria-label={bezi ? "Pauza" : "Přehrát"}>
        {bezi ? "❚❚" : "▶"}
      </button>
      <button type="button" className={tl} onClick={() => onKrok(5)} aria-label="O pět sekund vpřed">
        5 s ›
      </button>

      <span className="flex-1" />

      {RYCHLOSTI.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={Math.abs(rychlost - r) < 0.01}
          onClick={() => onRychlost(r)}
          className={`rounded-full border px-2 py-0.5 text-[11.5px] tabular-nums transition ${
            Math.abs(rychlost - r) < 0.01
              ? "border-club-line bg-club-soft font-medium text-club"
              : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
        >
          {String(r).replace(".", ",")}×
        </button>
      ))}
    </div>
  );
}
