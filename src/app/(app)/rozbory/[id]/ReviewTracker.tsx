"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { Panel } from "@/components/ui";
import { YouTubePlayer, type PlayerHandle } from "@/components/YouTubePlayer";
import {
  deleteEvent,
  deleteReview,
  logEvents,
  setShares,
  updateEvent,
  updateReview,
} from "@/actions/rozbory";
import { computeStats, type StatEvent, type StatType } from "@/lib/review-stats";
import { formatVideoTime } from "@/lib/youtube";
import { czPlural } from "@/lib/czech";

/**
 * Rozbor zápasu: přehrávač, časová osa, počítadla a záznam.
 *
 * Dvě věci tady rozhodují o použitelnosti:
 *
 * 1. Zápisy se drží v paměti a odesílají v dávce. Při rychlé akci
 *    naklikáš pět zápisů za deset sekund — request na každé kliknutí
 *    by sekal přesně ve chvíli, kdy potřebuješ klikat nejrychleji.
 * 2. Nikdy se nikdo neptá modálně během klikání. Hráč se přiřazuje
 *    přepínačem předem, nebo se doplní dodatečně v záznamu.
 */

type Review = {
  id: string;
  name: string;
  opponent: string | null;
  playedOnLabel: string;
  playedOnValue: string;
  videoId: string | null;
  notes: string | null;
  sharedAll: boolean;
  sharedWith: string[];
};

type Ev = {
  id: string;
  typeId: string;
  atSeconds: number;
  playerId: string | null;
  playerName: string | null;
  note: string | null;
};

type Hrac = { id: string; name: string };

/** Kolik sekund zpět se zápis ukládá — zareagovat stihneš až po akci. */
const OFFSET_KEY = "rozbory:offset";
const DEFAULT_OFFSET = 2;
/** Po jak dlouhém klidu se dávka odešle. */
const FLUSH_MS = 3000;

const btn =
  "rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-800";
const btnPrimary =
  "rounded-md border border-club bg-club px-3.5 py-1.5 text-sm font-medium text-onclub transition hover:bg-club-hover";
const field =
  "mt-1.5 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-club";
const sec =
  "font-heading text-[11px] font-bold uppercase tracking-[0.06em] text-slate-700";

export function ReviewTracker({
  review,
  types,
  players,
  events: serverEvents,
}: {
  review: Review;
  types: StatType[];
  players: Hrac[];
  events: Ev[];
}) {
  const router = useRouter();
  const [, start] = useTransition();

  const zivaTlacitka = types.filter((t) => !t.archived);

  /* ---------------------------------------------- přehrávač */

  const playerRef = useRef<PlayerHandle | null>(null);
  const [stopky, setStopky] = useState(review.videoId == null);
  const [bezi, setBezi] = useState(false);
  const [cas, setCas] = useState(0);
  // Do refu se píše v efektu, ne při vykreslení: zápis potřebuje
  // aktuální čas, ale nesmí se kvůli němu překreslovat čtyřikrát
  // za sekundu.
  const casRef = useRef(0);
  useEffect(() => {
    casRef.current = cas;
  }, [cas]);

  const onReady = useCallback((h: PlayerHandle) => {
    playerRef.current = h;
  }, []);
  const onFail = useCallback(() => {
    // Zakázané vkládání nebo blokovaný skript nesmí zastavit zapisování.
    playerRef.current = null;
    setStopky(true);
  }, []);

  // Jeden tik pro obojí: u videa se čas čte z přehrávače, u stopek
  // se přičítá. Bez čtení z přehrávače by se čas rozešel po přetočení.
  useEffect(() => {
    const t = setInterval(() => {
      const p = playerRef.current;
      if (p) {
        setCas(p.getTime());
        setBezi(p.isPlaying());
      } else if (bezi) {
        setCas((c) => c + 0.25);
      }
    }, 250);
    return () => clearInterval(t);
  }, [bezi]);

  const prehrat = useCallback(() => {
    const p = playerRef.current;
    if (p) p.toggle();
    else setBezi((b) => !b);
  }, []);

  const skoc = useCallback((s: number) => {
    const p = playerRef.current;
    if (p) p.seekTo(s);
    else setCas(Math.max(0, s));
  }, []);

  /* ------------------------------------------------- posun */

  // Uložená hodnota se čte přes useSyncExternalStore: na serveru vyjde
  // výchozí, na klientovi uložená, a nevznikne rozpor při hydrataci.
  // Vlastní úprava má přednost, dokud je stránka otevřená.
  const ulozeny = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return window.localStorage.getItem(OFFSET_KEY);
      } catch {
        // Soukromé okno, zakázané úložiště — jede se s výchozím.
        return null;
      }
    },
    () => null,
  );
  const [rucni, setRucni] = useState<number | null>(null);
  const zUlozeneho = Number(ulozeny);
  const offset =
    rucni ??
    (ulozeny != null && Number.isFinite(zUlozeneho) && zUlozeneho >= 0 && zUlozeneho <= 15
      ? zUlozeneho
      : DEFAULT_OFFSET);

  const zmenOffset = (n: number) => {
    const cista = Number.isFinite(n) ? Math.min(15, Math.max(0, Math.round(n))) : DEFAULT_OFFSET;
    setRucni(cista);
    try {
      window.localStorage.setItem(OFFSET_KEY, String(cista));
    } catch {
      /* nevadí */
    }
  };

  /* ------------------------------------------ zápisy v paměti */

  const [zaHrace, setZaHrace] = useState<string | null>(null);
  const [nove, setNove] = useState<Ev[]>([]);
  const noveRef = useRef<Ev[]>([]);
  useEffect(() => {
    noveRef.current = nove;
  }, [nove]);
  const [ukladam, setUkladam] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Jakmile dorazí čerstvá data ze serveru, čekající zápisy zahodíme —
  // už jsou v nich. Srovnává se při vykreslení, ne v efektu: v efektu
  // by se stihlo jedno překreslení, ve kterém by zápisy byly dvakrát.
  const [posledniZeServeru, setPosledniZeServeru] = useState(serverEvents);
  if (posledniZeServeru !== serverEvents) {
    setPosledniZeServeru(serverEvents);
    setNove([]);
  }

  const odesli = useCallback(() => {
    const davka = noveRef.current;
    if (davka.length === 0) return;
    setUkladam(true);
    start(async () => {
      const res = await logEvents(
        review.id,
        davka.map((e) => ({
          typeId: e.typeId,
          atSeconds: Math.max(0, Math.round(e.atSeconds)),
          playerId: e.playerId,
          note: e.note,
        })),
      );
      setUkladam(false);
      if (!res.ok) {
        setChyba(res.error);
        return;
      }
      setChyba(null);
      router.refresh();
    });
  }, [review.id, router, start]);

  // Odeslat i při odchodu ze stránky a při zavření karty — jinak by se
  // poslední naklikané zápisy ztratily.
  useEffect(() => {
    const pri = () => odesli();
    window.addEventListener("pagehide", pri);
    return () => {
      window.removeEventListener("pagehide", pri);
      pri();
    };
  }, [odesli]);

  const zapis = useCallback(
    (typeId: string) => {
      const hrac = players.find((p) => p.id === zaHrace) ?? null;
      const e: Ev = {
        id: `novy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        typeId,
        atSeconds: Math.max(0, casRef.current - offset),
        playerId: hrac?.id ?? null,
        playerName: hrac?.name ?? null,
        note: null,
      };
      setNove((n) => [...n, e]);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(odesli, FLUSH_MS);
    },
    [odesli, offset, players, zaHrace],
  );

  /* ------------------------------------------------- klávesy */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cil = e.target as HTMLElement | null;
      // V poli se píše, v modalu se rozhoduje — jinde se zapisuje.
      if (cil && /^(INPUT|TEXTAREA|SELECT)$/.test(cil.tagName)) return;
      if (document.querySelector("[data-modal]")) return;

      if (e.code === "Space") {
        e.preventDefault();
        prehrat();
        return;
      }
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= 9 && zivaTlacitka[n - 1]) {
        e.preventDefault();
        zapis(zivaTlacitka[n - 1]!.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prehrat, zapis, zivaTlacitka]);

  /* ------------------------------------------------- výpočty */

  const vsechny = [...serverEvents, ...nove];
  const statEvents: StatEvent[] = vsechny.map((e) => ({
    id: e.id,
    typeId: e.typeId,
    atSeconds: e.atSeconds,
    playerId: e.playerId,
    playerName: e.playerName,
  }));
  const stats = computeStats(statEvents, types);
  const typById = new Map(types.map((t) => [t.id, t]));

  const delka = Math.max(
    60,
    ...vsechny.map((e) => e.atSeconds + 30),
    Math.ceil(cas) + 30,
  );

  const zaznam = [...vsechny].sort((a, b) => b.atSeconds - a.atSeconds);

  /* --------------------------------------------------- modaly */

  const [modal, setModal] = useState<null | "sdileni" | "uprava">(null);

  return (
    <>
      <div className="mb-5 mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-800">
            {review.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {review.opponent ? `${review.opponent} · ` : ""}
            {review.playedOnLabel}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" className={btn} onClick={() => setModal("sdileni")}>
            Sdílet
          </button>
          <button type="button" className={btn} onClick={() => setModal("uprava")}>
            Upravit
          </button>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:items-start">
        {/* ------------------------------------- levý sloupec */}
        <div className="flex min-w-0 flex-col gap-4">
          <Panel className="!p-0 overflow-hidden">
            {review.videoId && !stopky ? (
              <YouTubePlayer videoId={review.videoId} onReady={onReady} onFail={onFail} />
            ) : (
              <div
                className="grid aspect-video w-full place-items-center border-b border-slate-100"
                style={{ background: "#000" }}
              >
                <div className="px-4 text-center">
                  <button
                    type="button"
                    onClick={prehrat}
                    aria-label={bezi ? "Pauza" : "Spustit stopky"}
                    className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-club-line bg-club-soft text-lg text-club transition hover:bg-club-soft/70"
                  >
                    {bezi ? "❚❚" : "▶"}
                  </button>
                  <p className="mt-2.5 text-xs text-slate-500">
                    {review.videoId
                      ? "Video se nepodařilo načíst — jedou stopky."
                      : "Bez videa — jedou stopky."}
                  </p>
                </div>
              </div>
            )}

            <div className="px-4 py-3.5 sm:px-5">
              <div className="mb-2.5 flex flex-wrap items-baseline gap-2.5">
                <span className="font-heading text-xl font-bold tabular-nums text-slate-900">
                  {formatVideoTime(cas)}
                </span>
                <span className="flex-1" />
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  zápis o
                  <input
                    type="number"
                    min={0}
                    max={15}
                    value={offset}
                    onChange={(e) => zmenOffset(Number(e.target.value))}
                    aria-label="Posun zápisu v sekundách"
                    className="w-12 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-right text-xs tabular-nums text-slate-900"
                  />
                  s zpět
                </label>
              </div>

              <Osa
                delka={delka}
                cas={cas}
                events={vsechny}
                typById={typById}
                onSeek={skoc}
              />

              <div className="mt-2.5 flex flex-wrap gap-2">
                {stats.balance.byType.map((t) => (
                  <span
                    key={t.typeId}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
                  >
                    <i
                      aria-hidden
                      style={{ background: t.color }}
                      className="inline-block h-1.5 w-1.5 rounded-full"
                    />
                    {t.label}
                  </span>
                ))}
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className={sec}>Počítadla</span>
              <span className="text-xs text-slate-500">
                klávesy 1–{Math.min(9, zivaTlacitka.length)} · mezerník přehrát
              </span>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-slate-500">Zapisuji za:</span>
              <Pill on={zaHrace == null} onClick={() => setZaHrace(null)}>
                tým
              </Pill>
              {players.map((p) => (
                <Pill key={p.id} on={zaHrace === p.id} onClick={() => setZaHrace(p.id)}>
                  {p.name}
                </Pill>
              ))}
            </div>

            <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(9rem,1fr))]">
              {zivaTlacitka.map((t, i) => {
                const n = stats.balance.byType.find((x) => x.typeId === t.id)?.count ?? 0;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => zapis(t.id)}
                    style={{ borderLeftColor: t.color }}
                    className="relative flex min-h-[4.5rem] flex-col items-start gap-0.5 rounded-lg border border-slate-200 border-l-[3px] bg-slate-50 px-3 py-2.5 text-left transition hover:bg-slate-100"
                  >
                    {i < 9 && (
                      <span className="absolute right-2 top-1.5 text-[10.5px] text-slate-400">
                        {i + 1}
                      </span>
                    )}
                    <span
                      style={{ color: t.color }}
                      className="font-heading text-xl font-bold leading-tight tabular-nums"
                    >
                      {n}
                    </span>
                    <span className="text-[13px] leading-snug text-slate-700">
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-xs text-slate-500">
              {nove.length > 0
                ? `${nove.length} ${czPlural(nove.length, "zápis čeká", "zápisy čekají", "zápisů čeká")} na uložení…`
                : ukladam
                  ? "Ukládám…"
                  : "Vše uloženo."}
            </p>
            {chyba && (
              <p role="alert" className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {chyba}
              </p>
            )}
          </Panel>
        </div>

        {/* ------------------------------------- pravý sloupec */}
        <div className="flex min-w-0 flex-col gap-4">
          <Panel>
            <div className={`${sec} mb-2.5`}>Bilance</div>
            <dl className="mb-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-2">
              <Tile k="Pro nás" v={String(stats.balance.forCount)} tone="text-emerald-800" />
              <Tile k="Proti nám" v={String(stats.balance.againstCount)} tone="text-red-800" />
              <Tile
                k="Rozdíl"
                v={stats.balance.diff > 0 ? `+${stats.balance.diff}` : String(stats.balance.diff)}
              />
              <Tile k="Zápisů" v={String(stats.balance.total)} />
            </dl>

            {stats.players.length === 0 ? (
              <p className="text-xs italic text-slate-500">
                Zatím bez určených hráčů. Přepínač nad počítadly nebo pilulka
                u zápisu.
              </p>
            ) : (
              <div className="table-scroll-wrapper">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-slate-200 px-2 py-1.5 text-left font-heading text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-500">
                        Hráč
                      </th>
                      <th className="whitespace-nowrap border-b border-slate-200 px-2 py-1.5 text-right font-heading text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-500">
                        Pro
                      </th>
                      <th className="whitespace-nowrap border-b border-slate-200 px-2 py-1.5 text-right font-heading text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-500">
                        Proti
                      </th>
                      <th className="whitespace-nowrap border-b border-slate-200 px-2 py-1.5 text-right font-heading text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-500">
                        Rozdíl
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
                        <td className="px-2 py-2 text-right font-medium tabular-nums text-slate-800">
                          {p.diff > 0 ? `+${p.diff}` : p.diff}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bez téhle věty čísla nesedí a nikdo nepozná proč. */}
            {stats.withoutPlayer > 0 && (
              <p className="mt-2.5 text-xs text-slate-500">
                Tabulka počítá jen zápisy s hráčem. {stats.withoutPlayer}{" "}
                {czPlural(stats.withoutPlayer, "zápis ho nemá", "zápisy ho nemají", "zápisů ho nemá")}{" "}
                — v týmové bilanci nahoře jsou.
              </p>
            )}
          </Panel>

          <Panel className="!p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
              <span className={sec}>Záznam</span>
              <span className="text-xs text-slate-500">čas přetočí video</span>
            </div>

            {zaznam.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm italic text-slate-500">
                Zatím prázdné. Pusť video a klikej.
              </p>
            ) : (
              <ul className="max-h-[32rem] overflow-y-auto">
                {zaznam.map((e) => (
                  <Zapis
                    key={e.id}
                    ev={e}
                    typ={typById.get(e.typeId)}
                    players={players}
                    ceka={e.id.startsWith("novy-")}
                    onSeek={() => skoc(e.atSeconds)}
                    onSmazat={() => {
                      if (e.id.startsWith("novy-")) {
                        setNove((n) => n.filter((x) => x.id !== e.id));
                        return;
                      }
                      start(async () => {
                        await deleteEvent(e.id);
                        router.refresh();
                      });
                    }}
                    onZmena={(patch) => {
                      if (e.id.startsWith("novy-")) {
                        setNove((n) =>
                          n.map((x) =>
                            x.id === e.id
                              ? {
                                  ...x,
                                  ...patch,
                                  playerName:
                                    patch.playerId === undefined
                                      ? x.playerName
                                      : (players.find((p) => p.id === patch.playerId)?.name ??
                                        null),
                                }
                              : x,
                          ),
                        );
                        return;
                      }
                      start(async () => {
                        await updateEvent(e.id, patch);
                        router.refresh();
                      });
                    }}
                  />
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {modal === "sdileni" && (
        <Sdileni
          review={review}
          players={players}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
      {modal === "uprava" && (
        <Uprava
          review={review}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
          onDeleted={() => router.push("/rozbory")}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------ kousky */

function Pill({
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
      className={`rounded-full border px-2.5 py-1 text-[13px] transition ${
        on
          ? "border-club-line bg-club-soft font-medium text-club"
          : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
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

/** Časová osa se značkami. Pro nás nahoře, proti nám dole. */
function Osa({
  delka,
  cas,
  events,
  typById,
  onSeek,
}: {
  delka: number;
  cas: number;
  events: Ev[];
  typById: Map<string, StatType>;
  onSeek: (s: number) => void;
}) {
  const pct = Math.min(100, (cas / delka) * 100);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Časová osa"
      onClick={(e) => {
        const b = e.currentTarget.getBoundingClientRect();
        onSeek(((e.clientX - b.left) / b.width) * delka);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onSeek(Math.max(0, cas - 5));
        if (e.key === "ArrowRight") onSeek(cas + 5);
      }}
      className="relative h-11 cursor-pointer overflow-hidden rounded-md border border-slate-200 bg-slate-50"
    >
      <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
      <div className="absolute inset-y-0 left-0 bg-club-soft" style={{ width: `${pct}%` }} />
      {events.map((e) => {
        const t = typById.get(e.typeId);
        const top = t?.side === "FOR" ? 28 : t?.side === "AGAINST" ? 72 : 50;
        return (
          <span
            key={e.id}
            aria-hidden
            style={{
              left: `${Math.min(100, (e.atSeconds / delka) * 100)}%`,
              top: `${top}%`,
              background: t?.color ?? "#64748b",
            }}
            className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px]"
          />
        );
      })}
      <div className="absolute inset-y-0 w-0.5 bg-club" style={{ left: `${pct}%` }} />
    </div>
  );
}

function Zapis({
  ev,
  typ,
  players,
  ceka,
  onSeek,
  onSmazat,
  onZmena,
}: {
  ev: Ev;
  typ: StatType | undefined;
  players: Hrac[];
  ceka: boolean;
  onSeek: () => void;
  onSmazat: () => void;
  onZmena: (patch: { note?: string | null; playerId?: string | null }) => void;
}) {
  const [vybirám, setVybiram] = useState(false);

  return (
    <li className="border-b border-slate-100 px-4 py-2.5 last:border-0 hover:bg-slate-50 sm:px-5">
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={onSeek}
          className="shrink-0 py-0.5 text-[13px] font-medium tabular-nums text-club hover:underline"
        >
          {formatVideoTime(ev.atSeconds)}
        </button>

        <div className="min-w-0 flex-1">
          <div
            style={{ color: typ?.color ?? undefined }}
            className="flex items-center gap-1.5 text-[13.5px] font-medium"
          >
            <i
              aria-hidden
              style={{ background: typ?.color ?? "#64748b" }}
              className="inline-block h-1.5 w-1.5 shrink-0 rotate-45 rounded-[2px]"
            />
            <span className="min-w-0 truncate">{typ?.label ?? "Neznámá akce"}</span>
            {ceka && (
              <span className="shrink-0 text-[10.5px] uppercase tracking-wider text-slate-400">
                čeká
              </span>
            )}
          </div>

          <input
            defaultValue={ev.note ?? ""}
            placeholder="poznámka…"
            aria-label="Poznámka"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (ev.note ?? "")) onZmena({ note: v === "" ? null : v });
            }}
            className="mt-0.5 w-full border-0 border-b border-transparent bg-transparent p-0 text-[12.5px] text-slate-500 outline-none focus:border-club-line focus:text-slate-800"
          />

          {vybirám ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {players.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11.5px] text-slate-700 hover:bg-slate-100"
                  onClick={() => {
                    onZmena({ playerId: p.id });
                    setVybiram(false);
                  }}
                >
                  {p.name}
                </button>
              ))}
              <button
                type="button"
                className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11.5px] text-slate-500"
                onClick={() => {
                  onZmena({ playerId: null });
                  setVybiram(false);
                }}
              >
                nikdo konkrétní
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setVybiram(true)}
              className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] ${
                ev.playerName
                  ? "border border-club-line bg-club-soft text-club"
                  : "border border-dashed border-slate-300 text-slate-500"
              }`}
            >
              {ev.playerName ?? "+ hráč"}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onSmazat}
          aria-label="Smazat zápis"
          className="shrink-0 rounded px-1.5 py-0.5 text-slate-500 transition hover:bg-red-50 hover:text-red-800"
        >
          ✕
        </button>
      </div>
    </li>
  );
}

/* ------------------------------------------------------ modaly */

function Obal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      data-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,6,23,.85)] backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[86vh] w-full min-w-0 max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <h2 className="mb-4 text-base font-semibold text-slate-800">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Sdileni({
  review,
  players,
  onClose,
  onSaved,
}: {
  review: Review;
  players: Hrac[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [vybrani, setVybrani] = useState<string[]>(review.sharedWith);
  const [vsichni, setVsichni] = useState(review.sharedAll);
  const [chyba, setChyba] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Obal title="Sdílet rozbor" onClose={onClose}>
      <p className="mb-3.5 text-xs text-slate-500">
        Vybraní hráči uvidí rozbor ve svém odkazu. Časy i poznámky jen čtou —
        klikat, upravovat a mazat můžeš dál jen ty.
      </p>

      <label className="mb-2.5 flex items-center gap-2.5 rounded-md border border-club-line bg-club-soft px-2.5 py-2">
        <input
          type="checkbox"
          checked={vsichni}
          onChange={(e) => setVsichni(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-[13.5px] text-slate-800">Sdílet s celým týmem</span>
      </label>

      <div className={`flex flex-col gap-1.5 ${vsichni ? "opacity-50" : ""}`}>
        {players.map((p) => (
          <label
            key={p.id}
            className="flex items-center gap-2.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5"
          >
            <input
              type="checkbox"
              disabled={vsichni}
              checked={vybrani.includes(p.id)}
              onChange={(e) =>
                setVybrani((v) =>
                  e.target.checked ? [...v, p.id] : v.filter((x) => x !== p.id),
                )
              }
              className="h-4 w-4"
            />
            <span className="min-w-0 truncate text-[13.5px] text-slate-800">{p.name}</span>
          </label>
        ))}
      </div>

      {chyba && (
        <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {chyba}
        </p>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className={btn} onClick={onClose}>
          Zrušit
        </button>
        <button
          type="button"
          className={btnPrimary}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await setShares(review.id, vybrani, vsichni);
              if (!res.ok) setChyba(res.error);
              else onSaved();
            })
          }
        >
          {pending ? "Ukládám…" : "Uložit sdílení"}
        </button>
      </div>
    </Obal>
  );
}

function Uprava({
  review,
  onClose,
  onSaved,
  onDeleted,
}: {
  review: Review;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [chyba, setChyba] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Obal title="Upravit rozbor" onClose={onClose}>
      <form
        action={(fd) => {
          setChyba(null);
          start(async () => {
            const res = await updateReview(review.id, fd);
            if (!res.ok) setChyba(res.error);
            else onSaved();
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={sec}>Název</span>
            <input name="name" required defaultValue={review.name} className={field} />
          </label>
          <label className="block">
            <span className={sec}>Soupeř</span>
            <input name="opponent" defaultValue={review.opponent ?? ""} className={field} />
          </label>
          <label className="block">
            <span className={sec}>Datum</span>
            <input
              type="date"
              name="playedOn"
              defaultValue={review.playedOnValue}
              className={field}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={sec}>Odkaz na video</span>
            <input
              name="video"
              defaultValue={review.videoId ? `https://youtu.be/${review.videoId}` : ""}
              placeholder="https://youtu.be/…"
              className={field}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={sec}>Poznámky k zápasu</span>
            <textarea
              name="notes"
              rows={4}
              defaultValue={review.notes ?? ""}
              placeholder="Co fungovalo, co ne, na co se zaměřit na tréninku…"
              className={field}
            />
          </label>
        </div>

        {chyba && (
          <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {chyba}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-800 transition hover:bg-red-50"
            onClick={() => {
              if (!window.confirm("Smazat rozbor i se všemi zápisy? Zpět to nejde."))
                return;
              start(async () => {
                const res = await deleteReview(review.id);
                if (!res.ok) setChyba(res.error);
                else onDeleted();
              });
            }}
          >
            Smazat rozbor
          </button>
          <span className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={onClose}>
              Zrušit
            </button>
            <button type="submit" className={btnPrimary} disabled={pending}>
              {pending ? "Ukládám…" : "Uložit"}
            </button>
          </span>
        </div>
      </form>
    </Obal>
  );
}
