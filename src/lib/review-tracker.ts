/**
 * Drobná logika zapisovacího panelu rozboru.
 *
 * Není to o vzhledu: obojí tady jsou místa, kde se chyba projeví až
 * při zápase — panel zmizí za hranou obrazovky, nebo se poznámka pověsí
 * na cizí zápis. Proto je to mimo komponentu a otestované.
 */

export type Ramec = { x: number; y: number; w: number; h: number };
export type Okno = { w: number; h: number };

export const MIN_W = 180;
export const MIN_H = 120;
const OKRAJ = 8;

/**
 * Přichytí panel do obrazovky. Zatáhnout ho za hranu by znamenalo
 * přijít o něj — myší se pro něj už nedá vrátit.
 */
export function omezRamec(r: Ramec, okno: Okno): Ramec {
  const w = Math.min(Math.max(r.w, MIN_W), Math.max(MIN_W, okno.w - 2 * OKRAJ));
  const h = Math.min(Math.max(r.h, MIN_H), Math.max(MIN_H, okno.h - 2 * OKRAJ));
  return {
    w,
    h,
    x: Math.min(Math.max(r.x, OKRAJ), Math.max(OKRAJ, okno.w - w - OKRAJ)),
    y: Math.min(Math.max(r.y, OKRAJ), Math.max(OKRAJ, okno.h - h - OKRAJ)),
  };
}

export type KlicZapisu = { typeId: string; at: number };

/**
 * Najde poslední naklikaný zápis.
 *
 * Nedrží se id: čekající zápis ho po uložení vymění za serverové a
 * poznámka by se přestala mít čeho chytit. Typ a zaokrouhlený čas
 * přežijou obojí. Hledá se od konce, aby při shodě vyhrál novější.
 */
export function najdiPosledniZapis<T extends { typeId: string; atSeconds: number }>(
  events: readonly T[],
  klic: KlicZapisu | null,
): T | null {
  if (klic == null) return null;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.typeId === klic.typeId && Math.round(e.atSeconds) === klic.at) return e;
  }
  return null;
}
