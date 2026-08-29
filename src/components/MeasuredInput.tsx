"use client";

import { splitDuration, type Measure } from "@/lib/duration";

/**
 * Pole na výsledek — podle toho, jestli se hraje na body, nebo na čas.
 *
 * Na čas jsou to tři políčka: minuty, sekundy a setiny. Jedno pole
 * s dvojtečkou na mobilu vyplnit nešlo — číselná klávesnice dvojtečku
 * nenabízí — a ani čárka na ní není spolehlivě, takže i setiny musí mít
 * vlastní políčko. Tři čísla vedle sebe se navíc píšou rychleji než
 * jedno s oddělovači.
 *
 * Skládá se to až na serveru (readMeasuredValue), takže tohle nepotřebuje
 * žádný stav a funguje i bez javascriptu.
 */
export function MeasuredInput({
  name,
  measure,
  defaultValue,
  required,
  compact,
  className,
}: {
  /** Základ jména; na čas se posílají `<name>Min` a `<name>Sec`. */
  name: string;
  measure: Measure;
  defaultValue?: number | null;
  required?: boolean;
  /** Užší podoba do řádku s dalšími ovládacími prvky. */
  compact?: boolean;
  className?: string;
}) {
  const box =
    "rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm tabular-nums text-slate-900 outline-none focus:border-club";

  if (measure !== "TIME") {
    return (
      <input
        name={name}
        required={required}
        inputMode="decimal"
        placeholder="0"
        defaultValue={defaultValue ?? ""}
        className={className ?? `${box} ${compact ? "w-20" : "w-24"}`}
      />
    );
  }

  const { min, sec, cent } = splitDuration(defaultValue);

  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      <input
        name={`${name}Min`}
        inputMode="numeric"
        placeholder="min"
        aria-label="Minuty"
        defaultValue={min}
        className={`${box} ${compact ? "w-11" : "w-14"}`}
      />
      <span aria-hidden className="px-0.5 text-sm text-slate-400">
        :
      </span>
      <input
        name={`${name}Sec`}
        required={required}
        inputMode="numeric"
        placeholder="s"
        aria-label="Sekundy"
        defaultValue={sec}
        className={`${box} ${compact ? "w-11" : "w-14"}`}
      />
      <span aria-hidden className="px-0.5 text-sm text-slate-400">
        ,
      </span>
      <input
        name={`${name}Cent`}
        inputMode="numeric"
        placeholder="00"
        aria-label="Setiny sekundy"
        defaultValue={cent}
        className={`${box} ${compact ? "w-11" : "w-14"}`}
      />
    </span>
  );
}
