/**
 * Předplacená období.
 *
 * Dřív to byl přepínač na hráči a platil zpětně: zaškrtnutím v listopadu
 * zmizely hráči z plateb i září a říjen. Teď je předplatné záznam s obdobím,
 * takže se rozhoduje **podle data konkrétního tréninku** — loňské platby
 * zůstanou, i když si hráč předplatí letošní sezónu.
 */

/** Období předplatného. Obě hranice jsou včetně. */
export type PrepaidRange = {
  startsOn: Date;
  endsOn: Date;
};

/** Den jako YYYY-MM-DD v místním čase — bez posunu, který dělá UTC u půlnocí. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Spadá datum do některého předplaceného období?
 *
 * Porovnáváme řetězce dne, ne časy: `startsOn` přichází z DATE sloupce jako
 * půlnoc UTC, kdežto trénink má 19:30 místního času. Přímé porovnání Date
 * by u tréninku prvního dne sezóny vyšlo špatně.
 */
export function isPrepaidOn(ranges: PrepaidRange[], date: Date): boolean {
  const day = dayKey(date);
  for (const r of ranges) {
    if (day >= dayKeyUtc(r.startsOn) && day <= dayKeyUtc(r.endsOn)) return true;
  }
  return false;
}

/** DATE sloupec čteme v UTC — Prisma ho vrací jako půlnoc UTC daného dne. */
export function dayKeyUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Má hráč předplacený celý kalendářní měsíc?
 * Používá se jen pro popisky — účtuje se vždy po jednotlivých trénincích.
 */
export function coversWholeMonth(
  ranges: PrepaidRange[],
  year: number,
  month1to12: number,
): boolean {
  const first = new Date(year, month1to12 - 1, 1);
  const last = new Date(year, month1to12, 0);
  return isPrepaidOn(ranges, first) && isPrepaidOn(ranges, last);
}

/** Překrývají se dvě období? Hranice se počítají jako obsazené. */
export function rangesOverlap(a: PrepaidRange, b: PrepaidRange): boolean {
  return (
    dayKeyUtc(a.startsOn) <= dayKeyUtc(b.endsOn) &&
    dayKeyUtc(b.startsOn) <= dayKeyUtc(a.endsOn)
  );
}

/** „1. 9. 2026 – 30. 6. 2027“ */
export function formatRangeCs(range: PrepaidRange): string {
  return `${formatDayCs(range.startsOn)} – ${formatDayCs(range.endsOn)}`;
}

function formatDayCs(date: Date): string {
  return `${date.getUTCDate()}. ${date.getUTCMonth() + 1}. ${date.getUTCFullYear()}`;
}

/**
 * Vstup z <input type="date"> na hodnotu do DATE sloupce.
 * Půlnoc UTC, aby se den cestou do databáze neposunul.
 */
export function parseDateInput(raw: FormDataEntryValue | null): Date | null {
  const value = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Hodnota pro <input type="date" defaultValue>. */
export function toDateInputValue(date: Date): string {
  return dayKeyUtc(date);
}
