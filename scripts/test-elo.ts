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
  duelOutcome,
  expectedScore,
  averageRating,
  marginMultiplier,
  scoreFromValues,
  matchPlayerDeltas,
  roundKeepingZeroSum,
  WEIGHT_CHALLENGE_DEFAULT,
  WEIGHT_DUEL_DEFAULT,
  WEIGHT_MATCH_DEFAULT,
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
  // Velikost pohybu nemá záviset na tom, kolik lidí se přihlásilo —
  // o tom rozhoduje váha výzvy.
  const maloLidi = [
    { playerId: "a", rating: 1000, value: 3 },
    { playerId: "b", rating: 1000, value: 2 },
    { playerId: "c", rating: 1000, value: 1 },
  ];
  const hodneLidi = Array.from({ length: 20 }, (_, i) => ({
    playerId: `p${i}`,
    rating: 1000,
    value: 20 - i,
  }));
  const male = Math.max(...challengeDeltas(maloLidi, true).map((x) => Math.abs(x.delta)));
  const velke = Math.max(...challengeDeltas(hodneLidi, true).map((x) => Math.abs(x.delta)));
  ok(
    "tři lidi i dvacet hýbou ratingem podobně",
    Math.abs(male - velke) <= 2,
    `(${male} vs ${velke})`,
  );
  const d = challengeDeltas(hodneLidi, true);
  ok(
    "součet zůstává kolem nuly",
    Math.abs(d.reduce((s, x) => s + x.delta, 0)) <= 2,
    `(${d.reduce((s, x) => s + x.delta, 0)})`,
  );
}

console.log("\nVáha — výzva má vážit víc než duel:");
{
  const vyzva = challengeDeltas(
    [
      { playerId: "a", rating: 1000, value: 2 },
      { playerId: "b", rating: 1000, value: 1 },
    ],
    true,
  );
  const duel = duelDeltas(1000, 1000, 1).deltaA;
  const prvni = vyzva.find((x) => x.playerId === "a")!.delta;
  ok("výzva vynese víc než duel", prvni > duel, `(${prvni} vs ${duel})`);
}
{
  const lehka = duelDeltas(1000, 1000, 1, { weightPercent: 50 }).deltaA;
  const bezna = duelDeltas(1000, 1000, 1, { weightPercent: 100 }).deltaA;
  const tezka = duelDeltas(1000, 1000, 1, { weightPercent: 200 }).deltaA;
  eq("poloviční váha, poloviční pohyb", lehka, Math.round(bezna / 2));
  eq("dvojnásobná váha, dvojnásobný pohyb", tezka, bezna * 2);
}
{
  const vyzva = challengeDeltas(
    [
      { playerId: "a", rating: 1000, value: 2 },
      { playerId: "b", rating: 1000, value: 1 },
    ],
    true,
    { weightPercent: 100 },
  );
  eq(
    "se stejnou váhou vyjde výzva jako duel",
    vyzva.find((x) => x.playerId === "a")!.delta,
    duelDeltas(1000, 1000, 1).deltaA,
  );
}

console.log("\nRozdíl skóre — 20:0 má vážit víc než těsný výsledek:");
eq("nula ku nule nic nenásobí", marginMultiplier(0, 0), 1);
eq("shodné hodnoty násobí jednou", marginMultiplier(10, 10), 1);
eq("úplná jednostrannost násobí dvěma", marginMultiplier(20, 0), 2);
ok(
  "těsný zápas 11:9 násobí jen málo",
  Math.abs(marginMultiplier(11, 9) - 1.1) < 0.001,
  `(${marginMultiplier(11, 9)})`,
);
ok(
  "u času je 12,4 proti 13,1 těsný výsledek",
  marginMultiplier(12.4, 13.1) < 1.05,
  `(${marginMultiplier(12.4, 13.1)})`,
);
{
  const tesne = duelDeltas(1000, 1000, 1, { valueA: 11, valueB: 9 }).deltaA;
  const drtive = duelDeltas(1000, 1000, 1, { valueA: 20, valueB: 0 }).deltaA;
  const bezSkore = duelDeltas(1000, 1000, 1).deltaA;
  ok("drtivá výhra vynese víc než těsná", drtive > tesne, `(${drtive} vs ${tesne})`);
  eq("těsná výhra je blízko základu", tesne, Math.round(bezSkore * 1.1));
  eq("drtivá výhra je dvojnásobek", drtive, bezSkore * 2);
}
{
  // I s rozdílem skóre musí součet zůstat nulový.
  const { deltaA, deltaB } = duelDeltas(1200, 900, 0, { valueA: 0, valueB: 20 });
  eq("součet je pořád nula", deltaA + deltaB, 0);
}
{
  // Rozdíl skóre nesmí zvrátit to hlavní: prohra se silnějším je levná.
  const prohra = duelDeltas(1000, 1400, 0, { valueA: 0, valueB: 20 }).deltaA;
  ok(
    "drtivá prohra se silnějším pořád stojí málo",
    prohra >= -6,
    `(${prohra})`,
  );
}
{
  const remiza = duelDeltas(1000, 1000, 0.5, { valueA: 10, valueB: 10 }).deltaA;
  eq("remíza zůstává nulová", remiza, 0);
}

console.log("\nVýsledek duelu — jedna funkce pro náhled i zápis:");
{
  // Disciplína na čas: vyhrává nižší číslo.
  const o = duelOutcome({
    ratingChallenger: 1000,
    ratingOpponent: 1000,
    challengerValue: 12.4,
    opponentValue: 13.1,
    higherWins: false,
    weightPercent: 100,
  });
  eq("rychlejší čas vyhrává", o.challengerWins, true);
  ok("a získává", o.challengerDelta > 0, `(${o.challengerDelta})`);
  eq("součet je nula", o.challengerDelta + o.opponentDelta, 0);
}
{
  const o = duelOutcome({
    ratingChallenger: 1000,
    ratingOpponent: 1000,
    challengerValue: 20,
    opponentValue: 10,
    higherWins: false,
    weightPercent: 100,
  });
  eq("pomalejší čas prohrává", o.challengerWins, false);
  ok("a ztrácí", o.challengerDelta < 0, `(${o.challengerDelta})`);
}
{
  const o = duelOutcome({
    ratingChallenger: 1000,
    ratingOpponent: 1000,
    challengerValue: 8,
    opponentValue: 5,
    higherWins: true,
    weightPercent: 100,
  });
  eq("víc bodů vyhrává", o.challengerWins, true);
}
{
  const o = duelOutcome({
    ratingChallenger: 1000,
    ratingOpponent: 1000,
    challengerValue: 7,
    opponentValue: 7,
    higherWins: true,
    weightPercent: 100,
  });
  eq("shoda je remíza", o.challengerWins, null);
  eq("a nikoho nepohne", [o.challengerDelta, o.opponentDelta], [0, 0]);
}
{
  // Náhled a zápis musí dát totéž — proto je to jedna funkce.
  const params = {
    ratingChallenger: 1120,
    ratingOpponent: 980,
    challengerValue: 15,
    opponentValue: 11,
    higherWins: true,
    weightPercent: 150,
  };
  eq("dvojí volání dá stejný výsledek", duelOutcome(params), duelOutcome(params));
  const primo = duelDeltas(1120, 980, 1, {
    weightPercent: 150,
    valueA: 15,
    valueB: 11,
  });
  eq(
    "a sedí i s přímým výpočtem",
    duelOutcome(params).challengerDelta,
    primo.deltaA,
  );
}

console.log("\nTři váhy jdou po sobě:");
ok(
  "duel < zápas < výzva",
  WEIGHT_DUEL_DEFAULT < WEIGHT_MATCH_DEFAULT &&
    WEIGHT_MATCH_DEFAULT < WEIGHT_CHALLENGE_DEFAULT,
  `(${WEIGHT_DUEL_DEFAULT}/${WEIGHT_MATCH_DEFAULT}/${WEIGHT_CHALLENGE_DEFAULT})`,
);

console.log("\nPrůměr týmu:");
eq("prázdný tým je začátečnický", averageRating([]), 1000);
eq("průměr se zaokrouhlí", averageRating([1000, 1100, 1201]), 1100);

console.log("\nZápas dvou týmů — každý hráč zvlášť:");

/** Zkratka: tým stejně silných hráčů. */
function tym(id: string, score: number, ratings: number[]) {
  return {
    teamId: id,
    score,
    players: ratings.map((rating, i) => ({ playerId: `${id}${i}`, rating })),
  };
}
const soucet = (out: ReturnType<typeof matchPlayerDeltas>) =>
  out.reduce((s, t) => s + t.players.reduce((x, p) => x + p.delta, 0), 0);

{
  const d = matchPlayerDeltas([
    tym("a", 20, [1000, 1000, 1000]),
    tym("b", 0, [1000, 1000, 1000]),
  ]);
  const a = d.find((x) => x.teamId === "a")!;
  const b = d.find((x) => x.teamId === "b")!;
  eq("vítěz je první", a.rank, 1);
  eq("poražený druhý", b.rank, 2);
  ok("vítěz získává", a.players[0]!.delta > 0, `(${a.players[0]!.delta})`);
  eq("součet je nula", soucet(d), 0);
  eq(
    "stejně silní v týmu dostanou stejně",
    new Set(a.players.map((p) => p.delta)).size,
    1,
  );
}
{
  const tesny = matchPlayerDeltas([
    tym("a", 11, [1000, 1000]),
    tym("b", 9, [1000, 1000]),
  ]).find((x) => x.teamId === "a")!.players[0]!.delta;
  const drtivy = matchPlayerDeltas([
    tym("a", 20, [1000, 1000]),
    tym("b", 0, [1000, 1000]),
  ]).find((x) => x.teamId === "a")!.players[0]!.delta;
  ok("drtivá výhra vynese víc", drtivy > tesny, `(${drtivy} vs ${tesny})`);
}
{
  const zapas = matchPlayerDeltas([
    tym("a", 11, [1000, 1000]),
    tym("b", 9, [1000, 1000]),
  ]).find((x) => x.teamId === "a")!.players[0]!.delta;
  const duel = duelDeltas(1000, 1000, 1, { valueA: 11, valueB: 9 }).deltaA;
  ok("zápas váží víc než stejný duel", zapas > duel, `(${zapas} vs ${duel})`);
}
{
  const d = matchPlayerDeltas([
    tym("a", 10, [1000, 1000]),
    tym("b", 10, [1000, 1000]),
  ]);
  eq("remíza nikoho nepohne", d.flatMap((t) => t.players.map((p) => p.delta)), [0, 0, 0, 0]);
  eq("a oba jsou první", d.map((x) => x.rank), [1, 1]);
}

console.log("\nTOHLE JE TO NOVÉ — v týmu nedostanou všichni stejně:");
{
  // Smíšený tým porazí silného soupeře. Slabší v něm má získat víc
  // než jeho silnější spoluhráč — pro toho je výhra očekávaná.
  const d = matchPlayerDeltas([
    { teamId: "a", score: 15, players: [
      { playerId: "slaby", rating: 900 },
      { playerId: "silny", rating: 1300 },
    ] },
    tym("b", 10, [1200, 1200]),
  ]);
  const a = d.find((x) => x.teamId === "a")!;
  const slaby = a.players.find((p) => p.playerId === "slaby")!.delta;
  const silny = a.players.find((p) => p.playerId === "silny")!.delta;
  ok("slabší v týmu získá víc", slaby > silny, `(${slaby} vs ${silny})`);
  ok("oba ale získají", slaby > 0 && silny > 0, `(${slaby}, ${silny})`);
  eq("součet je pořád nula", soucet(d), 0);
}
{
  // A při prohře naopak: silný ztrácí víc, slabý skoro nic.
  const d = matchPlayerDeltas([
    { teamId: "a", score: 5, players: [
      { playerId: "slaby", rating: 900 },
      { playerId: "silny", rating: 1300 },
    ] },
    tym("b", 15, [1100, 1100]),
  ]);
  const a = d.find((x) => x.teamId === "a")!;
  const slaby = a.players.find((p) => p.playerId === "slaby")!.delta;
  const silny = a.players.find((p) => p.playerId === "silny")!.delta;
  ok("silnější ztratí víc", silny < slaby, `(${silny} vs ${slaby})`);
  ok("prohra se slabším soupeřem slabého moc nesrazí", slaby > -20, `(${slaby})`);
}
{
  // Přesně to, co si JJ přál: hrát proti mnohem lepším nesmí bolet.
  const d = matchPlayerDeltas([
    tym("slabsi", 5, [850, 850, 850]),
    tym("silnejsi", 20, [1400, 1400, 1400]),
  ]);
  const ztrata = d.find((x) => x.teamId === "slabsi")!.players[0]!.delta;
  ok("prohra s mnohem lepšími stojí málo", ztrata > -8, `(${ztrata})`);
}
{
  const d = matchPlayerDeltas([
    tym("slabsi", 15, [900, 900, 900]),
    tym("silnejsi", 10, [1300, 1300, 1300]),
  ]);
  const zisk = d.find((x) => x.teamId === "slabsi")!.players[0]!.delta;
  ok("překvapení se vyplatí", zisk >= 30, `(${zisk})`);
}
{
  // Nestejně velké týmy se stávají — někdo přijde pozdě.
  const d = matchPlayerDeltas([
    tym("a", 15, [1000, 1000, 1000, 1000, 1000]),
    tym("b", 10, [1000, 1000, 1000, 1000]),
  ]);
  eq("nestejné týmy: součet je nula", soucet(d), 0);
}

console.log("\nTurnájek čtyř týmů:");
{
  const d = matchPlayerDeltas([
    tym("a", 9, [1000, 1000]),
    tym("b", 6, [1000, 1000]),
    tym("c", 3, [1000, 1000]),
    tym("d", 0, [1000, 1000]),
  ]);
  eq(
    "pořadí podle skóre",
    [...d].sort((x, y) => x.rank - y.rank).map((x) => x.teamId),
    ["a", "b", "c", "d"],
  );
  ok("první získává", d.find((x) => x.teamId === "a")!.players[0]!.delta > 0);
  ok("poslední ztrácí", d.find((x) => x.teamId === "d")!.players[0]!.delta < 0);
  eq("součet je nula", soucet(d), 0);
}
{
  const d = matchPlayerDeltas([
    tym("a", 5, [1000]),
    tym("b", 5, [1000]),
    tym("c", 1, [1000]),
  ]);
  eq("shodné skóre, shodné pořadí", d.filter((x) => x.rank === 1).length, 2);
}
{
  const d = matchPlayerDeltas([tym("a", 5, [1000, 1000])]);
  eq("jeden tým nemá s kým", d[0]!.players[0]!.delta, 0);
  eq("žádný tým nespadne", matchPlayerDeltas([]).length, 0);
  eq("tým bez hráčů nespadne", matchPlayerDeltas([tym("a", 5, []), tym("b", 3, [1000])]).length, 2);
}

console.log("\nZaokrouhlení nesmí nafouknout rating:");
eq("beze zbytku", roundKeepingZeroSum([2, -2]), [2, -2]);
eq("zbytek se rozdá", roundKeepingZeroSum([1.5, -1.5]).reduce((a, b) => a + b, 0), 0);
{
  // Náhodné rozpady, které dávají dohromady nulu — po zaokrouhlení
  // to musí platit pořád.
  let nejhorsi = 0;
  for (let i = 0; i < 500; i++) {
    const n = 2 + (i % 9);
    const vals: number[] = [];
    for (let j = 0; j < n - 1; j++) vals.push((Math.sin(i * 7 + j) * 37) % 20);
    vals.push(-vals.reduce((a, b) => a + b, 0));
    const out = roundKeepingZeroSum(vals);
    nejhorsi = Math.max(nejhorsi, Math.abs(out.reduce((a, b) => a + b, 0)));
  }
  eq("500 náhodných rozpadů má součet nula", nejhorsi, 0);
}


console.log(failures === 0 ? "\nVŠE PROŠLO" : `\n${failures} KONTROL NEPROŠLO`);
process.exit(failures === 0 ? 0 : 1);
