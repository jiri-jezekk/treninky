"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { YouTubePlayer, type PlayerHandle } from "@/components/YouTubePlayer";
import { RozpadAkci } from "@/components/ReviewBreakdown";
import { VideoOvladani } from "@/components/VideoOvladani";
import { usePrehravaniBodu } from "@/components/usePrehravaniBodu";
import { ReviewKomentare, type Komentar } from "@/components/ReviewKomentare";
import { computeStats, type StatEvent, type StatType } from "@/lib/review-stats";
import { indexBoduVCase } from "@/lib/review-tracker";
import { formatVideoTime } from "@/lib/youtube";
import { czPlural } from "@/lib/czech";

/**
 * Rozbor pro hráče — video, co se zrovna děje, záznam a statistiky.
 *
 * Bez počítadel, bez přepínače hráče, bez sdílení a bez mazání.
 * Pořadí na stránce kopíruje to, jak se rozbor kouká: nejdřív výsledek,
 * pak video s tím, co se právě děje, pak jednotlivé body — a čísla až
 * nakonec, ta se čtou po zápase, ne při něm.
 *
 * Tři věci rozhodují o použitelnosti na telefonu:
 *
 * 1. Nad seznamem visí akce, která se právě stala nebo se blíží.
 *    Kdo se dívá, nemá scrollovat.
 * 2. Poznámky jsou zabalené. Rozbor s padesáti zápisy by jinak byl
 *    metr dlouhý a nedalo by se v něm nic najít.
 * 3. Kliknutí na čas přetočí video a vrátí ho na obrazovku — jinak by
 *    se přetočilo někde nahoře mimo výhled.
 */

const card = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";
const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";

type Zapis = StatEvent & { note: string | null };

export function ReviewReadOnly({
  review,
  types,
  events,
  comments,
  reviewId,
  payToken,
  viewerId,
}: {
  review: {
    name: string;
    opponent: string | null;
    playedOnLabel: string;
    videoId: string | null;
    notes: string | null;
    groupName: string | null;
    seasonName: string | null;
  };
  types: StatType[];
  events: Zapis[];
  comments: Komentar[];
  /** Id rozboru a token hráče — kvůli komentářům. */
  reviewId: string;
  payToken: string;
  /** Kdo se dívá — kvůli filtru „jen moje“ a zvýraznění v tabulce. */
  viewerId: string;
}) {
  const playerRef = useRef<PlayerHandle | null>(null);
  const videoRef = useRef<HTMLElement | null>(null);
  const [bezVidea, setBezVidea] = useState(review.videoId == null);
  const [cas, setCas] = useState(0);
  const [bezi, setBezi] = useState(false);
  const [rychlost, setRychlost] = useState(1);
  const [jenMoje, setJenMoje] = useState(false);
  const [sledovat, setSledovat] = useState(true);

  const onReady = useCallback((h: PlayerHandle) => {
    playerRef.current = h;
  }, []);
  const onFail = useCallback(() => {
    playerRef.current = null;
    setBezVidea(true);
  }, []);

  // Přehrávání vybraných bodů za sebou. Ovládání se předává jako
  // funkce, aby hook nemusel nic vědět o přehrávači.
  const prehravani = usePrehravaniBodu(
    [...events].sort((a, b) => a.atSeconds - b.atSeconds),
    {
      seek: (x) => playerRef.current?.seekTo(x),
      play: () => playerRef.current?.play(),
    },
  );
  const tikRef = useRef(prehravani.tik);
  useEffect(() => {
    tikRef.current = prehravani.tik;
  }, [prehravani.tik]);

  // Čas se čte z přehrávače; bez videa se nic nesleduje a lišta
  // „právě teď“ se neukazuje.
  useEffect(() => {
    if (bezVidea) return;
    const t = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const ted = p.getTime();
      setCas(ted);
      setBezi(p.isPlaying());
      setRychlost(p.getRate());
      // Posun playlistu patří sem, do tiku přehrávače: čas videa je
      // vnější zdroj, na který se dá jen dívat.
      tikRef.current(ted);
    }, 500);
    return () => clearInterval(t);
  }, [bezVidea]);

  const skoc = useCallback((s: number) => {
    playerRef.current?.seekTo(s);
    // Bez tohohle se na telefonu přetočí video, které je o půl obrazovky
    // výš, a člověk kouká na seznam.
    videoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const stats = computeStats(events, types);
  const typById = new Map(types.map((t) => [t.id, t]));
  const zaznam = [...events].sort((a, b) => a.atSeconds - b.atSeconds);

  // Aktuální bod se hledá vždycky ve všech zápisech, ne ve filtrovaných —
  // u videa má být to, co se právě děje, ne to, co prošlo filtrem.
  const indexTed = bezVidea ? null : indexBoduVCase(zaznam, cas);
  const ted = indexTed == null ? null : zaznam[indexTed]!;

  const moje = stats.players.find((p) => p.playerId === viewerId) ?? null;
  const videt = jenMoje ? zaznam.filter((e) => e.playerId === viewerId) : zaznam;
  // Vlastní rozpad se počítá jen z vlastních zápisů — cizí jména sem
  // ze serveru vůbec nedorazí.
  const mojeStats = computeStats(
    events.filter((e) => e.playerId === viewerId),
    types,
  );

  return (
    <>
      <section className={card}>
        <h1 className="font-heading text-lg font-extrabold text-slate-900">
          {review.name}
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {review.opponent ? `${review.opponent} · ` : ""}
          {review.playedOnLabel}
          {review.groupName ? ` · ${review.groupName}` : ""}
          {review.seasonName ? ` · ${review.seasonName}` : ""}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-2.5">
          <Tile k="Pro nás" v={String(stats.balance.forCount)} tone="text-emerald-800" />
          <Tile k="Proti nám" v={String(stats.balance.againstCount)} tone="text-red-800" />
        </dl>

        {moje && (
          <p className="mt-2.5 text-xs text-slate-500">
            Tvoje akce: <span className="text-emerald-800">{moje.forCount} pro nás</span>,{" "}
            <span className="text-red-800">{moje.againstCount} proti nám</span>.
          </p>
        )}
      </section>

      {review.videoId && !bezVidea && (
        <section
          ref={videoRef}
          className="mt-4 scroll-mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <YouTubePlayer videoId={review.videoId} onReady={onReady} onFail={onFail} />
          <PraveTed ev={ted} typ={ted ? typById.get(ted.typeId) : undefined} cas={cas} />
          <div className="border-t border-slate-100 px-4 py-2.5 sm:px-5">
            <VideoOvladani
              bezi={bezi}
              rychlost={rychlost}
              onKrok={(o) => playerRef.current?.seekTo(Math.max(0, cas + o))}
              onPrehrat={() => playerRef.current?.toggle()}
              onRychlost={(r) => {
                playerRef.current?.setRate(r);
                setRychlost(r);
              }}
            />
          </div>
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
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={label}>Záznam</h2>
          <span className="flex-1" />
          <span className="text-xs text-slate-500">
            {zaznam.length}{" "}
            {czPlural(zaznam.length, "zápis", "zápisy", "zápisů")}
          </span>
        </div>

        {/* Hráč se nejčastěji ptá „co jsem tam dělal já“. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {moje && (
            <>
              <Chip on={!jenMoje} onClick={() => setJenMoje(false)}>
                Vše
              </Chip>
              <Chip on={jenMoje} onClick={() => setJenMoje(true)}>
                Jen moje ({moje.total})
              </Chip>
            </>
          )}
          {!bezVidea && (
            <Chip on={sledovat} onClick={() => setSledovat((x) => !x)}>
              {sledovat ? "✓ " : ""}Sledovat
            </Chip>
          )}
        </div>

        {/* Takhle se rozbor doopravdy kouká: pusť mi tyhle body za sebou. */}
        {!bezVidea && videt.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {prehravani.bezi ? (
              <>
                <button
                  type="button"
                  onClick={prehravani.zastav}
                  className="rounded-md border border-club bg-club px-3 py-1.5 text-[12.5px] font-medium text-onclub transition hover:bg-club-hover"
                >
                  ■ Zastavit
                </button>
                <span className="text-xs tabular-nums text-slate-500">
                  bod {prehravani.kde} / {prehravani.pocet}
                </span>
              </>
            ) : (
              <button
                type="button"
                onClick={() => prehravani.spust(videt.map((e) => e.id))}
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12.5px] text-slate-700 transition hover:bg-slate-100 hover:text-slate-800"
              >
                ▶ Přehrát {jenMoje ? "moje body" : "body"} ({videt.length})
              </button>
            )}
          </div>
        )}

        {zaznam.length === 0 ? (
          <p className="mt-3 text-sm italic text-slate-500">
            V tomhle rozboru zatím není žádný zápis.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {videt.map((e) => (
              <RadekZaznamu
                key={e.id}
                ev={e}
                typ={typById.get(e.typeId)}
                aktivni={e.id === ted?.id}
                sledovat={sledovat}
                bezVidea={bezVidea}
                onSeek={() => skoc(e.atSeconds)}
              />
            ))}
          </ul>
        )}

        {jenMoje && videt.length > 0 && (
          <p className="mt-2.5 text-xs text-slate-500">
            Zobrazeny jen zápisy s tvým jménem. Zbytek zápasu je pod „Vše“.
          </p>
        )}
      </section>

      <section className={`${card} mt-4`}>
        <h2 className={label}>Co se v zápase dělo</h2>
        <div className="mt-3">
          <RozpadAkci stats={stats} />
        </div>
      </section>

      {/* Vlastní čísla, ne tabulka celého týmu. Rozbor má učit, ne
          ukazovat prstem — kdo co pokazil, řeší trenér. */}
      <section className={`${card} mt-4`}>
        <h2 className={label}>Tvoje akce</h2>
        {mojeStats.balance.total === 0 ? (
          <p className="mt-3 text-sm italic text-slate-500">
            V tomhle zápase u tebe není žádný zápis.
          </p>
        ) : (
          <div className="mt-3">
            <RozpadAkci stats={mojeStats} />
          </div>
        )}
      </section>

      {/* Debata na konec: nejdřív se rozbor projde, pak se o něm mluví. */}
      <section className={`${card} mt-4`}>
        <ReviewKomentare
          reviewId={reviewId}
          komentare={comments}
          payToken={payToken}
          viewerId={viewerId}
        />
      </section>
    </>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-2.5 py-1 text-[12.5px] transition ${
        on
          ? "border-club-line bg-club-soft font-medium text-club"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {children}
    </button>
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
  sledovat,
  bezVidea,
  onSeek,
}: {
  ev: Zapis;
  typ: StatType | undefined;
  aktivni: boolean;
  /** Seznam jede s videem — aktivní řádek se sám doroluje. */
  sledovat: boolean;
  bezVidea: boolean;
  onSeek: () => void;
}) {
  const [otevreno, setOtevreno] = useState(false);
  const radekRef = useRef<HTMLLIElement | null>(null);

  // Posun seznamu je práce s DOM, ne se stavem — proto efekt. Kdo si
  // scrolluje sám, vypne si sledování a nic ho neruší.
  useEffect(() => {
    if (aktivni && sledovat) {
      radekRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [aktivni, sledovat]);

  return (
    <li
      ref={radekRef}
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
