/**
 * Výpočty nad zápisy z rozboru.
 *
 * Čistá funkce bez databáze, aby šla otestovat — a hlavně aby stejná
 * čísla vycházela v aplikaci trenéra i v odkazu hráče. Kdyby si to
 * každá stránka počítala po svém, dřív nebo později by ukazovaly
 * něco jiného.
 *
 * Relativní cesty schválně: tenhle soubor spouští i kontrolní skript
 * mimo Next.js, kde alias @/ neexistuje.
 */

/** Jak se akce počítá — do našeho sloupce, soupeřova, nebo mimo. */
export type ReviewSideValue = "FOR" | "AGAINST" | "NEUTRAL";

export type StatEvent = {
  id: string;
  typeId: string;
  atSeconds: number;
  playerId: string | null;
  playerName: string | null;
};

export type StatType = {
  id: string;
  label: string;
  color: string;
  side: ReviewSideValue;
  sortOrder: number;
  archived: boolean;
};

export type TypeCount = {
  typeId: string;
  label: string;
  color: string;
  side: ReviewSideValue;
  count: number;
};

export type Balance = {
  /** Kolik akcí padlo na naši stranu. */
  forCount: number;
  againstCount: number;
  neutralCount: number;
  /** Rozdíl pro − proti. Kladné číslo znamená navrch. */
  diff: number;
  total: number;
  /** Po typech, v pořadí tlačítek. Archivované typy tu jsou taky,
   *  pokud na ně nějaký zápis odkazuje — jinak by čísla nesedla. */
  byType: TypeCount[];
};

export type PlayerRow = {
  playerId: string;
  playerName: string;
  forCount: number;
  againstCount: number;
  diff: number;
  total: number;
  /** Počty po typech, ve stejném pořadí jako `Balance.byType`. */
  counts: Record<string, number>;
};

export type ReviewStats = {
  balance: Balance;
  players: PlayerRow[];
  /**
   * Zápisy bez hráče. Do tabulky hráčů nespadnou, ale v týmové bilanci
   * jsou — bez téhle informace by čísla nesedla a nikdo by nepoznal proč.
   */
  withoutPlayer: number;
};

export function computeStats(
  events: StatEvent[],
  types: StatType[],
): ReviewStats {
  const typeById = new Map(types.map((t) => [t.id, t]));

  // Pořadí tlačítek, archivované na konec — ať se sloupce nepřehazují
  // podle toho, co kdo zrovna naklikal.
  const poradi = [...types].sort(
    (a, b) =>
      Number(a.archived) - Number(b.archived) ||
      a.sortOrder - b.sortOrder ||
      a.label.localeCompare(b.label, "cs"),
  );

  const pocty = new Map<string, number>();
  let forCount = 0;
  let againstCount = 0;
  let neutralCount = 0;
  let withoutPlayer = 0;

  const hraci = new Map<string, PlayerRow>();

  for (const e of events) {
    const t = typeById.get(e.typeId);
    // Zápis na neznámý typ se nepočítá nikam — data by lhala.
    if (!t) continue;

    pocty.set(e.typeId, (pocty.get(e.typeId) ?? 0) + 1);
    if (t.side === "FOR") forCount++;
    else if (t.side === "AGAINST") againstCount++;
    else neutralCount++;

    if (!e.playerId) {
      withoutPlayer++;
      continue;
    }

    let row = hraci.get(e.playerId);
    if (!row) {
      row = {
        playerId: e.playerId,
        playerName: e.playerName ?? "Smazaný hráč",
        forCount: 0,
        againstCount: 0,
        diff: 0,
        total: 0,
        counts: {},
      };
      hraci.set(e.playerId, row);
    }
    row.total++;
    row.counts[e.typeId] = (row.counts[e.typeId] ?? 0) + 1;
    if (t.side === "FOR") row.forCount++;
    else if (t.side === "AGAINST") row.againstCount++;
  }

  for (const row of hraci.values()) {
    row.diff = row.forCount - row.againstCount;
  }

  const byType: TypeCount[] = poradi
    // Archivovaný typ má smysl ukazovat, jen když na něj něco visí.
    .filter((t) => !t.archived || (pocty.get(t.id) ?? 0) > 0)
    .map((t) => ({
      typeId: t.id,
      label: t.label,
      color: t.color,
      side: t.side,
      count: pocty.get(t.id) ?? 0,
    }));

  const players = [...hraci.values()].sort(
    (a, b) =>
      b.diff - a.diff ||
      b.total - a.total ||
      a.playerName.localeCompare(b.playerName, "cs"),
  );

  return {
    balance: {
      forCount,
      againstCount,
      neutralCount,
      diff: forCount - againstCount,
      total: forCount + againstCount + neutralCount,
      byType,
    },
    players,
    withoutPlayer,
  };
}

/**
 * Zápisy seřazené podle času ve videu, nejnovější akce dole.
 * Při shodném čase rozhoduje pořadí zápisu — pět kliknutí během
 * jedné sekundy má zůstat v tom pořadí, v jakém se stalo.
 */
export function sortByTime<T extends { atSeconds: number; id: string }>(
  events: T[],
): T[] {
  return [...events].sort((a, b) => a.atSeconds - b.atSeconds || a.id.localeCompare(b.id));
}
