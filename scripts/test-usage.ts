/**
 * Kontrola „kdy naposledy“, hodnocení a čtení šablon.
 *
 * Spuštění: npm run check:usage
 */
import {
  formatLastUsed,
  isStale,
  summarizeDrillUsage,
  type DrillUsageRow,
} from "../src/lib/drill-usage.ts";
import { parseRating, parseTemplateBlocks } from "../src/lib/training-plan.ts";

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

const now = new Date(2026, 9, 17, 12, 0);
const d = (day: number, month = 10, year = 2026) => new Date(year, month - 1, day, 17, 0);

const rows: DrillUsageRow[] = [
  { drillId: "a", startsAt: d(1), groupId: "u12", rating: 1 },
  { drillId: "a", startsAt: d(10), groupId: "u15", rating: -1 },
  { drillId: "a", startsAt: d(24), groupId: "u12", rating: 1 }, // v budoucnu
  { drillId: "b", startsAt: d(5, 8), groupId: "u12", rating: null },
];

console.log("Kdy naposledy:");
{
  const all = summarizeDrillUsage(rows, now);
  eq("bez kategorie: poslední proběhlý", all.get("a")?.lastUsed?.getDate(), 10);
  eq("budoucí plán se nepočítá", all.get("a")?.lastUsed?.getMonth(), 9);
  eq("hodnocení napříč", [all.get("a")?.up, all.get("a")?.down], [2, 1]);
  const u12 = summarizeDrillUsage(rows, now, "u12");
  eq("jen U12", u12.get("a")?.lastUsed?.getDate(), 1);
  eq("hodnocení i v U12 ze všech", [u12.get("a")?.up, u12.get("a")?.down], [2, 1]);
  const u18 = summarizeDrillUsage(rows, now, "u18");
  eq("v U18 nikdy", u18.get("a")?.lastUsed, null);
  eq("nepoužité cvičení v mapě není", all.has("c"), false);
}

console.log("\nDlouho nepoužité:");
eq("nikdy", isStale(null, now), true);
eq("před 16 dny", isStale(d(1), now), false);
eq("přesně 30 dní", isStale(d(17, 9), now), false);
eq("31 dní", isStale(d(16, 9), now), true);

console.log("\nZápis:");
eq("ještě ne", formatLastUsed(null, now), "ještě ne");
eq("dnes", formatLastUsed(new Date(2026, 9, 17, 8, 0), now), "dnes");
eq("včera", formatLastUsed(d(16), now), "včera");
eq("před dny", formatLastUsed(d(10), now), "před 7 dny");
eq("starší datum", formatLastUsed(d(5, 8), now), "5. 8.");
eq("jiný rok", formatLastUsed(d(5, 8, 2025), now), "5. 8. 2025");

console.log("\nHodnocení:");
eq("palec nahoru", parseRating("1"), 1);
eq("palec dolů", parseRating("-1"), -1);
eq("zrušit", parseRating(""), null);
eq("nesmysl", parseRating("5"), null);

console.log("\nBody šablony:");
eq("nesmysl", parseTemplateBlocks("x"), []);
eq(
  "doplní a vyčistí",
  parseTemplateBlocks([
    { title: " Rozcvička ", minutes: 10, kind: "WARMUP", focus: "", drillId: "d1" },
    { title: "", minutes: 5 },
    { title: "Hra", minutes: "abc", kind: "NECO", notes: " pozor " },
    null,
  ]),
  [
    { title: "Rozcvička", focus: null, notes: null, minutes: 10, kind: "WARMUP", drillId: "d1" },
    { title: "Hra", focus: null, notes: "pozor", minutes: 10, kind: "GAME_DRILL", drillId: null },
  ],
);

console.log(failures === 0 ? "\nVŠE PROŠLO" : `\n${failures} KONTROL NEPROŠLO`);
process.exit(failures === 0 ? 0 : 1);
