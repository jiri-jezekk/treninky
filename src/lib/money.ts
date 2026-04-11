/** Zobrazí částku v Kč z haléřů. */
export function formatCzkFromCents(cents: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Výchozí hodnota pro input Kč z haléřů (celé koruny nebo desetinná). */
export function formatKcInputFromCents(cents: number): string {
  const kc = cents / 100;
  if (Number.isInteger(kc)) return String(kc);
  return String(kc).replace(".", ",");
}

/** Parsuje vstup typu "150", "150,5" nebo "150.50" na haléře. */
export function parseCzkToCents(input: string): number | null {
  const t = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

/**
 * Haléře (může být necelé z výpočtu) → vždy nahoru na celé koruny.
 * Nikdy „matematické“ zaokrouhlování dolů — aby výplata nebyla pod dílem.
 */
export function ceilCentsToWholeKoruny(cents: number): number {
  if (cents <= 0) return 0;
  return Math.ceil(cents / 100) * 100;
}

/**
 * Zadání částky v Kč — vždy nahoru na celé koruny (100,1 → 101 Kč), pak na haléře.
 * Pro skupinové platby a QR, kde nechceme zůstat pod celým Kč.
 */
export function parseCzkToCentsCeilWholeKoruny(input: string): number | null {
  const t = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.ceil(n) * 100;
}
