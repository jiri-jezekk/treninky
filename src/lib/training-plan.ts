/**
 * Plán tréninku — časování bodů a rozdělení do týmů.
 *
 * Tahle část je čistý výpočet bez databáze, aby se dala testovat
 * a aby stejné rozdělení vyšlo na serveru i v prohlížeči.
 */

export type DrillKind = "WARMUP" | "DRILL" | "GAME" | "COOLDOWN";

export const DRILL_KIND_LABELS: Record<DrillKind, string> = {
  WARMUP: "Rozcvička",
  DRILL: "Cvičení",
  GAME: "Hra",
  COOLDOWN: "Závěr",
};

export const DRILL_KINDS: DrillKind[] = ["WARMUP", "DRILL", "GAME", "COOLDOWN"];

export function parseDrillKind(raw: unknown): DrillKind {
  const value = String(raw ?? "");
  return (DRILL_KINDS as string[]).includes(value) ? (value as DrillKind) : "DRILL";
}

/* ------------------------------------------------------------ časování */

export type PlanBlock = {
  id: string;
  minutes: number;
};

export type TimedBlock<T extends PlanBlock> = T & {
  /** Minuty od začátku tréninku. */
  offsetMinutes: number;
  startLabel: string;
  endLabel: string;
};

function addMinutesLabel(start: Date, minutes: number): string {
  const d = new Date(start.getTime() + minutes * 60_000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Doplní každému bodu, kdy začíná a končí. Body jdou po sobě od začátku
 * tréninku — trenér tak vidí „18:00 rozcvička, 18:10 nahrávky“ místo
 * pouhých délek, které si musí sčítat v hlavě.
 */
export function withTimes<T extends PlanBlock>(
  blocks: T[],
  startsAt: Date,
): TimedBlock<T>[] {
  let offset = 0;
  return blocks.map((b) => {
    const minutes = Math.max(0, b.minutes);
    const timed = {
      ...b,
      offsetMinutes: offset,
      startLabel: addMinutesLabel(startsAt, offset),
      endLabel: addMinutesLabel(startsAt, offset + minutes),
    };
    offset += minutes;
    return timed;
  });
}

export type PlanSummary = {
  plannedMinutes: number;
  /** Délka tréninku podle rozvrhu, null když se konec neeviduje. */
  availableMinutes: number | null;
  /** Kladné = zbývá, záporné = přesah. Null bez známé délky. */
  differenceMinutes: number | null;
};

export function summarizePlan(
  blocks: PlanBlock[],
  startsAt: Date,
  endsAt: Date | null,
): PlanSummary {
  const plannedMinutes = blocks.reduce((s, b) => s + Math.max(0, b.minutes), 0);
  if (!endsAt) {
    return { plannedMinutes, availableMinutes: null, differenceMinutes: null };
  }
  const availableMinutes = Math.round(
    (endsAt.getTime() - startsAt.getTime()) / 60_000,
  );
  return {
    plannedMinutes,
    availableMinutes,
    differenceMinutes: availableMinutes - plannedMinutes,
  };
}

/* --------------------------------------------------------------- týmy */

export type TeamAssignment = {
  name: string;
  playerIds: string[];
};

export const DEFAULT_TEAM_NAMES = ["Tým A", "Tým B", "Tým C", "Tým D"];

export function teamName(index: number): string {
  return DEFAULT_TEAM_NAMES[index] ?? `Tým ${index + 1}`;
}

/**
 * Přečte rozdělení uložené v JSON sloupci.
 *
 * Sloupec píše aplikace, ale číst se musí opatrně: hráč mezitím smazaný
 * ze soupisky by tu zůstal jako mrtvé id. `knownPlayerIds` proto takové
 * záznamy vyhodí.
 */
export function parseTeams(
  raw: unknown,
  knownPlayerIds?: Set<string>,
): TeamAssignment[] {
  if (!Array.isArray(raw)) return [];
  const teams: TeamAssignment[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    const name = typeof obj.name === "string" ? obj.name : teamName(teams.length);
    const ids = Array.isArray(obj.playerIds) ? obj.playerIds : [];
    const playerIds = ids
      .filter((id): id is string => typeof id === "string")
      .filter((id) => !knownPlayerIds || knownPlayerIds.has(id));
    teams.push({ name, playerIds });
  }

  return teams;
}

export type SplitPlayer = {
  id: string;
  /** Kategorie hráče — rozdělení je rozprostře, ať nejsou junioři v jednom týmu. */
  groupKey: string;
};

/**
 * Náhodné rozdělení do týmů, rovnoměrné napříč kategoriemi.
 *
 * Hráči se seřadí po kategoriích a rozdávají se „hadem“ (1-2-3-3-2-1).
 * Díky tomu vyjdou týmy stejně velké (±1) a žádná kategorie neskončí
 * celá v jednom z nich.
 *
 * `random` se dá podstrčit, aby šlo rozdělení otestovat.
 */
export function splitIntoTeams(
  players: SplitPlayer[],
  teamCount: number,
  random: () => number = Math.random,
): TeamAssignment[] {
  const count = Math.max(2, Math.min(4, Math.floor(teamCount)));
  const teams: TeamAssignment[] = Array.from({ length: count }, (_, i) => ({
    name: teamName(i),
    playerIds: [],
  }));
  if (players.length === 0) return teams;

  // Zamíchat v rámci kategorie, pak kategorie za sebe.
  const byGroup = new Map<string, string[]>();
  for (const p of players) {
    const list = byGroup.get(p.groupKey);
    if (list) list.push(p.id);
    else byGroup.set(p.groupKey, [p.id]);
  }

  const ordered: string[] = [];
  for (const ids of byGroup.values()) {
    ordered.push(...shuffle(ids, random));
  }

  let index = 0;
  for (const id of ordered) {
    const round = Math.floor(index / count);
    const withinRound = index % count;
    // Had: liché kolo se rozdává odzadu, jinak by první tým dostal
    // vždycky toho nejlepšího z každé kategorie.
    const team = round % 2 === 0 ? withinRound : count - 1 - withinRound;
    teams[team]!.playerIds.push(id);
    index++;
  }

  return teams;
}

/** Fisher–Yates. */
function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Přesune hráče do dalšího týmu v pořadí; z posledního zpátky mimo týmy. */
export function moveToNextTeam(
  teams: TeamAssignment[],
  playerId: string,
): TeamAssignment[] {
  const current = teams.findIndex((t) => t.playerIds.includes(playerId));
  const stripped = teams.map((t) => ({
    ...t,
    playerIds: t.playerIds.filter((id) => id !== playerId),
  }));

  // Mimo týmy → první tým; poslední tým → zase mimo.
  const next = current === -1 ? 0 : current + 1;
  if (next >= teams.length) return stripped;

  stripped[next]!.playerIds.push(playerId);
  return stripped;
}
