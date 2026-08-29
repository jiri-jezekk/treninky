/**
 * Pořadí v měsíční výzvě z jednotlivých pokusů.
 *
 * Podstatné je, že se počítá nejlepší pokus — ne poslední. Kdyby se
 * bral poslední, hráč by se bál zkoušet znovu, protože horší pokus
 * by mu srazil pořadí. A u výzvy na čas musí vyhrávat nižší číslo.
 */
import { isBetter, standings, type Attempt } from "../src/lib/challenge-attempts.ts";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `  ${ok ? "ok  " : "CHYBA"} ${name}` +
      (ok ? "" : `\n        čekáno ${JSON.stringify(expected)}, vyšlo ${JSON.stringify(actual)}`),
  );
}

let seq = 0;
function att(playerId: string, playerName: string, value: number, day: number): Attempt {
  return {
    id: `a${++seq}`,
    playerId,
    playerName,
    value,
    note: null,
    createdAt: new Date(2026, 8, day),
  };
}

console.log("\nVyhrává vyšší (počet shozů):");
{
  const data = [
    att("p1", "Ada", 10, 1),
    att("p1", "Ada", 14, 10),
    att("p1", "Ada", 12, 20),
    att("p2", "Bara", 13, 5),
    att("p3", "Cyril", 14, 3),
  ];
  const s = standings(data, true);
  check("nejlepší pokus, ne poslední", s.find((r) => r.playerId === "p1")!.best, 14);
  check("pořadí podle nejlepšího", s.map((r) => r.playerId), ["p1", "p3", "p2"]);
  check("shodná hodnota = shodné pořadí", s.map((r) => r.rank), [1, 1, 3]);
  check("posun za měsíc", s.find((r) => r.playerId === "p1")!.improvement, 4);
  check("tři pokusy zůstaly", s.find((r) => r.playerId === "p1")!.attempts.length, 3);
  check(
    "pokusy od nejnovějšího",
    s.find((r) => r.playerId === "p1")!.attempts.map((a) => a.value),
    [12, 14, 10],
  );
}

console.log("\nVyhrává nižší (čas):");
{
  const data = [
    att("p1", "Ada", 13.1, 1),
    att("p1", "Ada", 12.4, 15),
    att("p2", "Bara", 12.9, 2),
  ];
  const s = standings(data, false);
  check("nejlepší je nejnižší", s.find((r) => r.playerId === "p1")!.best, 12.4);
  check("rychlejší je první", s.map((r) => r.playerId), ["p1", "p2"]);
  check("zlepšení o čas je kladné", s.find((r) => r.playerId === "p1")!.improvement, 0.7);
}

console.log("\nHorší pokus neuškodí:");
{
  const dobry = standings([att("p1", "Ada", 20, 1)], true);
  const sHorsim = standings(
    [att("p1", "Ada", 20, 1), att("p1", "Ada", 3, 2)],
    true,
  );
  check("nejlepší zůstává", sHorsim[0]!.best, dobry[0]!.best);
  check("pořadí se nezmění", sHorsim[0]!.rank, dobry[0]!.rank);
}

console.log("\nPorovnání hodnot:");
check("vyšší vyhrává", isBetter(10, 5, true), true);
check("vyšší vyhrává — opačně", isBetter(5, 10, true), false);
check("nižší vyhrává", isBetter(5, 10, false), true);
check("shoda není lepší", isBetter(7, 7, true), false);
check("shoda není lepší ani u času", isBetter(7, 7, false), false);

console.log("\nOkraje:");
check("prázdná výzva", standings([], true), []);
{
  const s = standings([att("p1", "Ada", 5, 1)], true);
  check("jediný hráč je první", s.map((r) => r.rank), [1]);
  check("jediný pokus = žádný posun", s[0]!.improvement, 0);
}
{
  // Záporné hodnoty dávají smysl třeba u rozdílu oproti minulému měsíci.
  const s = standings([att("p1", "Ada", -2, 1), att("p2", "Bara", -5, 1)], true);
  check("záporné hodnoty se řadí správně", s.map((r) => r.playerId), ["p1", "p2"]);
}
{
  // Dva pokusy ve stejný okamžik nesmí shodit řazení.
  const a = att("p1", "Ada", 8, 1);
  const b = att("p1", "Ada", 9, 1);
  const s = standings([a, b], true);
  check("shodný čas zápisu", s[0]!.best, 9);
}

console.log(failures === 0 ? "\nVŠE PROŠLO" : `\nNEPROŠLO: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
