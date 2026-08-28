import type { Training } from "@prisma/client";

/** Úterý: 110 Kč, čtvrtek: 100 Kč. Výjimka: ruční trénink s vyplněnou cenou. */
export const PRICE_TUESDAY_CENTS = 110 * 100;
export const PRICE_THURSDAY_CENTS = 100 * 100;

/**
 * Zvýhodněná sazba hráče podle jeho kategorií — dřív napevno „junioři 60 Kč“,
 * teď údaj u kategorie, takže si ho trenér mění sám.
 * Je-li hráč ve víc zvýhodněných kategoriích, platí ta nejlevnější.
 */
export function discountPriceCentsFor(
  groups: { discountPriceCents: number | null }[],
): number | null {
  const prices = groups
    .map((g) => g.discountPriceCents)
    .filter((p): p is number => p != null);
  return prices.length > 0 ? Math.min(...prices) : null;
}

/** Úterý nebo čtvrtek bez vlastní ceny = „pravidelný“ trénink. */
export function isRegularTuesdayThursdayAuto(
  training: Pick<Training, "startsAt" | "defaultPriceCents">,
): boolean {
  if (training.defaultPriceCents != null) return false;
  const dow = training.startsAt.getDay();
  return dow === 2 || dow === 4;
}

/**
 * Cena jednoho tréninku pro hráče (haléře).
 * Zvýhodněná sazba přebíjí všechno včetně ruční ceny u výjimečného tréninku —
 * stejně, jako to dřív platilo pro juniory.
 */
export function priceCentsForTrainingSession(
  training: Pick<Training, "startsAt" | "defaultPriceCents"> & { kind?: string },
  discountPriceCents: number | null,
): number {
  // Posilovna se neúčtuje vůbec — chodí se na ni po svém. Musí to být
  // dřív než zvýhodněná sazba, jinak by junior platil i za ni.
  if (training.kind === "GYM") return 0;
  if (discountPriceCents != null) return discountPriceCents;
  if (training.defaultPriceCents != null) return training.defaultPriceCents;
  const dow = training.startsAt.getDay();
  if (dow === 2) return PRICE_TUESDAY_CENTS;
  if (dow === 4) return PRICE_THURSDAY_CENTS;
  return PRICE_TUESDAY_CENTS;
}

/** Český název měsíce a rok, např. „duben 2026“. */
export function formatMonthLabelCs(year: number, month1to12: number): string {
  const months = [
    "leden",
    "únor",
    "březen",
    "duben",
    "květen",
    "červen",
    "červenec",
    "srpen",
    "září",
    "říjen",
    "listopad",
    "prosinec",
  ];
  const m = month1to12 - 1;
  if (m < 0 || m > 11) return `${month1to12}/${year}`;
  return `${months[m]} ${year}`;
}

/** Zpráva do QR (max. délka dle SPAYD). */
export function buildMonthlyPaymentMessage(playerName: string, year: number, month1to12: number): string {
  const monthPart = formatMonthLabelCs(year, month1to12);
  return `Tréninky - ${playerName}, ${monthPart}`.slice(0, 60);
}
