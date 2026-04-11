/**
 * Rozdělí `totalCents` rovnoměrně mezi `count` osob tak, aby součet přesně odpovídal celku.
 * Zbytek po dělení se přidá prvním k účastníkům (+1 haléř).
 */
export function splitTotalCents(totalCents: number, count: number): number[] {
  if (count <= 0) return [];
  if (totalCents < 0) throw new Error("totalCents must be non-negative");
  const base = Math.floor(totalCents / count);
  const rem = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < rem ? 1 : 0));
}

import { ceilCentsToWholeKoruny } from "@/lib/money";

/**
 * Rovnoměrný podíl; každý díl se vždy **navýší na celé koruny nahoru**
 * (jakýkoli zbytek pod celým Kč → další koruna). Součet dílů může přesáhnout původní total.
 */
export function splitTotalCentsCeilWholeKc(totalCents: number, count: number): number[] {
  if (count <= 0) return [];
  if (totalCents < 0) throw new Error("totalCents must be non-negative");
  const raw = totalCents / count;
  return Array.from({ length: count }, () => ceilCentsToWholeKoruny(raw));
}
