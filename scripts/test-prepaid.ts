/**
 * Kontrola předplacených období.
 *
 * Nejcitlivější místo celé aplikace: špatná hranice znamená, že hráči
 * zmizí nebo naopak naskočí platba za měsíc, který už má vyřízený.
 * Hlavní požadavek je, že nové předplatné nesmí sáhnout na minulou sezónu.
 *
 * Spuštění: npm run check:prepaid
 */
import {
  coversWholeMonth,
  dayKey,
  dayKeyUtc,
  formatRangeCs,
  isPrepaidOn,
  parseDateInput,
  rangesOverlap,
  toDateInputValue,
} from "../src/lib/prepaid.ts";

let failures = 0;
function eq(label: string, actual: unknown, expected: unknown): void {
  if (actual === expected) {
    console.log(`  ok   ${label}`);
  } else {
    console.log(`  FAIL ${label} — čekal ${expected}, dostal ${actual}`);
    failures++;
  }
}

/** DATE sloupec, jak ho vrací Prisma: půlnoc UTC. */
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** Trénink: místní čas, večer. */
const training = (y: number, m: number, day: number) => new Date(y, m - 1, day, 19, 30);

const sezona2627 = { startsOn: d("2026-09-01"), endsOn: d("2027-06-30") };
const sezona2526 = { startsOn: d("2025-09-01"), endsOn: d("2026-06-30") };

console.log("Hranice období (obě včetně):");
eq("první den sezóny se počítá", isPrepaidOn([sezona2627], training(2026, 9, 1)), true);
eq("poslední den sezóny se počítá", isPrepaidOn([sezona2627], training(2027, 6, 30)), true);
eq("den před sezónou nespadá", isPrepaidOn([sezona2627], training(2026, 8, 31)), false);
eq("den po sezóně nespadá", isPrepaidOn([sezona2627], training(2027, 7, 1)), false);
eq("uprostřed sezóny spadá", isPrepaidOn([sezona2627], training(2027, 1, 15)), true);

console.log("\nTo hlavní: nová sezóna nesahá na minulou:");
eq(
  "trénink z minulé sezóny zůstane neúčtovaný jen díky svému předplatnému",
  isPrepaidOn([sezona2526], training(2025, 11, 4)),
  true,
);
eq(
  "hráč s předplatným jen na 26/27 platí listopad 2025 normálně",
  isPrepaidOn([sezona2627], training(2025, 11, 4)),
  false,
);
eq(
  "obě sezóny vedle sebe pokryjí obojí",
  isPrepaidOn([sezona2526, sezona2627], training(2025, 11, 4)) &&
    isPrepaidOn([sezona2526, sezona2627], training(2027, 1, 15)),
  true,
);
eq(
  "mezera mezi sezónami (červenec–srpen) se účtuje",
  isPrepaidOn([sezona2526, sezona2627], training(2026, 7, 14)),
  false,
);

console.log("\nBez předplatného:");
eq("prázdný seznam nepokrývá nic", isPrepaidOn([], training(2026, 10, 6)), false);

console.log("\nNástup v půlce sezóny:");
const odLedna = { startsOn: d("2027-01-01"), endsOn: d("2027-06-30") };
eq("prosinec se ještě účtuje", isPrepaidOn([odLedna], training(2026, 12, 15)), false);
eq("leden už ne", isPrepaidOn([odLedna], training(2027, 1, 5)), true);

console.log("\nCelý měsíc:");
eq("září 2026 je celé předplacené", coversWholeMonth([sezona2627], 2026, 9), true);
eq("srpen 2026 celý není", coversWholeMonth([sezona2627], 2026, 8), false);
eq(
  "červenec 2027 celý není, i když 1. 7. by ještě…",
  coversWholeMonth([sezona2627], 2027, 7),
  false,
);
eq("leden 2027 s předplatným od 1. 1. je celý", coversWholeMonth([odLedna], 2027, 1), true);

console.log("\nPřekryv období (ochrana proti dvojímu předplatnému):");
eq("navazující sezóny se nepřekrývají", rangesOverlap(sezona2526, sezona2627), false);
eq("sezóna a její půlka se překrývají", rangesOverlap(sezona2627, odLedna), true);
eq("překryv je symetrický", rangesOverlap(odLedna, sezona2627), true);
eq(
  "dotek na jeden den je překryv",
  rangesOverlap(
    { startsOn: d("2026-09-01"), endsOn: d("2026-12-31") },
    { startsOn: d("2026-12-31"), endsOn: d("2027-06-30") },
  ),
  true,
);
eq(
  "den po sobě už ne",
  rangesOverlap(
    { startsOn: d("2026-09-01"), endsOn: d("2026-12-31") },
    { startsOn: d("2027-01-01"), endsOn: d("2027-06-30") },
  ),
  false,
);

console.log("\nPřevod dat z formuláře a zpět:");
eq("platné datum projde", toDateInputValue(parseDateInput("2026-09-01")!), "2026-09-01");
eq("prázdná hodnota je null", parseDateInput(""), null);
eq("nesmysl je null", parseDateInput("1. 9. 2026"), null);
eq("null je null", parseDateInput(null), null);
eq("den se cestou neposune", dayKeyUtc(parseDateInput("2026-01-01")!), "2026-01-01");

console.log("\nMístní vs. UTC den:");
// Trénink 31. 12. ve 23:00 místního času je v UTC už 1. 1. — kdybychom
// u tréninku četli UTC, spadl by do jiné sezóny, než ve které se konal.
const silvestr = new Date(2026, 11, 31, 23, 0);
eq("trénink čte místní den", dayKey(silvestr), "2026-12-31");
eq(
  "silvestrovský trénink patří do sezóny, ve které se konal",
  isPrepaidOn([{ startsOn: d("2026-09-01"), endsOn: d("2026-12-31") }], silvestr),
  true,
);

console.log("\nPopisek:");
eq("formát období", formatRangeCs(sezona2627), "1. 9. 2026 – 30. 6. 2027");

console.log(failures === 0 ? "\nVŠE PROŠLO" : `\n${failures} KONTROL NEPROŠLO`);
process.exit(failures === 0 ? 0 : 1);
