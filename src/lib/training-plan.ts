/**
 * Plán tréninku — časování bodů a rozdělení do týmů.
 *
 * Tahle část je čistý výpočet bez databáze, aby se dala testovat
 * a aby stejné rozdělení vyšlo na serveru i v prohlížeči.
 */

/** Části tréninku v pořadí, v jakém jdou za sebou a píšou se do deníku. */
export type DrillKind =
  | "WARMUP"
  | "MOVEMENT_GAME"
  | "GAME_DRILL"
  | "PREP_GAME"
  | "PREP_DRILL"
  | "COOLDOWN";

export const DRILL_KIND_LABELS: Record<DrillKind, string> = {
  WARMUP: "Rozcvička",
  MOVEMENT_GAME: "Pohybová hra",
  GAME_DRILL: "Herní cvičení",
  PREP_GAME: "Průpravná hra",
  PREP_DRILL: "Průpravné cvičení",
  COOLDOWN: "Závěrečné uvolnění",
};

export const DRILL_KINDS: DrillKind[] = [
  "WARMUP",
  "MOVEMENT_GAME",
  "GAME_DRILL",
  "PREP_GAME",
  "PREP_DRILL",
  "COOLDOWN",
];

export const DEFAULT_DRILL_KIND: DrillKind = "GAME_DRILL";

export function parseDrillKind(raw: unknown): DrillKind {
  const value = String(raw ?? "");
  return (DRILL_KINDS as string[]).includes(value)
    ? (value as DrillKind)
    : DEFAULT_DRILL_KIND;
}

/** U her a herních cvičení se nabízí rozdělení do týmů. */
export function isTeamKind(kind: DrillKind): boolean {
  return kind === "MOVEMENT_GAME" || kind === "GAME_DRILL" || kind === "PREP_GAME";
}

/* ------------------------------------------------------------ knihovna */

/**
 * Štítky z formuláře — píšou se za čárku. Prázdné se zahodí a stejný
 * štítek jinými písmeny („Hra“, „hra“) se nechá jen jednou.
 */
export function parseTags(raw: unknown): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of String(raw ?? "").split(",")) {
    const tag = part.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!tag) continue;
    const key = tag.toLocaleLowerCase("cs");
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

/** Hodí se cvičení pro kategorii? Bez zadaných kategorií se hodí pro všechny. */
export function suitsGroup(
  drill: { groupIds: string[] },
  groupId: string | null,
): boolean {
  return groupId == null || drill.groupIds.length === 0 || drill.groupIds.includes(groupId);
}

/**
 * Pořadí nabídky při vkládání do plánu: nejdřív cvičení určená přímo
 * pro kategorii plánu, pak obecná, nakonec ta pro jiné kategorie.
 * Uvnitř skupiny zůstává pořadí, v jakém přišla (druh, název).
 */
export function sortDrillsForGroup<T extends { groupIds: string[] }>(
  drills: T[],
  groupId: string | null,
): T[] {
  if (groupId == null) return [...drills];
  const rank = (d: T) =>
    d.groupIds.includes(groupId) ? 0 : d.groupIds.length === 0 ? 1 : 2;
  return drills
    .map((d, i) => ({ d, i }))
    .sort((a, b) => rank(a.d) - rank(b.d) || a.i - b.i)
    .map((x) => x.d);
}

/* ------------------------------------------------------------ šablony */

export type TemplateBlock = {
  title: string;
  focus: string | null;
  notes: string | null;
  minutes: number;
  kind: DrillKind;
  /** Cvičení z knihovny; při použití se ověří, že pořád existuje. */
  drillId: string | null;
};

/**
 * Přečte body šablony z JSON sloupce. Píše ho aplikace, ale čte se
 * opatrně — nesmyslné položky se vynechají, chybějící hodnoty doplní.
 */
export function parseTemplateBlocks(raw: unknown): TemplateBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: TemplateBlock[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!title) continue;
    const minutes = Number(o.minutes);
    out.push({
      title,
      focus: typeof o.focus === "string" && o.focus.trim() ? o.focus.trim() : null,
      notes: typeof o.notes === "string" && o.notes.trim() ? o.notes.trim() : null,
      minutes:
        Number.isFinite(minutes) && minutes > 0 ? Math.min(600, Math.round(minutes)) : 10,
      kind: parseDrillKind(o.kind),
      drillId: typeof o.drillId === "string" && o.drillId ? o.drillId : null,
    });
  }
  return out;
}

/** Hodnocení bodu z formuláře: 1, -1, jinak bez hodnocení. */
export function parseRating(raw: unknown): 1 | -1 | null {
  const n = Number(raw);
  return n === 1 ? 1 : n === -1 ? -1 : null;
}

/* ------------------------------------------------------ deník (DDM) */

/**
 * Shrnutí plánu do deníku DDM — jeden bod na řádek, „název - zaměření“.
 * Bez data, časů a minut: deník má na náplň jedno textové pole a trenér
 * do něj píše jen, co se dělalo.
 *
 * Když zaměření už v názvu je („Hra - protiútok“ se zaměřením „protiútok“),
 * znovu se nepřidává.
 */
export function diarySummary(
  blocks: { title: string; focus: string | null }[],
): string {
  return blocks
    .map((b) => {
      const title = b.title.trim();
      const focus = b.focus?.trim() ?? "";
      if (!focus || title.toLowerCase().includes(focus.toLowerCase())) return title;
      return `${title} - ${focus}`;
    })
    .filter(Boolean)
    .join("\n");
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
