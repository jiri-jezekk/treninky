/**
 * Pokusy v měsíční výzvě.
 *
 * Dřív měl hráč ve výzvě jediný zápis a druhý pokus ten první přepsal.
 * To bralo výzvě smysl: celý měsíc se má být vidět, jak se kdo posouvá.
 * Teď je jeden řádek jeden pokus, do pořadí se počítá ten nejlepší
 * a ostatní zůstávají jako historie.
 *
 * Relativní cesty schválně: tenhle soubor spouští i kontrolní skript
 * mimo Next.js, kde alias @/ neexistuje.
 */

export type Attempt = {
  id: string;
  playerId: string;
  playerName: string;
  value: number;
  note: string | null;
  createdAt: Date;
};

export type PlayerStanding = {
  playerId: string;
  playerName: string;
  /** Nejlepší pokus — ten se počítá do pořadí. */
  best: number;
  /** Id nejlepšího pokusu, ať ho jde v seznamu zvýraznit. */
  bestAttemptId: string;
  attempts: Attempt[];
  /** Pořadí od 1; při shodné hodnotě sdílené. */
  rank: number;
  /**
   * O kolik se hráč zlepšil od prvního pokusu k nejlepšímu.
   * Kladné číslo znamená zlepšení bez ohledu na to, jestli se
   * ve výzvě šplhá nahoru (počet shozů) nebo dolů (čas).
   */
  improvement: number;
};

/**
 * Zaokrouhlení na tři desetinná místa. Výzvy se zapisují na setiny
 * (sekundy, kilometry), takže tři místa jsou s rezervou dost a rozdíly
 * nevycházejí jako 0,6999999999999993.
 */
function roundValue(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Je `a` lepší než `b`? U času vede nižší číslo. */
export function isBetter(a: number, b: number, higherWins: boolean): boolean {
  return higherWins ? a > b : a < b;
}

/**
 * Pořadí ve výzvě z jednotlivých pokusů.
 *
 * Hráči se seřadí podle nejlepšího pokusu, pokusy uvnitř podle času
 * zápisu (nejnovější nahoře), aby byl vidět průběh měsíce.
 * Shodná hodnota = shodné pořadí (1, 2, 2, 4) — stejně jako v Elu,
 * jinak by se pořadí a rating rozešly.
 */
export function standings(
  attempts: Attempt[],
  higherWins: boolean,
): PlayerStanding[] {
  const byPlayer = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const list = byPlayer.get(a.playerId);
    if (list) list.push(a);
    else byPlayer.set(a.playerId, [a]);
  }

  const rows: PlayerStanding[] = [];
  for (const [playerId, list] of byPlayer) {
    // Nejstarší první — od toho se měří posun za měsíc.
    const chronological = [...list].sort(
      (x, y) => x.createdAt.getTime() - y.createdAt.getTime(),
    );
    const first = chronological[0]!;

    let best = first;
    for (const a of chronological) {
      if (isBetter(a.value, best.value, higherWins)) best = a;
    }

    rows.push({
      playerId,
      playerName: first.playerName,
      best: best.value,
      bestAttemptId: best.id,
      // V seznamu se čte odshora dolů jako novinky.
      attempts: [...chronological].reverse(),
      rank: 0,
      // Zaokrouhlení schválně: 13,1 − 12,4 vyjde v plovoucí čárce jako
      // 0,6999999999999993 a přesně tohle by se ukázalo hráči na obrazovce.
      improvement: roundValue(
        higherWins ? best.value - first.value : first.value - best.value,
      ),
    });
  }

  rows.sort(
    (a, b) =>
      (higherWins ? b.best - a.best : a.best - b.best) ||
      a.playerName.localeCompare(b.playerName, "cs"),
  );

  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && prev.best === r.best ? prev.rank : i + 1;
  });

  return rows;
}
