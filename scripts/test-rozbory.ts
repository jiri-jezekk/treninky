/**
 * Rozbory zápasů: čtení odkazu na video a výpočty nad zápisy.
 *
 * Hlavní věc, kterou tu hlídám: tabulka hráčů počítá jen ze zápisů,
 * které hráče mají, kdežto týmová bilance ze všech. Kdyby se to
 * rozešlo, čísla by nesedla a nikdo by nepoznal proč.
 */
import { formatVideoTime, parseYouTubeId } from "../src/lib/youtube.ts";
import {
  computeStats,
  sortByTime,
  type StatEvent,
  type StatType,
} from "../src/lib/review-stats.ts";
import {
  celkovaDelka,
  polohaVeVyrezu,
  rozsahOsy,
  vychoziOkno,
} from "../src/lib/review-timeline.ts";
import { mujSouhrn, souhrnRozboru } from "../src/lib/review-summary.ts";
import {
  indexBoduVCase,
  MIN_H,
  MIN_W,
  najdiPosledniZapis,
  omezRamec,
  usekBodu,
  usekDobehl,
} from "../src/lib/review-tracker.ts";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `  ${ok ? "ok  " : "CHYBA"} ${name}` +
      (ok ? "" : `\n        čekáno ${JSON.stringify(expected)}, vyšlo ${JSON.stringify(actual)}`),
  );
}

console.log("\nOdkaz na video:");
check("adresa z prohlížeče", parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
check("bez www", parseYouTubeId("https://youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
check("bez protokolu", parseYouTubeId("youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
check("mobilní", parseYouTubeId("https://m.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
check("zkrácené youtu.be", parseYouTubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
check("vložené video", parseYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
check("shorts", parseYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
check("živě", parseYouTubeId("https://www.youtube.com/live/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
check("samotné ID", parseYouTubeId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
check("mezery kolem", parseYouTubeId("  https://youtu.be/dQw4w9WgXcQ  "), "dQw4w9WgXcQ");

console.log("\nOdkaz zkopírovaný z telefonu (s přílepky):");
// Přesně tohle vyleze ze sdílení na mobilu — a proto se neukládá
// celá URL, ale jen ID.
check("s časem", parseYouTubeId("https://youtu.be/dQw4w9WgXcQ?t=42"), "dQw4w9WgXcQ");
check("s playlistem", parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&index=2"), "dQw4w9WgXcQ");
check("se sledovacím parametrem", parseYouTubeId("https://youtu.be/dQw4w9WgXcQ?si=abcdef"), "dQw4w9WgXcQ");
check("v jiném pořadí parametrů", parseYouTubeId("https://www.youtube.com/watch?list=PL1&v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");

console.log("\nCo videem není:");
check("prázdné", parseYouTubeId(""), null);
check("chybějící", parseYouTubeId(null), null);
check("jiný web", parseYouTubeId("https://vimeo.com/12345"), null);
check("krátké ID", parseYouTubeId("https://youtu.be/abc"), null);
check("dlouhé ID", parseYouTubeId("https://youtu.be/dQw4w9WgXcQextra"), null);
check("kanál, ne video", parseYouTubeId("https://www.youtube.com/@dcliberec"), null);
check("holý text", parseYouTubeId("zápas s Prahou"), null);
// Podvržená doména nesmí projít jen proto, že obsahuje „youtube.com“.
check("podvržená doména", parseYouTubeId("https://youtube.com.zlo.cz/watch?v=dQw4w9WgXcQ"), null);

console.log("\nČas ve videu:");
check("pod hodinu", formatVideoTime(754), "12:34");
check("přes hodinu", formatVideoTime(3754), "1:02:34");
check("nula", formatVideoTime(0), "0:00");
check("desetiny se ořežou", formatVideoTime(75.9), "1:15");
check("nesmysl", formatVideoTime(-5), "0:00");

/* ------------------------------------------------------ výpočty */

const typy: StatType[] = [
  { id: "hit", label: "Náš hit", color: "#0ea5e9", side: "FOR", sortOrder: 0, archived: false },
  { id: "dostali", label: "Dostali jsme hit", color: "#dc2626", side: "AGAINST", sortOrder: 1, archived: false },
  { id: "chyceni", label: "Chycení", color: "#059669", side: "FOR", sortOrder: 2, archived: false },
  { id: "chyba", label: "Chyba", color: "#64748b", side: "NEUTRAL", sortOrder: 3, archived: false },
  { id: "stary", label: "Zrušené tlačítko", color: "#a855f7", side: "FOR", sortOrder: 4, archived: true },
];

let poradi = 0;
function ev(typeId: string, atSeconds: number, playerId: string | null, playerName: string | null = null): StatEvent {
  return { id: `e${++poradi}`, typeId, atSeconds, playerId, playerName };
}

console.log("\nTýmová bilance:");
{
  const s = computeStats(
    [
      ev("hit", 10, "p1", "Ada"),
      ev("hit", 20, "p2", "Bára"),
      ev("dostali", 30, "p1", "Ada"),
      ev("chyceni", 40, null),
      ev("chyba", 50, null),
    ],
    typy,
  );
  check("pro", s.balance.forCount, 3);
  check("proti", s.balance.againstCount, 1);
  check("mimo", s.balance.neutralCount, 1);
  check("rozdíl", s.balance.diff, 2);
  check("celkem", s.balance.total, 5);
  check("bez hráče", s.withoutPlayer, 2);
}

console.log("\nTabulka hráčů počítá jen zápisy s hráčem:");
{
  const s = computeStats(
    [
      ev("hit", 10, "p1", "Ada"),
      ev("hit", 20, "p1", "Ada"),
      ev("dostali", 30, "p1", "Ada"),
      ev("hit", 40, "p2", "Bára"),
      ev("dostali", 50, null),
      ev("dostali", 60, null),
    ],
    typy,
  );
  check("dva hráči v tabulce", s.players.length, 2);
  const ada = s.players.find((p) => p.playerId === "p1")!;
  check("Ada: pro", ada.forCount, 2);
  check("Ada: proti", ada.againstCount, 1);
  check("Ada: rozdíl", ada.diff, 1);
  // Tohle je ta past: součet přes hráče je nižší než týmová bilance.
  const soucetHracu = s.players.reduce((n, p) => n + p.total, 0);
  check("součet přes hráče", soucetHracu, 4);
  check("týmová bilance je vyšší", s.balance.total, 6);
  check("rozdíl vysvětlují nesečtené", s.balance.total - soucetHracu, s.withoutPlayer);
}

console.log("\nPořadí v tabulce:");
{
  const s = computeStats(
    [
      ev("dostali", 10, "p1", "Ada"),
      ev("hit", 20, "p2", "Bára"),
      ev("hit", 30, "p2", "Bára"),
      ev("hit", 40, "p3", "Cyril"),
    ],
    typy,
  );
  check("nejlepší rozdíl první", s.players.map((p) => p.playerId), ["p2", "p3", "p1"]);
}

console.log("\nArchivované tlačítko:");
{
  const bez = computeStats([ev("hit", 10, null)], typy);
  check("bez zápisů se v přehledu neukáže", bez.balance.byType.some((t) => t.typeId === "stary"), false);

  const se = computeStats([ev("hit", 10, null), ev("stary", 20, "p1", "Ada")], typy);
  check("se zápisem se ukáže", se.balance.byType.some((t) => t.typeId === "stary"), true);
  check("a počítá se do bilance", se.balance.forCount, 2);
  check("archivované jde na konec", se.balance.byType[se.balance.byType.length - 1]!.typeId, "stary");
}

console.log("\nOkraje:");
{
  const prazdny = computeStats([], typy);
  check("prázdný rozbor", [prazdny.balance.total, prazdny.players.length, prazdny.withoutPlayer], [0, 0, 0]);
  check("nabídka tlačítek zůstává", prazdny.balance.byType.length, 4);
}
{
  // Zápis na typ, který v seznamu není, nesmí zkreslit čísla.
  const s = computeStats([ev("neznamy", 10, "p1", "Ada"), ev("hit", 20, "p1", "Ada")], typy);
  check("neznámý typ se nepočítá", s.balance.total, 1);
  check("ani do hráče", s.players[0]!.total, 1);
}
{
  const s = computeStats([ev("hit", 10, "p9", null)], typy);
  check("smazaný hráč má náhradní jméno", s.players[0]!.playerName, "Smazaný hráč");
}

console.log("\nŘazení podle času:");
{
  const a = { id: "a", atSeconds: 30 };
  const b = { id: "b", atSeconds: 10 };
  const c = { id: "c", atSeconds: 10 };
  check("podle času, při shodě podle pořadí zápisu", sortByTime([a, c, b]).map((x) => x.id), ["b", "c", "a"]);
  check("původní pole se nemění", [a, c, b].map((x) => x.id), ["a", "c", "b"]);
}

console.log("\nSkupiny tlačítek a podíly (kvůli vyhodnocení):");
{
  const sSkupinami: StatType[] = [
    { id: "fast", label: "Hit counter fast", color: "#0ea5e9", side: "FOR", sortOrder: 0, archived: false, groupLabel: "HIT" },
    { id: "slow", label: "Hit counter slow", color: "#059669", side: "FOR", sortOrder: 1, archived: false, groupLabel: "HIT" },
    { id: "dead", label: "Dead counter", color: "#dc2626", side: "AGAINST", sortOrder: 2, archived: false, groupLabel: "DEAD" },
    { id: "chyba", label: "Chyba", color: "#64748b", side: "NEUTRAL", sortOrder: 3, archived: false, groupLabel: "  " },
  ];
  const s = computeStats(
    [
      ev("fast", 10, "p1", "Ada"),
      ev("fast", 20, "p1", "Ada"),
      ev("fast", 30, null),
      ev("slow", 40, "p2", "Bára"),
      ev("dead", 50, "p1", "Ada"),
      ev("chyba", 60, null),
    ],
    sSkupinami,
  );

  check("skupiny v pořadí tlačítek, bez skupiny na konci", s.balance.byGroup.map((g) => g.name), ["HIT", "DEAD", null]);
  check("součet skupiny", s.balance.byGroup[0]!.total, 4);
  // Tohle je ta věta, kvůli které skupiny vznikly: „z našich hitů byly
  // tři čtvrtiny fast“.
  check("podíl uvnitř skupiny", s.balance.byType.find((t) => t.typeId === "fast")!.share, 0.75);
  check("a zbytek do jedné", s.balance.byType.find((t) => t.typeId === "slow")!.share, 0.25);
  check("sám ve skupině má celou", s.balance.byType.find((t) => t.typeId === "dead")!.share, 1);
  // Prázdný název skupiny je totéž co žádná — jinak by vznikly dvě „nic“.
  check("mezery nejsou skupina", s.balance.byGroup[2]!.name, null);
  check("bez skupiny se poměřuje se všemi", s.balance.byType.find((t) => t.typeId === "chyba")!.share, 1 / 6);
  check("součet skupin sedí s bilancí", s.balance.byGroup.reduce((n, g) => n + g.total, 0), s.balance.total);
}
{
  // Bez skupin se nic nemění: jedna skupina „nic“ a podíly na celku.
  const s = computeStats([ev("hit", 10, null), ev("dostali", 20, null)], typy);
  check("bez skupin je jedna skupina", s.balance.byGroup.map((g) => g.name), [null]);
  check("podíl na všech zápisech", s.balance.byType.find((t) => t.typeId === "hit")!.share, 0.5);
  check("nepoužité tlačítko má nulu", s.balance.byType.find((t) => t.typeId === "chyceni")!.share, 0);
}

console.log("\nPodskupiny — kolik z hitů padlo z counteru:");
{
  // Přesně jeho případ: counter zahraný rychle i pomalu je tentýž
  // herní moment. Sečíst se musí, jinak z čísel nic nevyčte.
  const t: StatType[] = [
    { id: "cf", label: "Hit counter fast", color: "#0ea5e9", side: "FOR", sortOrder: 0, archived: false, groupLabel: "HIT", subLabel: "counter" },
    { id: "cs", label: "Hit counter slow", color: "#059669", side: "FOR", sortOrder: 1, archived: false, groupLabel: "HIT", subLabel: "counter" },
    { id: "ut", label: "Hit z útoku", color: "#7c3aed", side: "FOR", sortOrder: 2, archived: false, groupLabel: "HIT", subLabel: "útok" },
    { id: "dc", label: "Dead counter", color: "#dc2626", side: "AGAINST", sortOrder: 3, archived: false, groupLabel: "DEAD", subLabel: "counter" },
  ];
  const s = computeStats(
    [
      ev("cf", 10, null), ev("cf", 20, null), ev("cf", 30, null),
      ev("cs", 40, null), ev("cs", 50, null),
      ev("ut", 60, null), ev("ut", 70, null), ev("ut", 80, null),
      ev("dc", 90, null),
    ],
    t,
  );

  const hit = s.balance.byGroup.find((g) => g.name === "HIT")!;
  check("skupina HIT má osm zápisů", hit.total, 8);
  check("podskupiny v pořadí tlačítek", hit.subs.map((x) => x.name), ["counter", "útok"]);
  check("counter sečten přes obě tlačítka", hit.subs[0]!.total, 5);
  // Tohle je ta věta, kvůli které podskupiny vznikly.
  check("podíl counteru na hitech", Math.round(hit.subs[0]!.share * 100), 63);
  check("útok zbytek", Math.round(hit.subs[1]!.share * 100), 38);
  check("součet podskupin = skupina", hit.subs.reduce((n, x) => n + x.total, 0), hit.total);

  // Stejně pojmenovaná podskupina v jiné skupině je jiná věc.
  const dead = s.balance.byGroup.find((g) => g.name === "DEAD")!;
  check("counter v DEAD se nemíchá s HIT", dead.subs[0]!.total, 1);
  check("a má celou svou skupinu", dead.subs[0]!.share, 1);
}
{
  // Bez podskupin zůstane jedna bezejmenná — UI podle toho pozná,
  // že nemá co rozpadat.
  const s = computeStats([ev("hit", 10, null), ev("dostali", 20, null)], typy);
  check("bez podskupin jedna bezejmenná", s.balance.byGroup[0]!.subs.map((x) => x.name), [null]);
}

console.log("\nSouhrn napříč zápasy:");
{
  const rozbory = [
    {
      id: "r1",
      name: "Liga — 1. kolo",
      opponent: "Praha",
      playedOnLabel: "09.08.2026",
      events: [ev("hit", 10, "p1", "Ada"), ev("hit", 20, null), ev("dostali", 30, "p2", "Bára")],
    },
    {
      id: "r2",
      name: "Liga — 2. kolo",
      opponent: "Brno",
      playedOnLabel: "16.08.2026",
      events: [ev("dostali", 10, "p1", "Ada"), ev("dostali", 20, "p1", "Ada"), ev("chyceni", 30, "p1", "Ada")],
    },
  ];
  const s = souhrnRozboru(rozbory, typy);

  check("zápasů v souhrnu", s.pocetZapasu, 2);
  check("bilance prvního zápasu", [s.zapasy[0]!.forCount, s.zapasy[0]!.againstCount], [2, 1]);
  check("bilance druhého zápasu", [s.zapasy[1]!.forCount, s.zapasy[1]!.againstCount], [1, 2]);
  // Souhrn se počítá stejnou funkcí jako jednotlivý rozbor, takže
  // musí sedět na součet — jinak by se čísla rozešla.
  check("celkem pro", s.celkem.balance.forCount, 3);
  check("celkem proti", s.celkem.balance.againstCount, 3);
  check(
    "součet zápasů = celek",
    s.zapasy.reduce((n, z) => n + z.total, 0),
    s.celkem.balance.total,
  );

  const ada = mujSouhrn(s, "p1");
  check("hráč vidí svoje zápisy napříč zápasy", [ada!.zapisu, ada!.forCount, ada!.againstCount], [4, 2, 2]);
  check("a jen akce, které měl", ada!.akce.map((a) => a.count), [1, 2, 1]);
  check("kdo nehrál, souhrn nemá", mujSouhrn(s, "p9"), null);
}

console.log("\nVýřez časové osy (živé přenosy mají hodiny záznamu):");
{
  check("délka z přehrávače má přednost", celkovaDelka(9000, [120, 300], 150), 9000);
  check("bez videa se odvodí ze zápisů", celkovaDelka(0, [120, 300], 150), 330);
  check("prázdný rozbor má minimum", celkovaDelka(0, [], 0), 60);
  check("běžící čas se vejde", celkovaDelka(0, [], 600), 630);

  check("krátký záznam se ukáže celý", vychoziOkno(900), null);
  check("hodinový se zúží na půl hodiny", vychoziOkno(3000), 1800);
  check("tříhodinový stream na deset minut", vychoziOkno(10800), 600);

  check("celé video", rozsahOsy(10800, 5000, null), { od: 0, do: 10800 });
  check("okno delší než video se nezúží", rozsahOsy(400, 100, 600), { od: 0, do: 400 });
  check("okno kolem přehrávaného času", rozsahOsy(10800, 5000, 600), { od: 4700, do: 5300 });
  // Na začátku a na konci se výřez přichytí, jinak by ukazatel
  // vyjel mimo osu.
  check("na začátku se přichytí", rozsahOsy(10800, 60, 600), { od: 0, do: 600 });
  check("na konci se přichytí", rozsahOsy(10800, 10790, 600), { od: 10200, do: 10800 });

  const r = rozsahOsy(10800, 5000, 600);
  check("značka uprostřed výřezu", polohaVeVyrezu(5000, r), 50);
  check("značka na začátku výřezu", polohaVeVyrezu(4700, r), 0);
  check("značka mimo výřez se nekreslí", polohaVeVyrezu(120, r), null);
  check("ani zápis po výřezu", polohaVeVyrezu(9000, r), null);
}

console.log("\nPlovoucí panel ve fullscreenu:");
{
  const okno = { w: 1440, h: 900 };
  check("beze změny uvnitř obrazovky", omezRamec({ x: 100, y: 100, w: 300, h: 400 }, okno), {
    w: 300,
    h: 400,
    x: 100,
    y: 100,
  });
  // Zatáhnout panel za hranu = přijít o něj, myší se pro něj nedá vrátit.
  check("zatažený doprava se vrátí", omezRamec({ x: 1400, y: 100, w: 300, h: 400 }, okno), {
    w: 300,
    h: 400,
    x: 1132,
    y: 100,
  });
  check("zatažený nahoru a doleva se vrátí", omezRamec({ x: -50, y: -80, w: 300, h: 400 }, okno), {
    w: 300,
    h: 400,
    x: 8,
    y: 8,
  });
  check("menší než minimum se nafoukne", omezRamec({ x: 10, y: 10, w: 20, h: 20 }, okno).w, MIN_W);
  check("a na výšku taky", omezRamec({ x: 10, y: 10, w: 20, h: 20 }, okno).h, MIN_H);
  check(
    "větší než obrazovka se ořízne",
    omezRamec({ x: 0, y: 0, w: 5000, h: 5000 }, okno),
    { w: 1424, h: 884, x: 8, y: 8 },
  );
  // Malé okno (telefon na šířku) nesmí protlačit panel do záporných čísel.
  check(
    "malé okno panel nevystrčí",
    omezRamec({ x: 300, y: 300, w: 300, h: 400 }, { w: 200, h: 150 }),
    { w: 184, h: 134, x: 8, y: 8 },
  );
  check("a nikdy pod minimum", [MIN_W, MIN_H], [180, 120]);
}

console.log("\nKterá akce platí v daném čase (sledování bez scrollování):");
{
  const body = [
    { atSeconds: 30 },
    { atSeconds: 90 },
    { atSeconds: 200 },
  ];
  check("prázdný rozbor nemá co ukázat", indexBoduVCase([], 50), null);
  check("před první akcí se ukazuje ta první", indexBoduVCase(body, 0), 0);
  check("těsně po akci se drží ta proběhlá", indexBoduVCase(body, 33), 0);
  check("na sekundu přesně taky", indexBoduVCase(body, 30), 0);
  check("po prodlevě se přepne na další", indexBoduVCase(body, 45), 1);
  check("mezi akcemi ukazuje tu blížící se", indexBoduVCase(body, 150), 2);
  check("po poslední akci zůstane poslední", indexBoduVCase(body, 900), 2);
  check("delší prodleva drží akci déle", indexBoduVCase(body, 45, 30), 0);
}

console.log("\nPřehrávání bodů za sebou:");
{
  // Náběh je potřeba: kdo kouká na hit, chce vidět, co mu předcházelo.
  check("úsek kolem bodu", usekBodu(100, 6, 8), { od: 94, do: 108 });
  check("na začátku záznamu se nepodleze nula", usekBodu(3, 6, 8), { od: 0, do: 11 });
  check("úsek nedoběhl", usekDobehl(100, { od: 94, do: 108 }), false);
  check("úsek doběhl", usekDobehl(108, { od: 94, do: 108 }), true);
  // Když si divák sám přetočí jinam, přehrávání bodů se nemá prát
  // s ním — pozná se to podle času mimo úsek.
  check("ruční přetočení zpět úsek ukončí", usekDobehl(50, { od: 94, do: 108 }), true);
  check("drobná nepřesnost přehrávače ne", usekDobehl(93.5, { od: 94, do: 108 }), false);
}

console.log("\nPoslední zápis, na který se věší poznámka:");
{
  const zapisy = [
    { id: "a", typeId: "hit", atSeconds: 10.4 },
    { id: "b", typeId: "catch", atSeconds: 30 },
    { id: "c", typeId: "hit", atSeconds: 30.2 },
  ];
  check("bez kliknutí není co doplňovat", najdiPosledniZapis(zapisy, null), null);
  check("podle typu a času", najdiPosledniZapis(zapisy, { typeId: "hit", at: 10 })?.id, "a");
  // Čekající zápis po uložení dostane jiné id; klíč musí přežít.
  check("zaokrouhlený čas sedí", najdiPosledniZapis(zapisy, { typeId: "hit", at: 30 })?.id, "c");
  check("stejný čas, jiný typ", najdiPosledniZapis(zapisy, { typeId: "catch", at: 30 })?.id, "b");
  check("smazaný zápis se nenajde", najdiPosledniZapis(zapisy, { typeId: "hit", at: 99 }), null);
  {
    // Dvakrát tatáž akce ve stejné vteřině: platí ta pozdější.
    const dva = [
      { id: "x", typeId: "hit", atSeconds: 12 },
      { id: "y", typeId: "hit", atSeconds: 12.4 },
    ];
    check("při shodě vyhrává novější", najdiPosledniZapis(dva, { typeId: "hit", at: 12 })?.id, "y");
  }
}

console.log(failures === 0 ? "\nVŠE PROŠLO" : `\nNEPROŠLO: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
