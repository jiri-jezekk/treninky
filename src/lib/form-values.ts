/**
 * Čtení hodnot z formuláře.
 *
 * Relativní cesty schválně: tenhle soubor spouští i kontrolní skript
 * mimo Next.js, kde alias @/ neexistuje.
 */

/**
 * Zaškrtávátko z formuláře.
 *
 * Nezaškrtnuté políčko se **neodešle vůbec** — v FormData po něm není
 * ani stopa. Proto se musí ptát „přišlo to?“, ne „nepřišlo off?“.
 * Podoba `formData.get(x) !== "off"` vrací u nezaškrtnutého políčka
 * `true`, protože `get` vrátí `null` a `null !== "off"` platí. Přesně
 * kvůli tomu šlo u duelu odškrtnout „vyhrává vyšší číslo“ a stejně se
 * počítalo, že vyhrává vyšší.
 *
 * Prohlížeč posílá „on“, pokud políčko nemá vlastní `value`. Bereme
 * ale jakoukoli hodnotu, aby fungovalo i `value="1"`; jediné, co
 * neprojde, je prázdný řetězec a chybějící klíč.
 */
export function checkboxOn(value: unknown): boolean {
  if (value == null) return false;
  const v = String(value).trim();
  if (v === "") return false;
  // Kdyby někdo políčku dal value="off" nebo value="false", ať to
  // znamená to, co je tam napsané.
  return v !== "off" && v !== "false" && v !== "0";
}

/** Číslo z textového pole; přijímá i desetinnou čárku. Prázdné = null. */
export function parseDecimal(raw: unknown): number | null {
  const value = String(raw ?? "").trim().replace(",", ".");
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
