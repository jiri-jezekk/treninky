/**
 * Zadávání a zobrazování času.
 *
 * Dřív se čas četl jako holé číslo sekund, takže „1:23“ neprošlo
 * a psaly se celé vteřiny. U běhu nebo člunkového běhu rozhoduje
 * desetina, takže to nestačilo.
 */
import {
  formatDuration,
  formatMeasured,
  parseDuration,
  parseMeasured,
  parseScoreMode,
  scoreModeOf,
} from "../src/lib/duration.ts";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `  ${ok ? "ok  " : "CHYBA"} ${name}` +
      (ok ? "" : `\n        čekáno ${JSON.stringify(expected)}, vyšlo ${JSON.stringify(actual)}`),
  );
}

console.log("\nČtení času:");
check("holé sekundy", parseDuration("83"), 83);
check("sekundy s desetinnou tečkou", parseDuration("83.4"), 83.4);
check("sekundy s desetinnou čárkou", parseDuration("83,4"), 83.4);
check("minuty a sekundy", parseDuration("1:23"), 83);
check("minuty, sekundy a setiny", parseDuration("1:23,45"), 83.45);
check("hodiny, minuty, sekundy", parseDuration("1:02:03"), 3723);
check("mezery kolem", parseDuration("  2:05  "), 125);
check("nula", parseDuration("0"), 0);
check("dlouhý běh po Ještědu", parseDuration("38:24"), 2304);

console.log("\nCo časem není:");
check("prázdné", parseDuration(""), null);
check("chybějící", parseDuration(null), null);
check("text", parseDuration("abc"), null);
check("záporné", parseDuration("-5"), null);
check("záporné v minutách", parseDuration("-1:20"), null);
check("prázdná část", parseDuration("1::20"), null);
check("chybějící sekundy", parseDuration("1:"), null);
// 70 sekund je překlep, ne minuta a deset vteřin — kdyby to prošlo,
// zapsal by se jiný čas, než jaký hráč běžel.
check("sekundy nad 59", parseDuration("1:70"), null);
check("minuty nad 59 u hodin", parseDuration("1:70:00"), null);
check("čtyři části", parseDuration("1:2:3:4"), null);

console.log("\nZobrazení času:");
check("celé minuty", formatDuration(120), "2:00");
check("minuty a sekundy", formatDuration(83), "1:23");
check("se setinami", formatDuration(83.45), "1:23,45");
check("setiny se zaokrouhlí", formatDuration(83.456), "1:23,46");
check("pod minutu", formatDuration(9.2), "0:09,20");
check("přes hodinu", formatDuration(3723), "1:02:03");
check("nula", formatDuration(0), "0:00");
check("nesmysl", formatDuration(Number.NaN), "—");

console.log("\nTam a zpátky:");
for (const vstup of ["1:23,45", "0:09,20", "38:24", "1:02:03"]) {
  const zpet = formatDuration(parseDuration(vstup)!);
  check(`„${vstup}“ přežije kolečko`, zpet, vstup);
}

console.log("\nPodle druhu měření:");
check("na čas se čte jako čas", parseMeasured("1:23", "TIME"), 83);
check("na body se čte jako číslo", parseMeasured("23", "POINTS"), 23);
// Na body dvojtečka nedává smysl a nesmí se tvářit jako čas.
check("na body dvojtečka neprojde", parseMeasured("1:23", "POINTS"), null);
check("na body i záporné číslo", parseMeasured("-3", "POINTS"), -3);
check("zobrazení času", formatMeasured(83.45, "TIME"), "1:23,45");
check("zobrazení bodů s jednotkou", formatMeasured(12, "POINTS", "shozů"), "12 shozů");
check("zobrazení bodů bez jednotky", formatMeasured(12, "POINTS", null), "12");
check("desetinné body s čárkou", formatMeasured(12.5, "POINTS", null), "12,5");
check("prázdná hodnota", formatMeasured(null, "TIME"), "—");

console.log("\nVolba v formuláři:");
check("na čas", parseScoreMode("time"), { measure: "TIME", higherWins: false });
check("na body, vyšší", parseScoreMode("points-high"), { measure: "POINTS", higherWins: true });
check("na body, nižší", parseScoreMode("points-low"), { measure: "POINTS", higherWins: false });
// Neznámá hodnota nesmí tiše obrátit, kdo vyhrává.
check("nesmysl → body, vyšší", parseScoreMode("xxx"), { measure: "POINTS", higherWins: true });
check("chybějící → body, vyšší", parseScoreMode(null), { measure: "POINTS", higherWins: true });

console.log("\nTam a zpátky přes volbu:");
for (const mode of ["time", "points-high", "points-low"] as const) {
  const { measure, higherWins } = parseScoreMode(mode);
  check(`„${mode}“ přežije kolečko`, scoreModeOf(measure, higherWins), mode);
}

console.log(failures === 0 ? "\nVŠE PROŠLO" : `\nNEPROŠLO: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
