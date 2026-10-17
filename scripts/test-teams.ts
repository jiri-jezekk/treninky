/**
 * Kontrola generátoru vyrovnaných týmů.
 *
 * Spuštění: npm run check:teams
 */
import {
  balanceTeams,
  parseSkill,
  teamSkillSums,
  type BalancePlayer,
} from "../src/lib/team-balance.ts";

let failures = 0;
function eq(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) {
    console.log(`  ok   ${label}`);
  } else {
    console.log(`  FAIL ${label} — čekal ${b}, dostal ${a}`);
    failures++;
  }
}

/** Opakovatelná „náhoda“ pro testy. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function players(skills: number[]): BalancePlayer[] {
  return skills.map((skill, i) => ({ id: `p${i}`, skill }));
}

function check(skills: number[], count: number, seed: number) {
  const ps = players(skills);
  const teams = balanceTeams(ps, count, seeded(seed));
  const skill = new Map(ps.map((p) => [p.id, p.skill]));
  const sums = teamSkillSums(teams, skill);
  const sizes = teams.map((t) => t.playerIds.length);
  const all = teams.flatMap((t) => t.playerIds).sort();
  return {
    teams,
    sums,
    sizes,
    spread: Math.max(...sums) - Math.min(...sums),
    sizeSpread: Math.max(...sizes) - Math.min(...sizes),
    everyoneOnce: JSON.stringify(all) === JSON.stringify(ps.map((p) => p.id).sort()),
  };
}

console.log("Základ:");
{
  const r = check([3, 3, 2, 2, 1, 1], 2, 1);
  eq("každý právě jednou", r.everyoneOnce, true);
  eq("stejně velké týmy", r.sizes, [3, 3]);
  eq("součty 6 a 6", r.sums, [6, 6]);
}
{
  const r = check([3, 3, 3, 1, 1], 2, 2);
  eq("lichý počet: velikosti 3 a 2", [...r.sizes].sort(), [2, 3]);
  eq("lichý počet: rozdíl součtů 1", r.spread, 1);
}
{
  // Nejlepší tři nesmí skončit spolu jen proto, že jdou první.
  const r = check([3, 3, 3, 3, 1, 1, 1, 1], 2, 3);
  eq("silní rozprostření (rozdíl 0)", r.spread, 0);
}

console.log("\nVíc týmů a větší skupiny:");
for (const [skills, count, maxSpread] of [
  // Součet 22 nejde na tři stejné díly — lepší než rozdíl 1 to nejde.
  [[3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1], 3, 1],
  [[3, 3, 3, 2, 2, 2, 1, 1, 1], 3, 0],
  [[3, 3, 2, 2, 2, 1, 1, 1, 1, 1, 1, 2, 3, 2], 4, 1],
  [[1, 1, 1, 1, 1, 1, 1], 3, 1],
  [[3, 1], 2, 2],
] as [number[], number, number][]) {
  for (const seed of [1, 7, 42]) {
    const r = check(skills, count, seed);
    eq(
      `${skills.length} hráčů do ${count}, seed ${seed}: velikosti ±1, rozdíl ≤ ${maxSpread}`,
      [r.everyoneOnce, r.sizeSpread <= 1, r.spread <= maxSpread],
      [true, true, true],
    );
  }
}

console.log("\nNáhoda mezi stejně dobrými:");
{
  const skills = [3, 3, 2, 2, 2, 2, 1, 1, 1, 1];
  const keys = new Set<string>();
  for (let seed = 1; seed <= 20; seed++) {
    const r = check(skills, 2, seed);
    keys.add(
      r.teams
        .map((t) => [...t.playerIds].sort().join(","))
        .sort()
        .join("|"),
    );
    if (r.spread !== 0) eq(`seed ${seed} vyrovnaný`, r.spread, 0);
  }
  eq("různé seedy dají různé týmy", keys.size > 1, true);
}

console.log("\nOkraje:");
eq("nikdo", balanceTeams([], 2, seeded(1)).map((t) => t.playerIds), [[], []]);
eq("počet týmů se srovná na 2–4", balanceTeams(players([1, 1, 1, 1, 1]), 9, seeded(1)).length, 4);
eq("jeden tým nejde", balanceTeams(players([1, 2]), 1, seeded(1)).length, 2);
eq("názvy týmů", balanceTeams(players([1, 2, 3]), 3, seeded(1)).map((t) => t.name), ["Tým A", "Tým B", "Tým C"]);

console.log("\nDovednost z formuláře:");
eq("platná", parseSkill("3"), 3);
eq("pod rozsahem", parseSkill("0"), 1);
eq("nad rozsahem", parseSkill("9"), 3);
eq("nesmysl", parseSkill("abc"), 2);

console.log(failures === 0 ? "\nVŠE PROŠLO" : `\n${failures} KONTROL NEPROŠLO`);
process.exit(failures === 0 ? 0 : 1);
