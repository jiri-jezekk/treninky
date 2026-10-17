/**
 * Vyrovnané týmy podle dovednosti.
 *
 * Čistý výpočet bez databáze — běží stejně na serveru i v telefonu
 * a dá se otestovat (`random` jde podstrčit).
 */
import { teamName, type TeamAssignment } from "./training-plan.ts";

export type BalancePlayer = {
  id: string;
  /** Dovednost 1–3. */
  skill: number;
};

export const SKILL_LEVELS = [1, 2, 3] as const;

export const SKILL_LABELS: Record<number, string> = {
  1: "Začátečník",
  2: "Střed",
  3: "Nejlepší",
};

/** Dovednost z formuláře; mimo rozsah se srovná na nejbližší platnou. */
export function parseSkill(raw: unknown): number {
  const n = Math.round(Number(String(raw ?? "").trim()));
  if (!Number.isFinite(n)) return 2;
  return Math.min(3, Math.max(1, n));
}

/** Součet dovedností každého týmu. Neznámý hráč se počítá jako 0. */
export function teamSkillSums(
  teams: TeamAssignment[],
  skillById: Map<string, number>,
): number[] {
  return teams.map((t) =>
    t.playerIds.reduce((s, id) => s + (skillById.get(id) ?? 0), 0),
  );
}

type Candidate = { teams: string[][]; spread: number; squares: number };

/**
 * Rozdělí hráče do `teamCount` týmů (2–4) tak, aby
 * 1. se velikosti týmů lišily nejvýš o jednoho hráče,
 * 2. součty dovedností byly co nejbližší (nejmenší rozdíl nejsilnějšího
 *    a nejslabšího týmu, pak nejmenší rozptyl),
 * 3. při více stejně dobrých rozděleních padlo náhodné — „zamíchat znovu“
 *    tak dává jiné týmy, ne pořád ty samé.
 *
 * Postup: mnohokrát hladově rozdat (od nejlepších, vždy do týmu s nejmenším
 * součtem) z náhodného pořadí a pak prohazovat dvojice mezi týmy, dokud to
 * rozdíl zmenšuje. Pro desítky hráčů je to okamžité a výsledek optimální
 * nebo velmi blízko.
 */
export function balanceTeams(
  players: BalancePlayer[],
  teamCount: number,
  random: () => number = Math.random,
  attempts = 200,
): TeamAssignment[] {
  const count = Math.max(2, Math.min(4, Math.floor(teamCount)));
  const skill = new Map(players.map((p) => [p.id, p.skill]));

  let best: Candidate[] = [];
  const seen = new Set<string>();

  for (let a = 0; a < attempts; a++) {
    const teams = improve(greedy(players, count, random), skill);
    const scored = score(teams, skill);
    const key = canonical(teams);

    const top = best[0];
    if (!top || better(scored, top)) {
      best = [scored];
      seen.clear();
      seen.add(key);
    } else if (same(scored, top) && !seen.has(key)) {
      best.push(scored);
      seen.add(key);
    }
  }

  const pick = best[Math.floor(random() * best.length)] ?? {
    teams: Array.from({ length: count }, () => []),
  };
  // Pořadí týmů zamíchat, ať „Tým A“ není vždycky ten s hráčem navíc.
  return shuffle(pick.teams, random).map((ids, i) => ({
    name: teamName(i),
    playerIds: ids,
  }));
}

function greedy(
  players: BalancePlayer[],
  count: number,
  random: () => number,
): string[][] {
  const base = Math.floor(players.length / count);
  const extra = players.length % count;
  // Kterým týmům připadne hráč navíc, rozhodne los.
  const capacity = shuffle(
    Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0)),
    random,
  );

  const teams: string[][] = Array.from({ length: count }, () => []);
  const sums = Array.from({ length: count }, () => 0);

  // Náhodné pořadí, pak stabilně od nejlepších — shodné dovednosti
  // tak přicházejí pokaždé v jiném pořadí.
  const ordered = shuffle(players, random).sort((x, y) => y.skill - x.skill);

  for (const p of ordered) {
    let target = -1;
    for (let i = 0; i < count; i++) {
      if (teams[i]!.length >= capacity[i]!) continue;
      if (
        target === -1 ||
        sums[i]! < sums[target]! ||
        (sums[i] === sums[target] && random() < 0.5)
      ) {
        target = i;
      }
    }
    teams[target]!.push(p.id);
    sums[target]! += p.skill;
  }
  return teams;
}

/** Prohazuje dvojice hráčů mezi týmy, dokud se tím rozdíl zlepšuje. */
function improve(teams: string[][], skill: Map<string, number>): string[][] {
  const t = teams.map((x) => [...x]);
  let current = score(t, skill);
  let changed = true;

  while (changed) {
    changed = false;
    for (let a = 0; a < t.length; a++) {
      for (let b = a + 1; b < t.length; b++) {
        for (let i = 0; i < t[a]!.length; i++) {
          for (let j = 0; j < t[b]!.length; j++) {
            const pa = t[a]![i]!;
            const pb = t[b]![j]!;
            if (skill.get(pa) === skill.get(pb)) continue;
            t[a]![i] = pb;
            t[b]![j] = pa;
            const next = score(t, skill);
            if (better(next, current)) {
              current = next;
              changed = true;
            } else {
              t[a]![i] = pa;
              t[b]![j] = pb;
            }
          }
        }
      }
    }
  }
  return t;
}

function score(teams: string[][], skill: Map<string, number>): Candidate {
  const sums = teams.map((ids) => ids.reduce((s, id) => s + (skill.get(id) ?? 0), 0));
  const mean = sums.reduce((s, x) => s + x, 0) / Math.max(1, sums.length);
  return {
    teams: teams.map((x) => [...x]),
    spread: Math.max(...sums) - Math.min(...sums),
    squares: sums.reduce((s, x) => s + (x - mean) ** 2, 0),
  };
}

function better(a: Candidate, b: Candidate): boolean {
  if (a.spread !== b.spread) return a.spread < b.spread;
  return a.squares < b.squares - 1e-9;
}

function same(a: Candidate, b: Candidate): boolean {
  return a.spread === b.spread && Math.abs(a.squares - b.squares) < 1e-9;
}

/** Stejné rozdělení zapsané jinak (jiné pořadí) má stejný klíč. */
function canonical(teams: string[][]): string {
  return teams
    .map((t) => [...t].sort().join(","))
    .sort()
    .join("|");
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
