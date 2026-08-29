/**
 * Výřez časové osy rozboru.
 *
 * Proč to vůbec je: zápasy se natáčí živým streamem, takže záznam má
 * klidně tři hodiny a vlastní zápas v něm zabírá deset minut. Osa přes
 * celou délku pak nakupí všechny značky na pár pixelů a k ničemu není.
 * Osa se proto umí zúžit na okno kolem přehrávaného času a to okno
 * jede s videem.
 *
 * Počítá se tady, ne v komponentě, aby se to dalo otestovat — okrajové
 * případy (začátek, konec, okno delší než video) jsou přesně ta místa,
 * kde se ukazatel rozejde se značkami.
 */

export type Rozsah = { od: number; do: number };

/** Nabídka oken v sekundách; `null` je celý záznam. */
export const OKNA: readonly (number | null)[] = [300, 600, 1800, null];

export const POPIS_OKNA = new Map<number | null, string>([
  [300, "5 min"],
  [600, "10 min"],
  [1800, "30 min"],
  [null, "celé"],
]);

/**
 * Délka záznamu. Přednost má údaj z přehrávače; bez videa (stopky)
 * nebo než se přehrávač ozve se odvodí ze zápisů a z běžícího času.
 */
export function celkovaDelka(
  delkaVidea: number,
  casyZapisu: number[],
  cas: number,
): number {
  return Math.max(
    60,
    Number.isFinite(delkaVidea) ? delkaVidea : 0,
    ...casyZapisu.map((s) => s + 30),
    Math.ceil(cas) + 30,
  );
}

/**
 * Výchozí okno podle délky. Krátký záznam se vejde celý, u dlouhého
 * by celek byl nečitelný, tak se rovnou zúží — ať trenér nemusí nic
 * nastavovat, aby vůbec něco viděl.
 */
export function vychoziOkno(delka: number): number | null {
  if (delka <= 1200) return null;
  if (delka <= 3600) return 1800;
  return 600;
}

/** Výřez osy kolem přehrávaného času, přichycený k okrajům záznamu. */
export function rozsahOsy(
  delka: number,
  cas: number,
  okno: number | null,
): Rozsah {
  const celek = Math.max(1, delka);
  if (okno == null || okno >= celek) return { od: 0, do: celek };

  const stred = Math.min(Math.max(cas, 0), celek);
  const od = Math.min(Math.max(stred - okno / 2, 0), celek - okno);
  return { od, do: od + okno };
}

/** Poloha v procentech výřezu; mimo výřez vrací null (nekreslí se). */
export function polohaVeVyrezu(sekundy: number, r: Rozsah): number | null {
  const sirka = r.do - r.od;
  if (sirka <= 0) return null;
  const pct = ((sekundy - r.od) / sirka) * 100;
  if (pct < 0 || pct > 100) return null;
  return pct;
}
