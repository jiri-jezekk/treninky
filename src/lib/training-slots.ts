/**
 * Rozvrh — pravidelné termíny klubu.
 *
 * Dřív byly úterý a čtvrtek napevno v kódu a generátor uměl jen jeden čas
 * pro oba dny. Teď je rozvrh data: den, od–do a cena, cokoli z toho se dá
 * změnit bez zásahu do kódu.
 */

/** Termín rozvrhu, jak ho potřebuje generování. */
export type Slot = {
  id: string;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  priceCents: number;
};

export const DAY_NAMES = [
  "neděle",
  "pondělí",
  "úterý",
  "středa",
  "čtvrtek",
  "pátek",
  "sobota",
];

/** 2. pád pro věty typu „vygeneruj všechna úterý“. */
export const DAY_NAMES_PLURAL = [
  "neděle",
  "pondělky",
  "úterky",
  "středy",
  "čtvrtky",
  "pátky",
  "soboty",
];

/** 1080 → „18:00“ */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** „18:00“ → 1080. Vrací null, když to není platný čas. */
export function parseMinutes(raw: unknown): number | null {
  const value = String(raw ?? "").trim();
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** „úterý 18:00–20:00“ */
export function describeSlot(slot: Slot): string {
  return `${DAY_NAMES[slot.dayOfWeek] ?? "?"} ${formatMinutes(slot.startMinutes)}–${formatMinutes(slot.endMinutes)}`;
}

export type PlannedTraining = {
  slotId: string;
  startsAt: Date;
  endsAt: Date;
  priceCents: number;
};

/**
 * Termíny, které v období vycházejí na zadané sloty.
 *
 * Obě hranice období jsou včetně. Konec po půlnoci (např. 22:00–00:30)
 * se posune na další den, aby délka nevyšla záporná.
 */
export function planTrainings(
  slots: Slot[],
  from: Date,
  to: Date,
): PlannedTraining[] {
  const planned: PlannedTraining[] = [];
  if (slots.length === 0) return planned;

  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  // Pojistka proti zacyklení, kdyby přišlo nesmyslně velké období.
  let guard = 0;
  while (cursor <= last && guard++ < 4000) {
    for (const slot of slots) {
      if (slot.dayOfWeek !== cursor.getDay()) continue;

      const startsAt = new Date(cursor);
      startsAt.setHours(
        Math.floor(slot.startMinutes / 60),
        slot.startMinutes % 60,
        0,
        0,
      );

      const endsAt = new Date(cursor);
      endsAt.setHours(Math.floor(slot.endMinutes / 60), slot.endMinutes % 60, 0, 0);
      if (slot.endMinutes <= slot.startMinutes) {
        endsAt.setDate(endsAt.getDate() + 1);
      }

      planned.push({
        slotId: slot.id,
        startsAt,
        endsAt,
        priceCents: slot.priceCents,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return planned.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * Klíč pro rozpoznání už existujícího tréninku. Generování se pouští
 * opakovaně (třeba po přidání termínu do rozvrhu) a nesmí dělat duplikáty —
 * ty by hráčům zdvojily platby.
 */
export function occurrenceKey(startsAt: Date): string {
  return [
    startsAt.getFullYear(),
    startsAt.getMonth() + 1,
    startsAt.getDate(),
    startsAt.getHours(),
    startsAt.getMinutes(),
  ].join("-");
}

/** Rozdělí naplánované termíny na nové a na ty, které už v databázi jsou. */
export function splitExisting(
  planned: PlannedTraining[],
  existing: { startsAt: Date }[],
): { toCreate: PlannedTraining[]; skipped: PlannedTraining[] } {
  const taken = new Set(existing.map((t) => occurrenceKey(t.startsAt)));
  const toCreate: PlannedTraining[] = [];
  const skipped: PlannedTraining[] = [];

  for (const p of planned) {
    if (taken.has(occurrenceKey(p.startsAt))) {
      skipped.push(p);
    } else {
      // I v rámci jednoho běhu — dva stejné sloty by jinak prošly oba.
      taken.add(occurrenceKey(p.startsAt));
      toCreate.push(p);
    }
  }

  return { toCreate, skipped };
}
