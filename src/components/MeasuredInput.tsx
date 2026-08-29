"use client";

import { splitDuration, type Measure } from "@/lib/duration";

/**
 * Pole na výsledek — podle toho, jestli se hraje na body, nebo na čas.
 *
 * Na čas jsou to dvě políčka, minuty a sekundy. Jedno pole s dvojtečkou
 * na mobilu nešlo vyplnit: číselná klávesnice nabízí jen čárku, takže
 * „1:23,45“ se nedalo napsat. Dvě čísla vedle sebe se navíc píšou
 * rychleji než jedno s oddělovačem.
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

  const { min, sec } = splitDuration(defaultValue);

  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <input
        name={`${name}Min`}
        inputMode="numeric"
        placeholder="min"
        aria-label="Minuty"
        defaultValue={min}
        className={`${box} ${compact ? "w-12" : "w-14"}`}
      />
      <span aria-hidden className="text-sm text-slate-400">
        :
      </span>
      <input
        name={`${name}Sec`}
        required={required}
        inputMode="decimal"
        placeholder="s"
        aria-label="Sekundy"
        defaultValue={sec}
        className={`${box} ${compact ? "w-14" : "w-16"}`}
      />
    </span>
  );
}
