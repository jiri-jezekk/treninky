/**
 * Rychlá kontrola variabilních symbolů: délka do 10 číslic, jedinečnost
 * a to, že se symbol dá přečíst zpátky. Spouští se:
 *   node --experimental-strip-types scripts/test-variable-symbol.ts
 */
import {
  parseVariableSymbol,
  variableSymbolBatch,
  variableSymbolEvent,
  variableSymbolMonthly,
  variableSymbolPrepayment,
} from "../src/lib/variable-symbol.ts";

let failures = 0;
function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    console.log(`  FAIL ${label} ${detail}`);
    failures++;
  }
}

console.log("Ukázkové symboly:");
console.log("  hráč 1, srpen 2026  ->", variableSymbolMonthly(1, 2026, 8));
console.log("  hráč 19, akce 3     ->", variableSymbolEvent(19, 3));
console.log("  hráč 7, souhrn 1    ->", variableSymbolBatch(7, 1));
console.log("  hráč 5, předplatné 1 ->", variableSymbolPrepayment(5, 1));

console.log("\nKontroly:");

const all = new Set<string>();
let tooLong = 0;
for (let player = 1; player <= 9999; player += 7) {
  for (let month = 1; month <= 12; month++) {
    const vs = variableSymbolMonthly(player, 2026, month);
    if (vs.length > 10) tooLong++;
    all.add(vs);
  }
  for (let ev = 1; ev <= 20; ev++) all.add(variableSymbolEvent(player, ev));
  for (let b = 1; b <= 5; b++) all.add(variableSymbolBatch(player, b));
  for (let s = 1; s <= 3; s++) all.add(variableSymbolPrepayment(player, s));
}
check("žádný symbol nepřesáhl 10 číslic", tooLong === 0, `(${tooLong} delších)`);

const expected = Math.ceil(9999 / 7) * (12 + 20 + 5 + 3);
check("všechny symboly jedinečné", all.size === expected, `(${all.size} z ${expected})`);

// Různé druhy se nesmí potkat ani při stejném hráči a stejných číslech.
check(
  "druhy se nekříží",
  variableSymbolEvent(12, 8) !== variableSymbolBatch(12, 8),
);
// Předplatné je o číslici kratší než akce — nesmí splynout s jejím prefixem.
check(
  "předplatné se nepotká s akcí ani souhrnnou",
  variableSymbolPrepayment(12, 8) !== variableSymbolEvent(12, 8) &&
    variableSymbolPrepayment(12, 8) !== variableSymbolBatch(12, 8),
);

// Zpětné čtení
const m = parseVariableSymbol(variableSymbolMonthly(42, 2026, 11));
check(
  "měsíční se přečte zpět",
  m?.kind === "monthly" && m.playerNumber === 42 && m.year2 === 26 && m.month === 11,
  JSON.stringify(m),
);

const e = parseVariableSymbol(variableSymbolEvent(7, 3));
check(
  "akce se přečte zpět",
  e?.kind === "event" && e.playerNumber === 7 && e.eventNumber === 3,
  JSON.stringify(e),
);

const b = parseVariableSymbol(variableSymbolBatch(300, 12));
check(
  "souhrnná se přečte zpět",
  b?.kind === "batch" && b.playerNumber === 300 && b.sequence === 12,
  JSON.stringify(b),
);

const pp = parseVariableSymbol(variableSymbolPrepayment(88, 2));
check(
  "předplatné se přečte zpět",
  pp?.kind === "prepaid" && pp.playerNumber === 88 && pp.sequence === 2,
  JSON.stringify(pp),
);

check("cizí symbol vrátí null", parseVariableSymbol("9876543210") === null);
check("prázdný vstup vrátí null", parseVariableSymbol("") === null);
check("nečíselný vstup vrátí null", parseVariableSymbol("12ab5678") === null);
check(
  "neplatný měsíc vrátí null",
  parseVariableSymbol("1" + "0042" + "26" + "13") === null,
);

let threw = false;
try {
  variableSymbolMonthly(0, 2026, 1);
} catch {
  threw = true;
}
check("nulové číslo hráče je odmítnuto", threw);

console.log(failures === 0 ? "\nVŠE PROŠLO" : `\n${failures} SELHÁNÍ`);
process.exit(failures === 0 ? 0 : 1);
