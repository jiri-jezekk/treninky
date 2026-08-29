import { computeStats, type ReviewStats, type StatEvent, type StatType } from "./review-stats.ts";

/**
 * Souhrn napříč rozbory.
 *
 * Jeden zápas říká, jak dopadl. Teprve pět zápasů ukáže, jestli se
 * něco lepší — a to je otázka, kvůli které se rozbory vůbec dělají.
 *
 * Počítá se přes `computeStats`, ne vlastní sčítačkou: kdyby souhrn
 * počítal po svém, dřív nebo později by ukazoval jiná čísla než
 * jednotlivý rozbor a nikdo by nepoznal, které je správné.
 *
 * Relativní cesta u importu schválně — spouští to i kontrolní skript
 * mimo Next.js, kde alias @/ neexistuje.
 */

export type RozborKeSouhrnu = {
  id: string;
  name: string;
  opponent: string | null;
  /** Předformátované datum; lib se nestará o lokalizaci. */
  playedOnLabel: string;
  events: StatEvent[];
};

export type ZapasVSouhrnu = {
  id: string;
  name: string;
  opponent: string | null;
  playedOnLabel: string;
  forCount: number;
  againstCount: number;
  diff: number;
  total: number;
};

export type Souhrn = {
  /** Zápasy v pořadí, v jakém přišly (stránka je řadí od nejnovějšího). */
  zapasy: ZapasVSouhrnu[];
  /** Všechny zápisy dohromady — rozpad, skupiny i hráči. */
  celkem: ReviewStats;
  /** Kolik zápasů se do souhrnu počítá. */
  pocetZapasu: number;
};

export function souhrnRozboru(
  rozbory: RozborKeSouhrnu[],
  types: StatType[],
): Souhrn {
  const zapasy = rozbory.map((r) => {
    const s = computeStats(r.events, types);
    return {
      id: r.id,
      name: r.name,
      opponent: r.opponent,
      playedOnLabel: r.playedOnLabel,
      forCount: s.balance.forCount,
      againstCount: s.balance.againstCount,
      diff: s.balance.diff,
      total: s.balance.total,
    };
  });

  return {
    zapasy,
    celkem: computeStats(
      rozbory.flatMap((r) => r.events),
      types,
    ),
    pocetZapasu: rozbory.length,
  };
}

/** Řádek souhrnu jednoho hráče — pro jeho vlastní přehled v portálu. */
export type MujSouhrn = {
  zapasu: number;
  zapisu: number;
  forCount: number;
  againstCount: number;
  diff: number;
  /** Po typech, jen ty, co se ho týkají. */
  akce: { label: string; color: string; count: number }[];
};

export function mujSouhrn(souhrn: Souhrn, playerId: string): MujSouhrn | null {
  const radek = souhrn.celkem.players.find((p) => p.playerId === playerId);
  if (!radek) return null;

  const akce = souhrn.celkem.balance.byType
    .map((t) => ({ label: t.label, color: t.color, count: radek.counts[t.typeId] ?? 0 }))
    .filter((a) => a.count > 0);

  return {
    zapasu: souhrn.pocetZapasu,
    zapisu: radek.total,
    forCount: radek.forCount,
    againstCount: radek.againstCount,
    diff: radek.diff,
    akce,
  };
}
