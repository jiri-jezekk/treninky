/**
 * Kontrola rozpadu docházky na měsíční částky — tedy toho, co hráč
 * uvidí v Platbách. Testuje se přímo funkce, kterou používá
 * player-balance i monthly-billing, ne její kopie.
 *
 * Hlavní požadavek: předplacení letošní sezóny nesmí sáhnout na loňské platby.
 *
 * Spuštění: npm run check:billing
 */
import { splitChargesByMonth } from "../src/lib/billing-math.ts";

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

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** Úterní trénink (110 Kč) v daný den. */
const utery = (y: number, m: number, day: number) => ({
  startsAt: new Date(y, m - 1, day, 19, 30),
  defaultPriceCents: null,
});

// 2025: 4. 11. je úterý, 2. 12. je úterý.
// 2026: 3. 11. je úterý, 1. 12. je úterý.
const loni = [utery(2025, 11, 4), utery(2025, 12, 2)];
const letos = [utery(2026, 11, 3), utery(2026, 12, 1)];
const vse = [...loni, ...letos];

const sezona2526 = { startsOn: d("2025-09-01"), endsOn: d("2026-06-30") };
const sezona2627 = { startsOn: d("2026-09-01"), endsOn: d("2027-06-30") };

console.log("Bez předplatného se účtuje všechno:");
{
  const r = splitChargesByMonth(vse, [], null);
  eq("čtyři tréninky, čtyři měsíce", r.months.length, 4);
  eq("celkem 440 Kč", r.totalCents, 44000);
  eq("nic předplaceného", r.prepaidCount, 0);
}

console.log("\nTOHLE JE TO HLAVNÍ — předplacení letoška nechá loňsko být:");
{
  const r = splitChargesByMonth(vse, [sezona2627], null);
  eq(
    "zbyly jen loňské měsíce",
    r.months.map((m) => `${m.month}/${m.year}`),
    ["11/2025", "12/2025"],
  );
  eq("loňský dluh zůstal 220 Kč", r.totalCents, 22000);
  eq("letošní dva tréninky pokrylo předplatné", r.prepaidCount, 2);
}

console.log("\nOpačně — předplacené loňsko nechá letošek být:");
{
  const r = splitChargesByMonth(vse, [sezona2526], null);
  eq(
    "zbyly jen letošní měsíce",
    r.months.map((m) => `${m.month}/${m.year}`),
    ["11/2026", "12/2026"],
  );
  eq("letošní dluh 220 Kč", r.totalCents, 22000);
}

console.log("\nObě sezóny předplacené:");
{
  const r = splitChargesByMonth(vse, [sezona2526, sezona2627], null);
  eq("nezbyl žádný měsíc", r.months.length, 0);
  eq("dluh nula", r.totalCents, 0);
  eq("všechny čtyři pokryté", r.prepaidCount, 4);
}

console.log("\nZvýhodněná kategorie platí i mimo předplatné:");
{
  const r = splitChargesByMonth(vse, [sezona2627], 6000);
  eq("loňsko za juniorskou sazbu 120 Kč", r.totalCents, 12000);
}

console.log("\nMezera mezi sezónami (prázdniny) se účtuje:");
{
  // 7. 7. 2026 je úterý — mimo obě sezóny.
  const r = splitChargesByMonth(
    [utery(2026, 7, 7)],
    [sezona2526, sezona2627],
    null,
  );
  eq("červencový trénink zůstal k zaplacení", r.totalCents, 11000);
  eq("nepokryl ho nikdo", r.prepaidCount, 0);
}

console.log("\nNástup v půlce sezóny:");
{
  const odProsince = { startsOn: d("2026-12-01"), endsOn: d("2027-06-30") };
  const r = splitChargesByMonth(letos, [odProsince], null);
  eq(
    "listopad se platí, prosinec ne",
    r.months.map((m) => `${m.month}/${m.year}:${m.cents}`),
    ["11/2026:11000"],
  );
}

console.log("\nSoučty sedí:");
{
  const r = splitChargesByMonth(vse, [sezona2627], null);
  const soucetMesicu = r.months.reduce((s, m) => s + m.cents, 0);
  eq("součet měsíců = celkem", soucetMesicu, r.totalCents);
  const pocetMesicu = r.months.reduce((s, m) => s + m.count, 0);
  eq("účtované + předplacené = všechny tréninky", pocetMesicu + r.prepaidCount, vse.length);
}

console.log("\nPosilovna se nepočítá do peněz:");
{
  const fitko = { startsAt: new Date(2026, 10, 3, 18, 0), defaultPriceCents: 11000, kind: "GYM" };
  const r = splitChargesByMonth([fitko], [], null);
  eq("posilovna nic nestojí", r.totalCents, 0);
}
{
  // I zvýhodněná kategorie platí za posilovnu nulu — jinak by
  // junior platil 60 Kč za to, že si šel zaběhat sám.
  const fitko = { startsAt: new Date(2026, 10, 3, 18, 0), defaultPriceCents: null, kind: "GYM" };
  const r = splitChargesByMonth([fitko], [], 6000);
  eq("ani junior za posilovnu neplatí", r.totalCents, 0);
}
{
  const mix = [
    utery(2026, 11, 3),
    { startsAt: new Date(2026, 10, 5, 18, 0), defaultPriceCents: null, kind: "GYM" },
  ];
  const r = splitChargesByMonth(mix, [], null);
  eq("v měsíci zůstane jen běžný trénink", r.totalCents, 11000);
}

console.log("\nŘazení:");
{
  const r = splitChargesByMonth([utery(2026, 12, 1), utery(2025, 11, 4)], [], null);
  eq(
    "od nejstaršího",
    r.months.map((m) => `${m.month}/${m.year}`),
    ["11/2025", "12/2026"],
  );
}

console.log("\nPrázdný vstup:");
{
  const r = splitChargesByMonth([], [sezona2627], null);
  eq("žádné tréninky, žádný dluh", r.totalCents, 0);
  eq("žádné měsíce", r.months.length, 0);
}

console.log(failures === 0 ? "\nVŠE PROŠLO" : `\n${failures} KONTROL NEPROŠLO`);
process.exit(failures === 0 ? 0 : 1);
