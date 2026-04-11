import type { PlayerGroup, Training } from "@prisma/client";

/** Úterý: 110 Kč, čtvrtek: 100 Kč, junioři vždy 60 Kč. Výjimka: ruční trénink s vyplněnou cenou. */
export const PRICE_TUESDAY_CENTS = 110 * 100;
export const PRICE_THURSDAY_CENTS = 100 * 100;
export const PRICE_JUNIOR_CENTS = 60 * 100;

export function playerIsJunior(groupMembers: { group: PlayerGroup }[]): boolean {
  return groupMembers.some((m) => m.group === "JUNIORS");
}

/**
 * Cena jednoho tréninku pro hráče (haléře).
 * `customPriceCents` na tréninku = výjimečná akce — platí pro nejunior; junior stále 60 Kč.
 */
/** Úterý nebo čtvrtek bez vlastní ceny = „pravidelný“ trénink. */
export function isRegularTuesdayThursdayAuto(
  training: Pick<Training, "startsAt" | "defaultPriceCents">,
): boolean {
  if (training.defaultPriceCents != null) return false;
  const dow = training.startsAt.getDay();
  return dow === 2 || dow === 4;
}

export function priceCentsForTrainingSession(
  training: Pick<Training, "startsAt" | "defaultPriceCents">,
  isJunior: boolean,
): number {
  if (isJunior) return PRICE_JUNIOR_CENTS;
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
