/**
 * Kontrola generování tréninků z rozvrhu.
 *
 * Dvě věci tu bolí nejvíc: špatný den (trénink vznikne jinde, než se hraje)
 * a duplicita (hráči by dostali dvojí platbu za jeden večer).
 *
 * Spuštění: npm run check:slots
 */
import {
  describeSlot,
  formatMinutes,
  occurrenceKey,
  parseMinutes,
  planTrainings,
  splitExisting,
  type Slot,
} from "../src/lib/training-slots.ts";

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

const utery: Slot = {
  id: "ut",
  dayOfWeek: 2,
  startMinutes: 18 * 60,
  endMinutes: 20 * 60,
  priceCents: 11000,
};
const ctvrtek: Slot = {
  id: "ct",
  dayOfWeek: 4,
  startMinutes: 19 * 60 + 30,
  endMinutes: 21 * 60,
  priceCents: 10000,
};

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const stamp = (dt: Date) =>
  `${dt.getDate()}.${dt.getMonth() + 1}. ${formatMinutes(dt.getHours() * 60 + dt.getMinutes())}`;

console.log("Čas tam a zpět:");
eq("18:00 je 1080 minut", parseMinutes("18:00"), 18 * 60);
eq("19:30 je 1170 minut", parseMinutes("19:30"), 19 * 60 + 30);
eq("zpět na 19:30", formatMinutes(1170), "19:30");
eq("jednociferná hodina projde", parseMinutes("8:05"), 8 * 60 + 5);
eq("24:00 neexistuje", parseMinutes("24:00"), null);
eq("60 minut neexistuje", parseMinutes("18:60"), null);
eq("nesmysl je null", parseMinutes("18.00"), null);
eq("prázdno je null", parseMinutes(""), null);

console.log("\nPopisek:");
eq("úterý", describeSlot(utery), "úterý 18:00–20:00");
eq("čtvrtek", describeSlot(ctvrtek), "čtvrtek 19:30–21:00");

console.log("\nTýden 1.–7. 9. 2026 (úterý 1. 9., čtvrtek 3. 9.):");
{
  const p = planTrainings([utery, ctvrtek], d(2026, 9, 1), d(2026, 9, 7));
  eq("dva tréninky", p.length, 2);
  eq(
    "správné dny a časy",
    p.map((x) => stamp(x.startsAt)),
    ["1.9. 18:00", "3.9. 19:30"],
  );
  eq(
    "konce sedí",
    p.map((x) => stamp(x.endsAt)),
    ["1.9. 20:00", "3.9. 21:00"],
  );
  eq(
    "ceny podle termínu",
    p.map((x) => x.priceCents),
    [11000, 10000],
  );
}

console.log("\nHranice období jsou včetně:");
{
  // 1. 9. 2026 je úterý.
  const p = planTrainings([utery], d(2026, 9, 1), d(2026, 9, 1));
  eq("jednodenní období s trénikem dá jeden", p.length, 1);
}
{
  const p = planTrainings([utery], d(2026, 9, 2), d(2026, 9, 3));
  eq("období bez úterý nedá nic", p.length, 0);
}

console.log("\nCelé září 2026:");
{
  const p = planTrainings([utery, ctvrtek], d(2026, 9, 1), d(2026, 9, 30));
  // Úterky: 1., 8., 15., 22., 29. = 5; čtvrtky: 3., 10., 17., 24. = 4
  eq("devět tréninků", p.length, 9);
  eq("řadí se chronologicky", stamp(p[0]!.startsAt), "1.9. 18:00");
  eq("poslední je 29. 9.", stamp(p[p.length - 1]!.startsAt), "29.9. 18:00");
  eq(
    "posloupnost je vzestupná",
    p.every((x, i) => i === 0 || x.startsAt >= p[i - 1]!.startsAt),
    true,
  );
}

console.log("\nPrázdný rozvrh:");
eq("nic nevygeneruje", planTrainings([], d(2026, 9, 1), d(2026, 12, 31)).length, 0);

console.log("\nKonec po půlnoci:");
{
  const nocni: Slot = {
    id: "n",
    dayOfWeek: 2,
    startMinutes: 22 * 60,
    endMinutes: 30, // 00:30
    priceCents: 11000,
  };
  const p = planTrainings([nocni], d(2026, 9, 1), d(2026, 9, 1));
  eq("konec padne na další den", stamp(p[0]!.endsAt), "2.9. 00:30");
  eq("trvá dvě a půl hodiny", p[0]!.endsAt.getTime() - p[0]!.startsAt.getTime(), 150 * 60 * 1000);
}

console.log("\nDuplicity — tohle je to hlavní:");
{
  const p = planTrainings([utery, ctvrtek], d(2026, 9, 1), d(2026, 9, 7));
  const existing = [{ startsAt: new Date(2026, 8, 1, 18, 0) }];
  const { toCreate, skipped } = splitExisting(p, existing);
  eq("úterý se přeskočí", skipped.length, 1);
  eq("čtvrtek se založí", toCreate.length, 1);
  eq("a je to opravdu čtvrtek", stamp(toCreate[0]!.startsAt), "3.9. 19:30");
}
{
  // Druhé spuštění na stejné období nesmí založit nic.
  const p = planTrainings([utery, ctvrtek], d(2026, 9, 1), d(2026, 9, 30));
  const existing = p.map((x) => ({ startsAt: x.startsAt }));
  const { toCreate } = splitExisting(p, existing);
  eq("opakované generování nezaloží nic", toCreate.length, 0);
}
{
  // Dva stejné sloty v jednom běhu se nesmí založit dvakrát.
  const kopie = { ...utery, id: "ut2" };
  const p = planTrainings([utery, kopie], d(2026, 9, 1), d(2026, 9, 1));
  eq("plán obsahuje obojí", p.length, 2);
  const { toCreate, skipped } = splitExisting(p, []);
  eq("založí se jen jeden", toCreate.length, 1);
  eq("druhý se přeskočí", skipped.length, 1);
}
{
  // Různý čas v týž den je jiný trénink, ne duplicita.
  const rano: Slot = { ...utery, id: "rano", startMinutes: 8 * 60, endMinutes: 9 * 60 };
  const p = planTrainings([utery, rano], d(2026, 9, 1), d(2026, 9, 1));
  const { toCreate } = splitExisting(p, []);
  eq("ranní i večerní projdou", toCreate.length, 2);
}

console.log("\nKlíč pro rozpoznání:");
eq(
  "stejný okamžik dá stejný klíč",
  occurrenceKey(new Date(2026, 8, 1, 18, 0)) === occurrenceKey(new Date(2026, 8, 1, 18, 0, 45)),
  true,
);
eq(
  "jiná minuta dá jiný klíč",
  occurrenceKey(new Date(2026, 8, 1, 18, 0)) === occurrenceKey(new Date(2026, 8, 1, 18, 30)),
  false,
);

console.log("\nObrácené období:");
eq(
  "od pozdějšího do dřívějšího nedá nic",
  planTrainings([utery], d(2026, 9, 30), d(2026, 9, 1)).length,
  0,
);

console.log(failures === 0 ? "\nVŠE PROŠLO" : `\n${failures} KONTROL NEPROŠLO`);
process.exit(failures === 0 ? 0 : 1);
