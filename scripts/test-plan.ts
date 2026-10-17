/**
 * Kontrola plánovače tréninků — časování bodů a dělení do týmů.
 *
 * Spuštění: npm run check:plan
 */
import {
  moveToNextTeam,
  diarySummary,
  parseTags,
  parseTeams,
  sortDrillsForGroup,
  suitsGroup,
  summarizePlan,
  withTimes,
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

console.log("\nŠtítky cvičení:");
eq("prázdné pole", parseTags(""), []);
eq("čárky a mezery", parseTags(" úvodní hra ,nahrávka,, "), ["úvodní hra", "nahrávka"]);
eq("duplicita jinými písmeny", parseTags("Hra, hra, HRA"), ["Hra"]);
eq("vnitřní mezery se slijí", parseTags("úvodní   hra"), ["úvodní hra"]);

console.log("\nCvičení podle kategorie:");
{
  const drills = [
    { id: "jine", groupIds: ["u18"] },
    { id: "obecne", groupIds: [] },
    { id: "pro-u12", groupIds: ["u12", "u15"] },
    { id: "obecne2", groupIds: [] },
  ];
  eq(
    "bez kategorie plánu zůstane pořadí",
    sortDrillsForGroup(drills, null).map((d) => d.id),
    ["jine", "obecne", "pro-u12", "obecne2"],
  );
  eq(
    "nejdřív pro kategorii, pak obecná, nakonec ostatní",
    sortDrillsForGroup(drills, "u12").map((d) => d.id),
    ["pro-u12", "obecne", "obecne2", "jine"],
  );
  eq("obecné se hodí všem", suitsGroup({ groupIds: [] }, "u12"), true);
  eq("cizí kategorie se nehodí", suitsGroup({ groupIds: ["u18"] }, "u12"), false);
  eq("bez filtru se hodí vše", suitsGroup({ groupIds: ["u18"] }, null), true);
}

console.log("\nShrnutí do deníku:");
eq(
  "řádek na bod, zaměření za pomlčkou",
  diarySummary([
    { title: "Pohybová hra", focus: "rychlost obratnost" },
    { title: "Rozcvička a rozházení", focus: null },
    { title: "Herní cvičení", focus: " protiútok " },
    { title: "Hra", focus: "" },
    { title: "Závěrečné uvolnění", focus: null },
  ]),
  "Pohybová hra - rychlost obratnost\nRozcvička a rozházení\nHerní cvičení - protiútok\nHra\nZávěrečné uvolnění",
);
eq("prázdný plán", diarySummary([]), "");
eq(
  "zaměření už v názvu se neopakuje",
  diarySummary([{ title: "Hra - Protiútok", focus: "protiútok" }]),
  "Hra - Protiútok",
);

console.log(failures === 0 ? "\nVŠE PROŠLO" : `\n${failures} KONTROL NEPROŠLO`);
process.exit(failures === 0 ? 0 : 1);
