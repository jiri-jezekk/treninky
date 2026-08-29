/**
 * Výsledek akce, kterou spouští tlačítko.
 *
 * Server action, která vyhodí výjimku, skončí na produkci obecnou
 * stránkou „A server error occurred“ — bez důvodu, bez čísla řádku,
 * bez čehokoli, co by šlo poslat dál. Přesně tak vypadal pád při
 * vyhodnocení zápasu a nebylo z něj poznat vůbec nic.
 *
 * Akce, které mění rating, proto nevyhazují: chybu chytí a vrátí
 * textem, který se ukáže vedle tlačítka.
 *
 * Typy jsou schválně tady, ne v souboru s „use server“ — tam smí být
 * exportované jen asynchronní funkce.
 */
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

/** Výchozí stav pro useActionState, než se na tlačítko klikne. */
export const IDLE_RESULT: ActionResult | null = null;

/** Náhled vyhodnocení zápasu — kdo kolik dostane, ještě před kliknutím. */
export type MatchPreviewTeam = {
  teamId: string;
  teamName: string;
  rank: number;
  /** Průměrný rating týmu — z něj se počítá. */
  rating: number;
  /** Kolik dostane každý člen. */
  delta: number;
  members: { playerId: string; playerName: string; rating: number }[];
};
