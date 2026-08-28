/**
 * Kontrola plánovače tréninků — časování bodů a dělení do týmů.
 *
 * Spuštění: npm run check:plan
 */
import {
  moveToNextTeam,
  parseTeams,
  splitIntoTeams,
  summarizePlan,
  withTimes,
  type SplitPlayer,
  type TeamAssignment,
} from "../src/lib/training-plan.ts";

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

const start = new Date(2026, 8, 1, 18, 0);

console.log("Časování bodů:");
{
  const blocks = [
    { id: "a", minutes: 10 },
    { id: "b", minutes: 20 },
    { id: "c", minutes: 30 },
  ];
  const t = withTimes(blocks, start);
  eq(
    "začátky jdou po sobě",
    t.map((x) => x.startLabel),
    ["18:00", "18:10", "18:30"],
  );
  eq(
    "konce sedí",
    t.map((x) => x.endLabel),
    ["18:10", "18:30", "19:00"],
  );
  eq("posun prvního je nula", t[0]!.offsetMinutes, 0);
}
{
  const t = withTimes([{ id: "a", minutes: 0 }, { id: "b", minutes: 15 }], start);
  eq("nulový bod nic neposune", t[1]!.startLabel, "18:00");
}
{
  const t = withTimes([{ id: "a", minutes: -5 }, { id: "b", minutes: 10 }], start);
  eq("záporná délka se bere jako nula", t[1]!.startLabel, "18:00");
}
{
  // Trénink 23:00, bod 90 minut → konec po půlnoci.
  const noc = new Date(2026, 8, 1, 23, 0);
  const t = withTimes([{ id: "a", minutes: 90 }], noc);
  eq("přes půlnoc", t[0]!.endLabel, "00:30");
}
eq("prázdný plán", withTimes([], start).length, 0);

console.log("\nSouhrn proti délce tréninku:");
{
  const konec = new Date(2026, 8, 1, 20, 0); // 120 minut
  const s = summarizePlan([{ id: "a", minutes: 50 }, { id: "b", minutes: 40 }], start, konec);
  eq("naplánováno 90", s.plannedMinutes, 90);
  eq("k dispozici 120", s.availableMinutes, 120);
  eq("zbývá 30", s.differenceMinutes, 30);
}
{
  const konec = new Date(2026, 8, 1, 19, 0); // 60 minut
  const s = summarizePlan([{ id: "a", minutes: 75 }], start, konec);
  eq("přesah je záporný", s.differenceMinutes, -15);
}
{
  const s = summarizePlan([{ id: "a", minutes: 30 }], start, null);
  eq("bez konce se nedá porovnat", s.differenceMinutes, null);
  eq("součet ale platí", s.plannedMinutes, 30);
}

console.log("\nDělení do týmů:");
/** Předvídatelný „náhodný“ generátor, ať jde výsledek zkontrolovat. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const muzi = (n: number): SplitPlayer[] =>
  Array.from({ length: n }, (_, i) => ({ id: `m${i}`, groupKey: "muzi" }));
const juniori = (n: number): SplitPlayer[] =>
  Array.from({ length: n }, (_, i) => ({ id: `j${i}`, groupKey: "juniori" }));

{
  const players = [...muzi(6), ...juniori(4)];
  const teams = splitIntoTeams(players, 2, seeded(1));
  eq("dva týmy", teams.length, 2);
  eq(
    "všech deset je rozdělených",
    teams.flatMap((t) => t.playerIds).length,
    10,
  );
  eq("po pěti", teams.map((t) => t.playerIds.length), [5, 5]);
  const all = new Set(teams.flatMap((t) => t.playerIds));
  eq("nikdo není dvakrát", all.size, 10);
}
{
  // Tohle je ten důvod, proč se dělí po kategoriích: junioři se mají
  // rozprostřít, ne skončit všichni v jednom týmu.
  const players = [...muzi(6), ...juniori(4)];
  const teams = splitIntoTeams(players, 2, seeded(7));
  const juniorsPerTeam = teams.map(
    (t) => t.playerIds.filter((id) => id.startsWith("j")).length,
  );
  eq("junioři rozprostření", juniorsPerTeam, [2, 2]);
}
{
  // Na tom, který tým dostane přebývajícího, nezáleží — jen na tom,
  // že se velikosti neliší o víc než o jednoho.
  const teams = splitIntoTeams([...muzi(7)], 2, seeded(3));
  const sizes = teams.map((t) => t.playerIds.length).sort();
  eq("lichý počet se liší nejvýš o jednoho", sizes, [3, 4]);
  eq("a nikdo nechybí", sizes[0]! + sizes[1]!, 7);
}
{
  // Totéž napříč počty hráčů i týmů — vlastnost, ne konkrétní výsledek.
  let worst = 0;
  for (let n = 2; n <= 30; n++) {
    for (let t = 2; t <= 4; t++) {
      const teams = splitIntoTeams(muzi(n), t, seeded(n * 31 + t));
      const sizes = teams.map((x) => x.playerIds.length);
      worst = Math.max(worst, Math.max(...sizes) - Math.min(...sizes));
      if (sizes.reduce((a, b) => a + b, 0) !== n) worst = 99;
    }
  }
  eq("velikosti se nikdy neliší o víc než o jednoho", worst <= 1, true);
}
{
  const teams = splitIntoTeams([...muzi(9)], 3, seeded(3));
  eq("tři týmy po třech", teams.map((t) => t.playerIds.length), [3, 3, 3]);
}
{
  const teams = splitIntoTeams([], 2, seeded(1));
  eq("bez hráčů vzniknou prázdné týmy", teams.map((t) => t.playerIds.length), [0, 0]);
}
{
  eq("míň než dva týmy nejde", splitIntoTeams(muzi(4), 1, seeded(1)).length, 2);
  eq("víc než čtyři taky ne", splitIntoTeams(muzi(4), 9, seeded(1)).length, 4);
}
{
  // Dvakrát po sobě se stejným semínkem musí vyjít totéž.
  const a = splitIntoTeams(muzi(8), 2, seeded(42));
  const b = splitIntoTeams(muzi(8), 2, seeded(42));
  eq("stejné semínko, stejný výsledek", a, b);
}
{
  const a = splitIntoTeams(muzi(8), 2, seeded(1));
  const b = splitIntoTeams(muzi(8), 2, seeded(999));
  eq("jiné semínko, jiné rozdělení", JSON.stringify(a) !== JSON.stringify(b), true);
}

console.log("\nRuční přesouvání:");
{
  let teams: TeamAssignment[] = [
    { name: "Tým A", playerIds: ["p1", "p2"] },
    { name: "Tým B", playerIds: ["p3"] },
  ];
  teams = moveToNextTeam(teams, "p1");
  eq("z A do B", teams.map((t) => t.playerIds), [["p2"], ["p3", "p1"]]);
  teams = moveToNextTeam(teams, "p1");
  eq("z posledního mimo týmy", teams.map((t) => t.playerIds), [["p2"], ["p3"]]);
  teams = moveToNextTeam(teams, "p1");
  eq("zvenku do prvního", teams.map((t) => t.playerIds), [["p2", "p1"], ["p3"]]);
}
{
  const teams = moveToNextTeam(
    [
      { name: "A", playerIds: ["x"] },
      { name: "B", playerIds: [] },
    ],
    "neznamy",
  );
  eq("neznámý hráč skončí v prvním", teams.map((t) => t.playerIds), [["x", "neznamy"], []]);
}

console.log("\nČtení uloženého rozdělení:");
eq("null je prázdno", parseTeams(null), []);
eq("nesmysl je prázdno", parseTeams("neco"), []);
eq(
  "platný zápis projde",
  parseTeams([{ name: "Tým A", playerIds: ["a", "b"] }]),
  [{ name: "Tým A", playerIds: ["a", "b"] }],
);
eq(
  "smazaný hráč vypadne",
  parseTeams([{ name: "Tým A", playerIds: ["a", "smazany"] }], new Set(["a"])),
  [{ name: "Tým A", playerIds: ["a"] }],
);
eq(
  "chybějící název se doplní",
  parseTeams([{ playerIds: ["a"] }])[0]?.name,
  "Tým A",
);
eq(
  "nesmysly v seznamu id se vyhodí",
  parseTeams([{ name: "T", playerIds: ["a", 5, null] }])[0]?.playerIds,
  ["a"],
);

console.log(failures === 0 ? "\nVŠE PROŠLO" : `\n${failures} KONTROL NEPROŠLO`);
process.exit(failures === 0 ? 0 : 1);
