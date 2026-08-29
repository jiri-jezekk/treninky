"use client";

import { useCallback, useRef, useState } from "react";
import { YouTubePlayer, type PlayerHandle } from "@/components/YouTubePlayer";
import { computeStats, type StatEvent, type StatType } from "@/lib/review-stats";
import { formatVideoTime } from "@/lib/youtube";
import { czPlural } from "@/lib/czech";

/**
 * Rozbor pro hráče — video, bilance, záznam a poznámky.
 *
 * Bez počítadel, bez přepínače hráče, bez sdílení a bez mazání.
 * Klient je to jen kvůli přetáčení videa z časů v záznamu; nic se
 * odsud neukládá.
 */

const card = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";
const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";

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
  events: (StatEvent & { note: string | null })[];
}) {
  const playerRef = useRef<PlayerHandle | null>(null);
  const [bezVidea, setBezVidea] = useState(review.videoId == null);

  const onReady = useCallback((h: PlayerHandle) => {
    playerRef.current = h;
  }, []);
  const onFail = useCallback(() => {
    playerRef.current = null;
    setBezVidea(true);
  }, []);

  const stats = computeStats(events, types);
  const typById = new Map(types.map((t) => [t.id, t]));
  const zaznam = [...events].sort((a, b) => a.atSeconds - b.atSeconds);

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
        <h2 className={label}>Záznam</h2>
        {zaznam.length === 0 ? (
          <p className="mt-3 text-sm italic text-slate-500">
            V tomhle rozboru zatím není žádný zápis.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {zaznam.map((e) => {
              const t = typById.get(e.typeId);
              return (
                <li key={e.id} className="flex items-start gap-2.5 py-2">
                  <button
                    type="button"
                    onClick={() => playerRef.current?.seekTo(e.atSeconds)}
                    disabled={bezVidea}
                    className="shrink-0 py-0.5 text-[13px] font-medium tabular-nums text-club disabled:text-slate-500 disabled:no-underline hover:underline"
                  >
                    {formatVideoTime(e.atSeconds)}
                  </button>
                  <span className="min-w-0 flex-1">
                    <span
                      style={{ color: t?.color ?? undefined }}
                      className="flex items-center gap-1.5 text-[13.5px] font-medium"
                    >
                      <i
                        aria-hidden
                        style={{ background: t?.color ?? "#64748b" }}
                        className="inline-block h-1.5 w-1.5 shrink-0 rotate-45 rounded-[2px]"
                      />
                      <span className="min-w-0 truncate">{t?.label ?? "Akce"}</span>
                    </span>
                    {e.playerName && (
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {e.playerName}
                      </span>
                    )}
                    {e.note && (
                      <span className="mt-0.5 block text-[12.5px] text-slate-500">
                        {e.note}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {stats.players.length > 0 && (
        <section className={`${card} mt-4`}>
          <h2 className={label}>Hráči</h2>
          <div className="table-scroll-wrapper mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-2 py-1.5 text-left font-heading text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-500">
                    Hráč
                  </th>
                  <th className="border-b border-slate-200 px-2 py-1.5 text-right font-heading text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-500">
                    Pro
                  </th>
                  <th className="border-b border-slate-200 px-2 py-1.5 text-right font-heading text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-500">
                    Proti
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.players.map((p) => (
                  <tr key={p.playerId} className="border-b border-slate-100 last:border-0">
                    <td className="px-2 py-2 text-slate-800">{p.playerName}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-800">
                      {p.forCount}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-red-800">
                      {p.againstCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {stats.withoutPlayer > 0 && (
            <p className="mt-2.5 text-xs text-slate-500">
              Tabulka počítá jen zápisy s hráčem. {stats.withoutPlayer}{" "}
              {czPlural(stats.withoutPlayer, "zápis ho nemá", "zápisy ho nemají", "zápisů ho nemá")}{" "}
              — v bilanci nahoře jsou.
            </p>
          )}
        </section>
      )}
    </>
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
