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

/**
 * Který zápis „platí“ v daném čase videa.
 *
 * Kdo se dívá, potřebuje jednu věc: vidět u videa akci, která se právě
 * stala nebo se blíží — bez scrollování v dlouhém seznamu. Chvíli po
 * akci se drží ta proběhlá (to je ta, co člověk zrovna viděl), jinak
 * ukazuje nejbližší další. Na konci záznamu zůstane poslední.
 *
 * Zápisy musí být seřazené podle času; vrací index, ne kopii, aby si
 * volající mohl doplnit vlastní data.
 */
export function indexBoduVCase<T extends { atSeconds: number }>(
  events: readonly T[],
  cas: number,
  prodleva = 8,
): number | null {
  if (events.length === 0) return null;

  let proslyy = -1;
  for (let i = 0; i < events.length; i++) {
    if (events[i]!.atSeconds <= cas) proslyy = i;
    else break;
  }

  // Čerstvě proběhlá akce má přednost — na tu se člověk zrovna dívá.
  if (proslyy >= 0 && cas - events[proslyy]!.atSeconds <= prodleva) return proslyy;

  const dalsi = proslyy + 1;
  if (dalsi < events.length) return dalsi;
  return proslyy >= 0 ? proslyy : null;
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
