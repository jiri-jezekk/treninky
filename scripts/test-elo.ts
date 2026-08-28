/**
 * Kontrola ratingu.
 *
 * Nejdůležitější vlastnost: kdo prohraje s výrazně silnějším, nesmí
 * spadnout skoro vůbec — jinak se nikdo neodváží vyzvat lepšího
 * a žebříček ztuhne. A součty musí dávat nulu, aby rating nenafukoval.
 *
 * Spuštění: npm run check:elo
 */
import {
  K_DUEL,
  challengeDeltas,
  duelDeltas,
  expectedScore,
  ratingBand,
  scoreFromValues,
  STARTING_RATING,
} from "../src/lib/elo.ts";

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
function ok(label: string, condition: boolean, detail = ""): void {
  if (condition) console.log(`  ok   ${label}`);
  else {
    console.log(`  FAIL ${label} ${detail}`);
    failures++;
  }
}

console.log("Očekávaná úspěšnost:");
eq("shodný rating je půl na půl", expectedScore(1000, 1000), 0.5);
ok(
  "náskok 400 bodů znamená zhruba 91 %",
  Math.abs(expectedScore(1400, 1000) - 0.909) < 0.005,
  `(${expectedScore(1400, 1000)})`,
);
ok(
  "obě strany dají dohromady jedničku",
  Math.abs(expectedScore(1200, 900) + expectedScore(900, 1200) - 1) < 1e-9,
);

console.log("\nDuel mezi rovnocennými:");
{
  const { deltaA, deltaB } = duelDeltas(1000, 1000, 1);
  eq("vítěz bere polovinu K", deltaA, K_DUEL / 2);
  eq("poražený tolik ztratí", deltaB, -K_DUEL / 2);
}
{
  const { deltaA, deltaB } = duelDeltas(1000, 1000, 0.5);
  eq("remíza nikoho nepohne", [deltaA, deltaB], [0, 0]);
}

console.log("\nTOHLE JE TO HLAVNÍ — souboj se silnějším:");
{
  // Slabší (1000) proti výrazně silnějšímu (1400).
  const prohra = duelDeltas(1000, 1400, 0);
  const vyhra = duelDeltas(1000, 1400, 1);
  ok(
    "prohra se silnějším stojí nejvýš 3 body",
    prohra.deltaA >= -3,
    `(${prohra.deltaA})`,
  );
  ok("výhra nad silnějším vynese přes 25", vyhra.deltaA >= 25, `(${vyhra.deltaA})`);
  ok(
    "výhra nad silnějším vynese víc než nad rovnocenným",
    vyhra.deltaA > duelDeltas(1000, 1000, 1).deltaA,
  );
}
{
  // A obráceně: favorit má co ztratit.
  const favoritVyhral = duelDeltas(1400, 1000, 1);
  const favoritProhral = duelDeltas(1400, 1000, 0);
  ok(
    "favorit za povinnou výhru skoro nic nezíská",
    favoritVyhral.deltaA <= 3,
    `(${favoritVyhral.deltaA})`,
  );
  ok(
    "ale za prohru zaplatí",
    favoritProhral.deltaA <= -25,
    `(${favoritProhral.deltaA})`,
  );
}

console.log("\nSoučty dávají nulu (rating nenafukuje):");
{
  const dvojice: [number, number][] = [
    [1000, 1000],
    [1200, 900],
    [1500, 1000],
    [1000, 1500],
    [1013, 987],
  ];
  let worst = 0;
  for (const [a, b] of dvojice) {
    for (const s of [0, 0.5, 1] as const) {
      const { deltaA, deltaB } = duelDeltas(a, b, s);
      worst = Math.max(worst, Math.abs(deltaA + deltaB));
    }
  }
  eq("žádná dvojice nevytvoří body z ničeho", worst, 0);
}

console.log("\nUrčení vítěze podle zapsaných hodnot:");
eq("víc zásahů vyhrává", scoreFromValues(8, 5, true), 1);
eq("míň zásahů prohrává", scoreFromValues(5, 8, true), 0);
eq("u času vyhrává nižší", scoreFromValues(12.4, 13.1, false), 1);
eq("u času vyšší prohrává", scoreFromValues(13.1, 12.4, false), 0);
eq("shoda je remíza", scoreFromValues(7, 7, true), 0.5);

console.log("\nMěsíční výzva:");
{
  const vysledky = [
    { playerId: "a", rating: 1000, value: 30 },
    { playerId: "b", rating: 1000, value: 20 },
    { playerId: "c", rating: 1000, value: 10 },
  ];
  const d = challengeDeltas(vysledky, true);
  eq(
    "pořadí podle hodnoty",
    d.map((x) => `${x.playerId}:${x.rank}`),
    ["a:1", "b:2", "c:3"],
  );
  ok("první získává", d.find((x) => x.playerId === "a")!.delta > 0);
  eq("prostřední ze stejně silných zůstane", d.find((x) => x.playerId === "b")!.delta, 0);
  ok("poslední ztrácí", d.find((x) => x.playerId === "c")!.delta < 0);
  eq(
    "součet je nula",
    d.reduce((s, x) => s + x.delta, 0),
    0,
  );
}
{
  // Přesně ten případ, na který se ptal: skončit vzadu mezi samými
  // silnějšími nemá srazit rating.
  const vysledky = [
    { playerId: "slabsi", rating: 900, value: 10 },
    { playerId: "s1", rating: 1400, value: 40 },
    { playerId: "s2", rating: 1400, value: 30 },
    { playerId: "s3", rating: 1400, value: 20 },
  ];
  const d = challengeDeltas(vysledky, true);
  const slabsi = d.find((x) => x.playerId === "slabsi")!;
  eq("skončil poslední", slabsi.rank, 4);
  ok(
    "a přesto neztratil skoro nic",
    slabsi.delta >= -3,
    `(${slabsi.delta})`,
  );
}
{
  // A naopak: být poslední mezi slabšími bolí.
  const vysledky = [
    { playerId: "favorit", rating: 1400, value: 10 },
    { playerId: "s1", rating: 900, value: 40 },
    { playerId: "s2", rating: 900, value: 30 },
    { playerId: "s3", rating: 900, value: 20 },
  ];
  const d = challengeDeltas(vysledky, true);
  ok(
    "favorit vzadu ztrácí výrazně",
    d.find((x) => x.playerId === "favorit")!.delta <= -20,
    `(${d.find((x) => x.playerId === "favorit")!.delta})`,
  );
}
{
  const vysledky = [
    { playerId: "a", rating: 1000, value: 12.0 },
    { playerId: "b", rating: 1000, value: 11.0 },
  ];
  const d = challengeDeltas(vysledky, false);
  eq("u času vede nižší hodnota", d.find((x) => x.playerId === "b")!.rank, 1);
}
{
  const vysledky = [
    { playerId: "a", rating: 1000, value: 20 },
    { playerId: "b", rating: 1000, value: 20 },
    { playerId: "c", rating: 1000, value: 10 },
  ];
  const d = challengeDeltas(vysledky, true);
  eq(
    "shodná hodnota, shodné pořadí",
    d.map((x) => `${x.playerId}:${x.rank}`),
    ["a:1", "b:1", "c:3"],
  );
}
{
  const d = challengeDeltas([{ playerId: "a", rating: 1000, value: 5 }], true);
  eq("sám proti sobě nikdo nesoutěží", d[0]!.delta, 0);
  eq("prázdná výzva nespadne", challengeDeltas([], true).length, 0);
}
{
  // Výzva nesmí vynést víc než duel — jinak by se vyplácelo jen soutěžit hromadně.
  const mnoho = Array.from({ length: 20 }, (_, i) => ({
    playerId: `p${i}`,
    rating: 1000,
    value: 20 - i,
  }));
  const d = challengeDeltas(mnoho, true);
  const nejvetsi = Math.max(...d.map((x) => Math.abs(x.delta)));
  ok(
    "největší pohyb nepřesáhne jeden duel",
    nejvetsi <= K_DUEL / 2 + 1,
    `(${nejvetsi})`,
  );
  ok(
    "součet zůstává kolem nuly",
    Math.abs(d.reduce((s, x) => s + x.delta, 0)) <= 2,
    `(${d.reduce((s, x) => s + x.delta, 0)})`,
  );
}

console.log("\nZařazení:");
eq("start je Základ", ratingBand(STARTING_RATING), "Základ");
eq("pod 950 začátečník", ratingBand(900), "Začátečník");
eq("1400 je špička", ratingBand(1400), "Špička");

console.log(failures === 0 ? "\nVŠE PROŠLO" : `\n${failures} KONTROL NEPROŠLO`);
process.exit(failures === 0 ? 0 : 1);
