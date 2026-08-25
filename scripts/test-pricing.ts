/**
 * Kontrola výpočtu ceny za trénink. Tohle je jediné místo v aplikaci,
 * kde vznikají částky, které pak jdou hráčům do QR kódů — a zvýhodněná
 * sazba se sem přestěhovala z pevného pravidla „junioři 60 Kč“.
 *
 * Spuštění: npm run check:pricing
 */
import {
  PRICE_THURSDAY_CENTS,
  PRICE_TUESDAY_CENTS,
  discountPriceCentsFor,
  isRegularTuesdayThursdayAuto,
  priceCentsForTrainingSession,
} from "../src/lib/training-pricing.ts";

let failures = 0;
function eq(label: string, actual: unknown, expected: unknown): void {
  if (actual === expected) {
    console.log(`  ok   ${label}`);
  } else {
    console.log(`  FAIL ${label} — čekal ${expected}, dostal ${actual}`);
    failures++;
  }
}

// 2026: 4. 8. je úterý, 6. 8. je čtvrtek, 8. 8. je sobota
const tuesday = { startsAt: new Date(2026, 7, 4, 19, 30), defaultPriceCents: null };
const thursday = { startsAt: new Date(2026, 7, 6, 19, 30), defaultPriceCents: null };
const saturday = { startsAt: new Date(2026, 7, 8, 10, 0), defaultPriceCents: null };
const special = { startsAt: new Date(2026, 7, 4, 19, 30), defaultPriceCents: 15000 };

console.log("Kontrola dnů v týdnu:");
eq("4. 8. 2026 je úterý", tuesday.startsAt.getDay(), 2);
eq("6. 8. 2026 je čtvrtek", thursday.startsAt.getDay(), 4);

console.log("\nBěžná sazba:");
eq("úterý", priceCentsForTrainingSession(tuesday, null), PRICE_TUESDAY_CENTS);
eq("čtvrtek", priceCentsForTrainingSession(thursday, null), PRICE_THURSDAY_CENTS);
eq(
  "jiný den bez ceny spadne na úterní sazbu",
  priceCentsForTrainingSession(saturday, null),
  PRICE_TUESDAY_CENTS,
);
eq(
  "trénink s ruční cenou ji použije",
  priceCentsForTrainingSession(special, null),
  15000,
);

console.log("\nZvýhodněná sazba (dřív „junioři 60 Kč“):");
eq("místo úterní", priceCentsForTrainingSession(tuesday, 6000), 6000);
eq("místo čtvrteční", priceCentsForTrainingSession(thursday, 6000), 6000);
eq(
  "přebíjí i ruční cenu u výjimečného tréninku",
  priceCentsForTrainingSession(special, 6000),
  6000,
);

console.log("\nVýběr sazby podle kategorií hráče:");
eq(
  "bez kategorií",
  discountPriceCentsFor([]),
  null,
);
eq(
  "jen běžné kategorie",
  discountPriceCentsFor([{ discountPriceCents: null }, { discountPriceCents: null }]),
  null,
);
eq(
  "jedna zvýhodněná",
  discountPriceCentsFor([{ discountPriceCents: null }, { discountPriceCents: 6000 }]),
  6000,
);
eq(
  "dvě zvýhodněné — platí levnější",
  discountPriceCentsFor([{ discountPriceCents: 6000 }, { discountPriceCents: 5000 }]),
  5000,
);

console.log("\nRozpoznání pravidelného tréninku:");
eq("úterý bez ceny", isRegularTuesdayThursdayAuto(tuesday), true);
eq("čtvrtek bez ceny", isRegularTuesdayThursdayAuto(thursday), true);
eq("sobota", isRegularTuesdayThursdayAuto(saturday), false);
eq("úterý s ruční cenou", isRegularTuesdayThursdayAuto(special), false);

console.log("\nMěsíc hráče (8 tréninků, střídavě úterý a čtvrtek):");
const month = [tuesday, thursday, tuesday, thursday, tuesday, thursday, tuesday, thursday];
const bezny = month.reduce((s, t) => s + priceCentsForTrainingSession(t, null), 0);
const zvyhodneny = month.reduce((s, t) => s + priceCentsForTrainingSession(t, 6000), 0);
eq("běžný hráč: 4×110 + 4×100 = 840 Kč", bezny, 84000);
eq("zvýhodněný: 8×60 = 480 Kč", zvyhodneny, 48000);

console.log(failures === 0 ? "\nVŠE PROŠLO" : `\n${failures} SELHÁNÍ`);
process.exit(failures === 0 ? 0 : 1);
