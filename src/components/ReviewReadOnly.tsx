"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { YouTubePlayer, type PlayerHandle } from "@/components/YouTubePlayer";
import { HraciPodleAkci, RozpadAkci } from "@/components/ReviewBreakdown";
import { computeStats, type StatEvent, type StatType } from "@/lib/review-stats";
import { indexBoduVCase } from "@/lib/review-tracker";
import { formatVideoTime } from "@/lib/youtube";

/**
 * Rozbor pro hráče — video, co se zrovna děje, bilance a záznam.
 *
 * Bez počítadel, bez přepínače hráče, bez sdílení a bez mazání.
 * Dvě věci tady rozhodují o použitelnosti na telefonu:
 *
 * 1. Nad seznamem visí akce, která se právě stala nebo se blíží.
 *    Kdo se dívá, nemá scrollovat — kouká na video a vedle vidí,
 *    o co jde.
 * 2. Poznámky jsou zabalené. Rozbor s padesáti zápisy by jinak byl
 *    metr dlouhý a nedalo by se v něm nic najít.
 */

const card = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";
const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";

type Zapis = StatEvent & { note: string | null };

export function ReviewReadOnly({
  review,
  types,
  events,
}: {
  review: {
    name: string;
    opponent: string | null;
    playedOnLabel: string;
    videoId: string | null;
    notes: string | null;
  };
  types: StatType[];
  events: Zapis[];
}) {
  const playerRef = useRef<PlayerHandle | null>(null);
  const [bezVidea, setBezVidea] = useState(review.videoId == null);
  const [cas, setCas] = useState(0);

  const onReady = useCallback((h: PlayerHandle) => {
    playerRef.current = h;
  }, []);
  const onFail = useCallback(() => {
    playerRef.current = null;
    setBezVidea(true);
  }, []);

  // Čas se čte z přehrávače; bez videa se nic nesleduje a lišta
  // „právě teď“ se neukazuje.
  useEffect(() => {
    if (bezVidea) return;
    const t = setInterval(() => {
      const p = playerRef.current;
      if (p) setCas(p.getTime());
    }, 500);
    return () => clearInterval(t);
  }, [bezVidea]);

  const skoc = useCallback((s: number) => {
    playerRef.current?.seekTo(s);
  }, []);

  const stats = computeStats(events, types);
  const typById = new Map(types.map((t) => [t.id, t]));
  const zaznam = [...events].sort((a, b) => a.atSeconds - b.atSeconds);

  const indexTed = bezVidea ? null : indexBoduVCase(zaznam, cas);
  const ted = indexTed == null ? null : zaznam[indexTed]!;

  return (
    <>
      <section className={card}>
        <h1 className="font-heading text-lg font-extrabold text-slate-900">
          {review.name}
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {review.opponent ? `${review.opponent} · ` : ""}
          {review.playedOnLabel}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-2.5">
          <Tile k="Pro nás" v={String(stats.balance.forCount)} tone="text-emerald-800" />
          <Tile k="Proti nám" v={String(stats.balance.againstCount)} tone="text-red-800" />
        </dl>
      </section>

      {review.videoId && !bezVidea && (
        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <YouTubePlayer videoId={review.videoId} onReady={onReady} onFail={onFail} />
          <PraveTed ev={ted} typ={ted ? typById.get(ted.typeId) : undefined} cas={cas} />
        </section>
      )}

      {review.notes && (
        <section className={`${card} mt-4`}>
          <h2 className={label}>Poznámky trenéra</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
            {review.notes}
          </p>
        </section>
      )}

      <section className={`${card} mt-4`}>
        <h2 className={label}>Co se v zápase dělo</h2>
        <div className="mt-3">
          <RozpadAkci stats={stats} />
        </div>
      </section>

      <section className={`${card} mt-4`}>
        <h2 className={label}>Hráči podle akcí</h2>
        <div className="mt-3">
          <HraciPodleAkci stats={stats} />
        </div>
      </section>

      <section className={`${card} mt-4`}>
        <h2 className={label}>Záznam</h2>
        {zaznam.length === 0 ? (
          <p className="mt-3 text-sm italic text-slate-500">
            V tomhle rozboru zatím není žádný zápis.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {zaznam.map((e, i) => (
              <RadekZaznamu
                key={e.id}
                ev={e}
                typ={typById.get(e.typeId)}
                aktivni={i === indexTed}
                bezVidea={bezVidea}
                onSeek={() => skoc(e.atSeconds)}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** Akce, která se právě stala nebo se blíží. Drží se pod videem. */
function PraveTed({
  ev,
  typ,
  cas,
}: {
  ev: Zapis | null;
  typ: StatType | undefined;
  cas: number;
}) {
  if (!ev) {
    return (
      <div className="border-t border-slate-100 px-4 py-3 text-xs italic text-slate-500 sm:px-5">
        V rozboru zatím nejsou žádné zápisy.
      </div>
    );
  }

  const probehla = ev.atSeconds <= cas;
  const zbyva = Math.max(0, Math.round(ev.atSeconds - cas));

  return (
    <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
      <div className="flex items-center gap-2">
        <span className={`${label} !tracking-[0.08em]`}>
          {probehla ? "Právě teď" : "Blíží se"}
        </span>
        <span className="flex-1" />
        <span className="text-[11.5px] tabular-nums text-slate-500">
          {probehla ? formatVideoTime(ev.atSeconds) : `za ${zbyva} s`}
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        <i
          aria-hidden
          style={{ background: typ?.color ?? "#64748b" }}
          className="inline-block h-2 w-2 shrink-0 rotate-45 rounded-[2px]"
        />
        <span
          style={{ color: typ?.color ?? undefined }}
          className="min-w-0 truncate text-sm font-medium"
        >
          {typ?.label ?? "Akce"}
        </span>
        {ev.playerName && (
          <span className="shrink-0 text-xs text-slate-500">· {ev.playerName}</span>
        )}
      </div>

      {ev.note && (
        <p className="mt-1 text-[13px] leading-snug text-slate-700">{ev.note}</p>
      )}
    </div>
  );
}

/** Řádek záznamu. Poznámka je zabalená, rozbalí se šipkou. */
function RadekZaznamu({
  ev,
  typ,
  aktivni,
  bezVidea,
  onSeek,
}: {
  ev: Zapis;
  typ: StatType | undefined;
  aktivni: boolean;
  bezVidea: boolean;
  onSeek: () => void;
}) {
  const [otevreno, setOtevreno] = useState(false);

  return (
    <li
      className={`py-2 ${aktivni ? "-mx-2 rounded-lg bg-club-soft px-2" : ""}`}
      aria-current={aktivni ? "true" : undefined}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={onSeek}
          disabled={bezVidea}
          className="shrink-0 py-0.5 text-[13px] font-medium tabular-nums text-club disabled:text-slate-500 disabled:no-underline hover:underline"
        >
          {formatVideoTime(ev.atSeconds)}
        </button>

        <span className="min-w-0 flex-1">
          <span
            style={{ color: typ?.color ?? undefined }}
            className="flex items-center gap-1.5 text-[13.5px] font-medium"
          >
            <i
              aria-hidden
              style={{ background: typ?.color ?? "#64748b" }}
              className="inline-block h-1.5 w-1.5 shrink-0 rotate-45 rounded-[2px]"
            />
            <span className="min-w-0 truncate">{typ?.label ?? "Akce"}</span>
          </span>
          {ev.playerName && (
            <span className="mt-0.5 block text-xs text-slate-500">{ev.playerName}</span>
          )}
        </span>

        {/* Poznámka se rozbaluje: se zabalenými se dá seznam projet
            očima, s rozbalenými by byl metr dlouhý. */}
        {ev.note && (
          <button
            type="button"
            onClick={() => setOtevreno((o) => !o)}
            aria-expanded={otevreno}
            aria-label={otevreno ? "Skrýt poznámku" : "Zobrazit poznámku"}
            className="shrink-0 rounded px-1.5 py-0.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            {otevreno ? "▴" : "▾"} <span className="text-[11px]">pozn.</span>
          </button>
        )}
      </div>

      {ev.note && otevreno && (
        <p className="mt-1 pl-[3.6rem] text-[12.5px] leading-snug text-slate-600">
          {ev.note}
        </p>
      )}
    </li>
  );
}

function Tile({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <dt className="font-heading text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-500">
        {k}
      </dt>
      <dd className={`mt-0.5 font-heading text-lg font-bold tabular-nums ${tone ?? "text-slate-900"}`}>
        {v}
      </dd>
    </div>
  );
}
