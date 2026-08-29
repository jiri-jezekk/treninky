/**
 * Čtení hodnot z formuláře.
 *
 * Hlavně zaškrtávátka: špatné čtení tady znamenalo, že duel na čas
 * počítal obráceně, i když trenér „vyhrává vyšší“ odškrtl. Stejná chyba
 * byla u výzev a u vypínání termínu v rozvrhu.
 */
import { checkboxOn, parseDecimal } from "../src/lib/form-values.ts";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `  ${ok ? "ok  " : "CHYBA"} ${name}` +
      (ok ? "" : `\n        čekáno ${JSON.stringify(expected)}, vyšlo ${JSON.stringify(actual)}`),
  );
}

console.log("\nZaškrtávátko:");
// Tohle je ta podstatná dvojice. Nezaškrtnuté políčko se neodešle,
// takže z FormData vypadne null — a to musí znamenat „ne“.
check("nezaškrtnuté se neodešle → false", checkboxOn(null), false);
check("chybějící klíč → false", checkboxOn(undefined), false);
check("zaškrtnuté posílá „on“ → true", checkboxOn("on"), true);
check("vlastní value → true", checkboxOn("1"), true);
check("prázdná hodnota → false", checkboxOn(""), false);
check("mezery → false", checkboxOn("   "), false);
check("value=\"off\" → false", checkboxOn("off"), false);
check("value=\"false\" → false", checkboxOn("false"), false);
check("value=\"0\" → false", checkboxOn("0"), false);

console.log("\nStará podoba by tyhle případy popletla:");
const stara = (v: unknown) => v !== "off";
check("stará: nezaškrtnuté vracelo true", stara(null), true);
check("nová: nezaškrtnuté vrací false", checkboxOn(null), false);

console.log("\nČíslo z pole:");
check("prázdné → null", parseDecimal(""), null);
check("chybějící → null", parseDecimal(null), null);
check("celé číslo", parseDecimal("12"), 12);
check("desetinná tečka", parseDecimal("12.5"), 12.5);
check("desetinná čárka", parseDecimal("12,5"), 12.5);
check("mezery kolem", parseDecimal("  9,25 "), 9.25);
check("záporné", parseDecimal("-3"), -3);
check("nesmysl → null", parseDecimal("abc"), null);
check("nula projde", parseDecimal("0"), 0);

console.log(failures === 0 ? "\nVŠE PROŠLO" : `\nNEPROŠLO: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
