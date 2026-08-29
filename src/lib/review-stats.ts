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
  /**
   * Nadřazená skupina (HIT, DEAD…). Prázdné = tlačítko stojí samo.
   * Kvůli vyhodnocení: podíl uvnitř skupiny říká víc než holý počet.
   */
  groupLabel?: string | null;
  /**
   * Podskupina uvnitř skupiny (counter, z útoku…). „Hit counter fast“
   * a „Hit counter slow“ je tentýž herní moment zahraný jinak; teprve
   * jejich součet řekne, kolik hitů padlo z counteru.
   */
  subLabel?: string | null;
};

export type TypeCount = {
  typeId: string;
  label: string;
  color: string;
  side: ReviewSideValue;
  count: number;
  /** Podíl uvnitř skupiny, 0–1. Bez skupiny podíl na všech zápisech. */
  share: number;
};

/** Podskupina uvnitř skupiny. `name === null` = tlačítka bez podskupiny. */
export type SubCount = {
  name: string | null;
  total: number;
  /** Podíl na skupině, 0–1 — „z hitů bylo 61 % z counteru“. */
  share: number;
  types: TypeCount[];
};

/** Skupina tlačítek. `name === null` jsou tlačítka bez skupiny. */
export type GroupCount = {
  name: string | null;
  total: number;
  types: TypeCount[];
  /** Totéž po podskupinách; bez podskupiny je jediná s name === null. */
  subs: SubCount[];
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
  /** Totéž seskupené. Skupiny v pořadí prvního výskytu, bez skupiny na konci. */
  byGroup: GroupCount[];
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

/** Prázdný název skupiny je totéž co žádná — ať nevzniknou dvě „nic“. */
function klicSkupiny(groupLabel: string | null | undefined): string | null {
  const s = (groupLabel ?? "").trim();
  return s === "" ? null : s;
}

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

  const vPrehledu = poradi
    // Archivovaný typ má smysl ukazovat, jen když na něj něco visí.
    .filter((t) => !t.archived || (pocty.get(t.id) ?? 0) > 0);

  // Součty skupin se počítají dřív než podíly — čte se totiž podíl
  // uvnitř skupiny („z našich hitů byla polovina fast“). Tlačítko
  // bez skupiny se poměřuje se všemi zápisy.
  const soucetSkupin = new Map<string | null, number>();
  for (const t of vPrehledu) {
    const klic = klicSkupiny(t.groupLabel);
    soucetSkupin.set(klic, (soucetSkupin.get(klic) ?? 0) + (pocty.get(t.id) ?? 0));
  }
  const celkem = forCount + againstCount + neutralCount;

  const byType: TypeCount[] = vPrehledu.map((t) => {
    const klic = klicSkupiny(t.groupLabel);
    const count = pocty.get(t.id) ?? 0;
    const zaklad = klic == null ? celkem : (soucetSkupin.get(klic) ?? 0);
    return {
      typeId: t.id,
      label: t.label,
      color: t.color,
      side: t.side,
      count,
      share: zaklad > 0 ? count / zaklad : 0,
    };
  });

  // Skupiny v pořadí prvního výskytu, tlačítka bez skupiny na konci —
  // jinak by se pořadí přehazovalo podle toho, co kdo naklikal.
  const skupiny = new Map<string | null, GroupCount>();
  const podskupiny = new Map<string, SubCount>();
  for (let i = 0; i < vPrehledu.length; i++) {
    const klic = klicSkupiny(vPrehledu[i]!.groupLabel);
    let g = skupiny.get(klic);
    if (!g) {
      g = { name: klic, total: 0, types: [], subs: [] };
      skupiny.set(klic, g);
    }
    const radek = byType[i]!;
    g.types.push(radek);
    g.total += radek.count;

    // Podskupina žije uvnitř skupiny: „counter“ v HIT a „counter“
    // v DEAD jsou dvě různé věci a sečíst se nesmí.
    const podKlic = klicSkupiny(vPrehledu[i]!.subLabel);
    const mapaKlic = `${klic ?? ""}\u0000${podKlic ?? ""}`;
    let sub = podskupiny.get(mapaKlic);
    if (!sub) {
      sub = { name: podKlic, total: 0, share: 0, types: [] };
      podskupiny.set(mapaKlic, sub);
      g.subs.push(sub);
    }
    sub.types.push(radek);
    sub.total += radek.count;
  }

  // Podíly podskupin až nakonec, když jsou známé součty skupin.
  // Podskupina bez názvu jde na konec, jako tlačítka bez skupiny.
  for (const g of skupiny.values()) {
    for (const sub of g.subs) {
      sub.share = g.total > 0 ? sub.total / g.total : 0;
    }
    g.subs.sort((a, b) => Number(a.name == null) - Number(b.name == null));
  }
  const byGroup = [...skupiny.values()].sort(
    (a, b) => Number(a.name == null) - Number(b.name == null),
  );

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
      total: celkem,
      byType,
      byGroup,
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
