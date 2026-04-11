/**
 * Krátký platební řetězec (SPAYD) pro české QR platby.
 * @see https://qr-platba.cz/pro-vyvojare/specifikace-formatu/
 */

/**
 * Typografické pomlčky a podobné znaky → ASCII „-“ (některé banky QR jinak odmítnou).
 */
function normalizeDashesForBank(value: string): string {
  return value
    .replace(/\u2014/g, "-") // —
    .replace(/\u2013/g, "-") // –
    .replace(/\u2012/g, "-") // ‒
    .replace(/\u2011/g, "-") // ‑
    .replace(/\u2212/g, "-") // −
    .replace(/\uFE58/g, "-") // ﹘
    .replace(/\uFE63/g, "-") // ﹣
    .replace(/\uFF0D/g, "-"); // － fullwidth hyphen-minus
}

function sanitizeSegment(value: string): string {
  return normalizeDashesForBank(value).replace(/\*/g, " ").trim();
}

export type SpaydInput = {
  iban: string;
  /** Částka v Kč s desetinnými místy (např. 150.5) */
  amountKc: number;
  message?: string;
  variableSymbol?: string;
};

export function buildSpaydString(input: SpaydInput): string {
  const iban = input.iban.replace(/\s/g, "").toUpperCase();
  if (!iban.startsWith("CZ") || iban.length < 10) {
    throw new Error("Neplatný IBAN (očekává se český účet).");
  }
  const am = input.amountKc.toFixed(2);
  const parts = ["SPD", "1.0", `ACC:${iban}`, `AM:${am}`, "CC:CZK"];
  if (input.message) {
    parts.push(`MSG:${sanitizeSegment(input.message).slice(0, 60)}`);
  }
  if (input.variableSymbol) {
    const vs = sanitizeSegment(input.variableSymbol).replace(/\D/g, "").slice(0, 10);
    if (vs) parts.push(`X-VS:${vs}`);
  }
  return parts.join("*");
}
