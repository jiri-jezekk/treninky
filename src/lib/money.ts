/** Zobrazí částku v Kč z haléřů. */
export function formatCzkFromCents(cents: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Parsuje vstup typu "150", "150,5" nebo "150.50" na haléře. */
export function parseCzkToCents(input: string): number | null {
  const t = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}
