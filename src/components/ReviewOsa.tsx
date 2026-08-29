"use client";

import type { Rozsah } from "@/lib/review-timeline";
import { polohaVeVyrezu } from "@/lib/review-timeline";
import type { StatType } from "@/lib/review-stats";

/**
 * Časová osa rozboru — sdílená trenérem i hráčem.
 *
 * Byla původně jen v zapisování. Hráč ji chce taky: na myši se mezi
 * body proklikává rychleji než seznamem a hned vidí, kde v zápase se
 * co dělo.
 */

export type BodOsy = {
  id: string;
  typeId: string;
  atSeconds: number;
};

/**
 * Časová osa se značkami. Pro nás nahoře, proti nám dole.
 *
 * Kreslí se jen výřez `rozsah`, ne celý záznam — u tříhodinového
 * streamu je celek k ničemu.
 */
export function Osa({
  rozsah,
  cas,
  events,
  typById,
  onSeek,
}: {
  rozsah: Rozsah;
  cas: number;
  events: BodOsy[];
  typById: Map<string, StatType>;
  onSeek: (s: number) => void;
}) {
  const sirka = Math.max(1, rozsah.do - rozsah.od);
  const pct = polohaVeVyrezu(cas, rozsah);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Časová osa"
      onClick={(e) => {
        const b = e.currentTarget.getBoundingClientRect();
        onSeek(rozsah.od + ((e.clientX - b.left) / b.width) * sirka);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onSeek(Math.max(0, cas - 5));
        if (e.key === "ArrowRight") onSeek(cas + 5);
      }}
      className="relative h-11 cursor-pointer overflow-hidden rounded-md border border-slate-200 bg-slate-50"
    >
      <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
      {pct != null && (
        <div className="absolute inset-y-0 left-0 bg-club-soft" style={{ width: `${pct}%` }} />
      )}
      {events.map((e) => {
        const kde = polohaVeVyrezu(e.atSeconds, rozsah);
        if (kde == null) return null;
        const t = typById.get(e.typeId);
        const top = t?.side === "FOR" ? 28 : t?.side === "AGAINST" ? 72 : 50;
        return (
          <span
            key={e.id}
            aria-hidden
            style={{
              left: `${kde}%`,
              top: `${top}%`,
              background: t?.color ?? "#64748b",
            }}
            className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px]"
          />
        );
      })}
      {pct != null && (
        <div className="absolute inset-y-0 w-0.5 bg-club" style={{ left: `${pct}%` }} />
      )}
    </div>
  );
}
