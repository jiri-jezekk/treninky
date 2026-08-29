/**
 * Čas jako hodnota v duelu nebo výzvě.
 *
 * Dřív se čas zadával jedním číslem, které se četlo jako sekundy —
 * takže „1:23“ neprošlo vůbec a psaly se celé vteřiny. Na běh po
 * Ještědu nebo na člunkový běh to nestačí: rozhoduje desetina.
 *
 * Ukládá se vždycky v sekundách (Float), zadávat se dá po lidsku.
 *
 * Relativní cesty schválně: tenhle soubor spouští i kontrolní skript
 * mimo Next.js, kde alias @/ neexistuje.
 */

/**
 * Čas na sekundy. Přijímá:
 *   „83“, „83,4“        → 83 / 83,4 s
 *   „1:23“, „1:23,45“   → minuty:sekundy
 *   „1:02:03“           → hodiny:minuty:sekundy
 *
 * Vrací null, když to čas není. Záporný čas neexistuje, takže taky null.
 */
export function parseDuration(raw: unknown): number | null {
  const value = String(raw ?? "").trim().replace(",", ".");
  if (value === "") return null;

  const parts = value.split(":");
  if (parts.length > 3) return null;

  // Bez dvojtečky je to prostě počet sekund.
  if (parts.length === 1) {
    const n = Number(parts[0]);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!.trim();
    if (part === "") return null;
    const n = Number(part);
    if (!Number.isFinite(n) || n < 0) return null;
    // Minuty a sekundy nad 59 by znamenaly překlep, ne delší čas.
    if (i > 0 && n >= 60) return null;
    total = total * 60 + n;
  }
  return total;
}

/**
 * Sekundy zpátky na „1:23,45“.
 *
 * Desetiny se ukazují jen když nějaké jsou — „2:00“ se čte líp
 * než „2:00,00“. Hodiny se přidají, až když je čas přesáhne.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";

  const celkem = Math.round(seconds * 100) / 100;
  const h = Math.floor(celkem / 3600);
  const m = Math.floor((celkem % 3600) / 60);
  const s = celkem - h * 3600 - m * 60;

  const zlomek = Math.round((s - Math.floor(s)) * 100);
  const cele = String(Math.floor(s)).padStart(2, "0");
  const sek = zlomek === 0 ? cele : `${cele},${String(zlomek).padStart(2, "0")}`;

  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${sek}`;
  return `${m}:${sek}`;
}

/**
 * Jak se výsledek měří. Rozhoduje o tom, jak se hodnota zadává,
 * jak se zobrazuje a kdo vyhrává.
 */
export type Measure = "POINTS" | "TIME";

/** Přečte hodnotu podle druhu měření. */
export function parseMeasured(raw: unknown, measure: Measure): number | null {
  if (measure === "TIME") return parseDuration(raw);
  const value = String(raw ?? "").trim().replace(",", ".");
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Zobrazí hodnotu podle druhu měření. */
export function formatMeasured(
  value: number | null,
  measure: Measure,
  unit?: string | null,
): string {
  if (value == null) return "—";
  if (measure === "TIME") return formatDuration(value);
  const n = Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
  return unit ? `${n} ${unit}` : n;
}

/**
 * Nápověda pod polem, ať je jasné, co se čeká.
 *
 * Musí sedět s tím, jak pole doopravdy vypadá. Dřív tu stálo
 * „např. 1:23,45“, jenže čas se zadává do dvou políček a dvojtečka se
 * nepíše — návod tak radil něco jiného, než co šlo vyplnit.
 */
export function measureHint(measure: Measure, unit?: string | null): string {
  if (measure === "TIME") {
    return "minuty a sekundy zvlášť; setiny za čárkou, třeba 38 : 24,50";
  }
  return unit ? `číslo v jednotkách: ${unit}` : "číslo";
}

/**
 * Volba v formuláři. Jedna rozbalovačka místo zaškrtávátka „vyhrává
 * vyšší“ — to bylo matoucí a navíc kvůli němu nešlo poznat, že se hraje
 * na čas. Tři možnosti pokryjí všechno, co klub potřebuje.
 */
export type ScoreMode = "points-high" | "points-low" | "time";

export const SCORE_MODE_LABELS: Record<ScoreMode, string> = {
  "points-high": "Na body — vyhrává vyšší",
  "points-low": "Na body — vyhrává nižší",
  time: "Na čas — vyhrává kratší",
};

/** Z formuláře na to, co se ukládá. Neznámá hodnota = body, vyšší vyhrává. */
export function parseScoreMode(raw: unknown): {
  measure: Measure;
  higherWins: boolean;
} {
  switch (String(raw ?? "")) {
    case "time":
      return { measure: "TIME", higherWins: false };
    case "points-low":
      return { measure: "POINTS", higherWins: false };
    default:
      return { measure: "POINTS", higherWins: true };
  }
}

/** Zpátky z uloženého na volbu ve formuláři. */
export function scoreModeOf(measure: Measure, higherWins: boolean): ScoreMode {
  if (measure === "TIME") return "time";
  return higherWins ? "points-high" : "points-low";
}

/**
 * Hodnota z formuláře, kde se čas zadává po částech.
 *
 * Na mobilu má číselná klávesnice jen čárku — dvojtečka na ní není,
 * takže „1:23,45“ tam nešlo napsat. Čas se proto zadává do dvou polí
 * (minuty a sekundy) a skládá se až tady. Jedno pole s dvojtečkou
 * zůstává funkční pro počítač.
 *
 * Pořadí: nejdřív dvojice `<base>Min` / `<base>Sec`, jinak `<base>`.
 */
export function readMeasuredValue(
  form: { get(name: string): unknown },
  base: string,
  measure: Measure,
): number | null {
  if (measure === "TIME") {
    const min = String(form.get(`${base}Min`) ?? "").trim();
    const sec = String(form.get(`${base}Sec`) ?? "").trim();
    if (min !== "" || sec !== "") {
      // Prázdná půlka znamená nulu, ne chybu — kdo běžel 43 vteřin,
      // nemá do minut psát nulu.
      return parseDuration(`${min === "" ? "0" : min}:${sec === "" ? "0" : sec}`);
    }
  }
  return parseMeasured(form.get(base), measure);
}

/** Minuty a sekundy zvlášť — pro předvyplnění dvou polí. */
export function splitDuration(seconds: number | null | undefined): {
  min: string;
  sec: string;
} {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return { min: "", sec: "" };
  }
  const celkem = Math.round(seconds * 100) / 100;
  const min = Math.floor(celkem / 60);
  const sec = Math.round((celkem - min * 60) * 100) / 100;
  return { min: String(min), sec: String(sec).replace(".", ",") };
}
