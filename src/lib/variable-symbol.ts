/**
 * Variabilní symboly.
 *
 * Banka povoluje nejvýš 10 číslic. Skládáme je tak, aby z výpisu šlo poznat
 * plátce i účel platby bez čtení poznámky:
 *
 *   měsíční tréninky   1 + číslo hráče (4) + rok (2) + měsíc (2)   → 9 číslic
 *   jednorázová akce   2 + číslo hráče (4) + číslo akce (3)        → 8 číslic
 *   souhrnná platba    3 + číslo hráče (4) + pořadí (3)            → 8 číslic
 *   předplatné sezóny  4 + číslo hráče (4) + pořadí (2)            → 7 číslic
 *
 * První číslice říká druh, takže se symboly nikdy nepotkají.
 */

export const VS_KIND_MONTHLY = "1";
export const VS_KIND_EVENT = "2";
export const VS_KIND_BATCH = "3";
export const VS_KIND_PREPAID = "4";

const MAX_PLAYER_NUMBER = 9999;
const MAX_SEQUENCE = 999;

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

function assertRange(value: number, max: number, what: string): void {
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`${what} musí být celé číslo 1–${max}, dostal jsem ${value}`);
  }
}

export function variableSymbolMonthly(
  playerNumber: number,
  year: number,
  month1to12: number,
): string {
  assertRange(playerNumber, MAX_PLAYER_NUMBER, "Číslo hráče");
  assertRange(month1to12, 12, "Měsíc");
  return VS_KIND_MONTHLY + pad(playerNumber, 4) + pad(year % 100, 2) + pad(month1to12, 2);
}

export function variableSymbolEvent(
  playerNumber: number,
  eventNumber: number,
): string {
  assertRange(playerNumber, MAX_PLAYER_NUMBER, "Číslo hráče");
  assertRange(eventNumber, MAX_SEQUENCE, "Číslo akce");
  return VS_KIND_EVENT + pad(playerNumber, 4) + pad(eventNumber, 3);
}

export function variableSymbolBatch(
  playerNumber: number,
  sequence: number,
): string {
  assertRange(playerNumber, MAX_PLAYER_NUMBER, "Číslo hráče");
  assertRange(sequence, MAX_SEQUENCE, "Pořadí souhrnné platby");
  return VS_KIND_BATCH + pad(playerNumber, 4) + pad(sequence, 3);
}

/**
 * Předplatné se neváže na měsíc ani na akci, proto jen pořadí u hráče.
 * Dvě místa stačí — víc než 99 předplatných hráč za život neudělá.
 */
export function variableSymbolPrepayment(
  playerNumber: number,
  sequence: number,
): string {
  assertRange(playerNumber, MAX_PLAYER_NUMBER, "Číslo hráče");
  assertRange(sequence, 99, "Pořadí předplatného");
  return VS_KIND_PREPAID + pad(playerNumber, 4) + pad(sequence, 2);
}

export type ParsedVariableSymbol =
  | { kind: "monthly"; playerNumber: number; year2: number; month: number }
  | { kind: "event"; playerNumber: number; eventNumber: number }
  | { kind: "batch"; playerNumber: number; sequence: number }
  | { kind: "prepaid"; playerNumber: number; sequence: number };

/**
 * Zpětné čtení symbolu z bankovního výpisu. Vrací null, když symbol
 * nevznikl v téhle aplikaci — třeba když hráč přepsal částku ručně.
 */
export function parseVariableSymbol(raw: string): ParsedVariableSymbol | null {
  const vs = raw.trim();
  if (!/^\d+$/.test(vs)) return null;

  if (vs.length === 9 && vs[0] === VS_KIND_MONTHLY) {
    const month = Number(vs.slice(7, 9));
    if (month < 1 || month > 12) return null;
    return {
      kind: "monthly",
      playerNumber: Number(vs.slice(1, 5)),
      year2: Number(vs.slice(5, 7)),
      month,
    };
  }
  if (vs.length === 8 && vs[0] === VS_KIND_EVENT) {
    return {
      kind: "event",
      playerNumber: Number(vs.slice(1, 5)),
      eventNumber: Number(vs.slice(5, 8)),
    };
  }
  if (vs.length === 8 && vs[0] === VS_KIND_BATCH) {
    return {
      kind: "batch",
      playerNumber: Number(vs.slice(1, 5)),
      sequence: Number(vs.slice(5, 8)),
    };
  }
  if (vs.length === 7 && vs[0] === VS_KIND_PREPAID) {
    return {
      kind: "prepaid",
      playerNumber: Number(vs.slice(1, 5)),
      sequence: Number(vs.slice(5, 7)),
    };
  }
  return null;
}
