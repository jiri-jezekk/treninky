/**
 * Jak se cvičení z knihovny používá — kdy naposledy a jak dopadlo.
 *
 * Čistý výpočet nad řádky „bod plánu“; databázi řeší volající.
 */

export type DrillUsageRow = {
  drillId: string;
  /** Začátek plánu, ve kterém bod je. */
  startsAt: Date;
  /** Kategorie plánu. */
  groupId: string | null;
  /** 1 = fungovalo, -1 = nefungovalo, null = bez hodnocení. */
  rating: number | null;
};

export type DrillUsage = {
  /** Poslední proběhlý plán s tímto cvičením (pro danou kategorii). */
  lastUsed: Date | null;
  /** Kolikrát fungovalo / nefungovalo — napříč kategoriemi. */
  up: number;
  down: number;
};

/** Po kolika dnech je cvičení „dlouho nepoužité“. */
export const STALE_DAYS = 30;

/**
 * Souhrn použití po cvičeních. Do „naposledy“ se počítají jen plány,
 * které už proběhly (začátek ≤ `now`) — naplánované dopředu ještě nejsou
 * opakování. S `groupId` jen plány té kategorie; hodnocení se sčítá vždy
 * ze všech, zkušenost s cvičením platí obecně.
 */
export function summarizeDrillUsage(
  rows: DrillUsageRow[],
  now: Date,
  groupId: string | null = null,
): Map<string, DrillUsage> {
  const out = new Map<string, DrillUsage>();
  for (const r of rows) {
    const u = out.get(r.drillId) ?? { lastUsed: null, up: 0, down: 0 };
    if (r.rating === 1) u.up++;
    if (r.rating === -1) u.down++;
    const counts = r.startsAt <= now && (groupId == null || r.groupId === groupId);
    if (counts && (!u.lastUsed || r.startsAt > u.lastUsed)) u.lastUsed = r.startsAt;
    out.set(r.drillId, u);
  }
  return out;
}

/** Celé kalendářní dny mezi dvěma okamžiky v místním čase. */
function daysBetween(earlier: Date, later: Date): number {
  const a = new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  const b = new Date(later.getFullYear(), later.getMonth(), later.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Nepoužité vůbec, nebo naposledy před víc než `days` dny. */
export function isStale(lastUsed: Date | null, now: Date, days = STALE_DAYS): boolean {
  return lastUsed == null || daysBetween(lastUsed, now) > days;
}

/** „dnes“, „včera“, „před 5 dny“, starší jako „3. 9.“ (s rokem, je-li jiný). */
export function formatLastUsed(lastUsed: Date | null, now: Date): string {
  if (!lastUsed) return "ještě ne";
  const days = daysBetween(lastUsed, now);
  if (days <= 0) return "dnes";
  if (days === 1) return "včera";
  if (days <= 30) return `před ${days} dny`;
  const date = `${lastUsed.getDate()}. ${lastUsed.getMonth() + 1}.`;
  return lastUsed.getFullYear() === now.getFullYear()
    ? date
    : `${date} ${lastUsed.getFullYear()}`;
}
