// Relativní cesty schválně: tenhle soubor spouští i kontrolní skript
// mimo Next.js, kde alias @/ neexistuje.
import { isPrepaidOn, type PrepaidRange } from "./prepaid.ts";
import { priceCentsForTrainingSession } from "./training-pricing.ts";

/** Odchozený trénink, jak ho potřebuje výpočet. */
export type ChargeableSession = {
  startsAt: Date;
  defaultPriceCents: number | null;
};

export type MonthCharge = {
  year: number;
  month: number;
  cents: number;
  /** Účtované tréninky. Předplacené se sem nepočítají. */
  count: number;
};

export type ChargeSplit = {
  months: MonthCharge[];
  /** Kolik tréninků pokrylo předplatné — pro popisky a kontrolní součty. */
  prepaidCount: number;
  totalCents: number;
};

/**
 * Rozpad odchozených tréninků na měsíční částky.
 *
 * Jediné místo, kde se rozhoduje, jestli se trénink hráči účtuje. Rozhoduje
 * **datum tréninku** proti předplaceným obdobím — ne příznak u hráče. Díky
 * tomu nové předplatné nesáhne na měsíce, které do jeho období nespadají.
 */
export function splitChargesByMonth(
  sessions: ChargeableSession[],
  prepaidRanges: PrepaidRange[],
  discountPriceCents: number | null,
): ChargeSplit {
  const perMonth = new Map<string, MonthCharge>();
  let prepaidCount = 0;
  let totalCents = 0;

  for (const s of sessions) {
    if (isPrepaidOn(prepaidRanges, s.startsAt)) {
      prepaidCount += 1;
      continue;
    }

    const year = s.startsAt.getFullYear();
    const month = s.startsAt.getMonth() + 1;
    const cents = priceCentsForTrainingSession(s, discountPriceCents);
    totalCents += cents;

    const key = `${year}-${month}`;
    const row = perMonth.get(key);
    if (row) {
      row.cents += cents;
      row.count += 1;
    } else {
      perMonth.set(key, { year, month, cents, count: 1 });
    }
  }

  const months = [...perMonth.values()].sort(
    (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month),
  );

  return { months, prepaidCount, totalCents };
}
