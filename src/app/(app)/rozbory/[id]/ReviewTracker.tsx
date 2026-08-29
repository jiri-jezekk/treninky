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
import { HraciPodleAkci, RozpadAkci } from "@/components/ReviewBreakdown";
import { Osa } from "@/components/ReviewOsa";
import { VideoOvladani } from "@/components/VideoOvladani";
import { usePrehravaniBodu } from "@/components/usePrehravaniBodu";
import { ReviewKomentare, type Komentar } from "@/components/ReviewKomentare";
import {
  deleteEvent,
  deleteReview,
  logEvents,
  setRoster,
  updateEvent,
  updateReview,
} from "@/actions/rozbory";
import { computeStats, type StatEvent, type StatType } from "@/lib/review-stats";
import {
  celkovaDelka,
  OKNA,
  POPIS_OKNA,
  rozsahOsy,
  vychoziOkno,
} from "@/lib/review-timeline";
import {
  indexBoduVCase,
  MIN_H,
  MIN_W,
  najdiPosledniZapis,
  omezRamec,
  type KlicZapisu,
  type Ramec,
} from "@/lib/review-tracker";
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
  /** Vidí rozbor hráči? U cizích týmů se vypíná. */
  visibleToPlayers: boolean;
  /** Za koho se hrálo a v jaké sezóně — kvůli filtrování v seznamu. */
  groupId: string | null;
  groupName: string | null;
  seasonId: string | null;
  seasonName: string | null;
  /** Kdo u zápasu hrál. Prázdné = nabízí se celý klub. */
  roster: string[];
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
/** Kam si trenér odtáhl a jak zvětšil plovoucí panely; drží se mezi rozbory. */
const PANEL_KEY = "rozbory:panel:";
const PANELY_KEY = "rozbory:panely";

type KlicPanelu = "hraci" | "situace" | "prubeh";

const PANELY: { klic: KlicPanelu; nadpis: string }[] = [
  { klic: "hraci", nadpis: "Hráči" },
  { klic: "situace", nadpis: "Situace" },
  { klic: "prubeh", nadpis: "Průběh" },
];

// Průběh je na prohlížení, ne na zapisování — kdo si ho chce otevřít,
// klikne. Jinak by při zápase zabíral místo.
const VYCHOZI_PANELY: Record<KlicPanelu, boolean> = {
  hraci: true,
  situace: true,
  prubeh: false,
};

/** Uložené nastavení panelů; cokoliv divného spadne na výchozí. */
function parsePanely(ulozene: string | null): Record<KlicPanelu, boolean> {
  if (!ulozene) return VYCHOZI_PANELY;
  try {
    const p: unknown = JSON.parse(ulozene);
    if (typeof p !== "object" || p === null) return VYCHOZI_PANELY;
    const vysledek = { ...VYCHOZI_PANELY };
    for (const { klic } of PANELY) {
      const v = (p as Record<string, unknown>)[klic];
      if (typeof v === "boolean") vysledek[klic] = v;
    }
    return vysledek;
  } catch {
    return VYCHOZI_PANELY;
  }
}

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
  comments,
  kategorie,
  sezony,
}: {
  review: Review;
  types: StatType[];
  players: Hrac[];
  events: Ev[];
  comments: Komentar[];
  /** Nabídka do úpravy rozboru — kategorie a sezóny klubu. */
  kategorie: { id: string; name: string }[];
  sezony: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [, start] = useTransition();

  const zivaTlacitka = types.filter((t) => !t.archived);

  // Soupiska: klub má dvacet lidí, na turnaj jich jede deset. Prázdná
  // soupiska znamená „všichni“, ať se nový rozbor dá začít bez klikání.
  const naSoupisce =
    review.roster.length === 0
      ? players
      : players.filter((p) => review.roster.includes(p.id));

  /* ---------------------------------------------- přehrávač */

  const playerRef = useRef<PlayerHandle | null>(null);
  const [stopky, setStopky] = useState(review.videoId == null);
  const [bezi, setBezi] = useState(false);
  const [cas, setCas] = useState(0);
  // Délka záznamu z přehrávače. U živých přenosů má záznam klidně tři
  // hodiny — bez ní by se osa škálovala podle posledního zápisu.
  const [delkaVidea, setDelkaVidea] = useState(0);
  const [rychlost, setRychlost] = useState(1);
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

  // Přehrání bodů za sebou — v panelu Průběh. Body se předávají
  // seřazené, hook si drží jen id.
  const vsechnyKPrehrani = [...serverEvents].sort((a, b) => a.atSeconds - b.atSeconds);
  const prehravani = usePrehravaniBodu(vsechnyKPrehrani, {
    seek: (x) => playerRef.current?.seekTo(x),
    play: () => playerRef.current?.play(),
  });
  const tikRef = useRef(prehravani.tik);
  useEffect(() => {
    tikRef.current = prehravani.tik;
  }, [prehravani.tik]);

  // Jeden tik pro obojí: u videa se čas čte z přehrávače, u stopek
  // se přičítá. Bez čtení z přehrávače by se čas rozešel po přetočení.
  useEffect(() => {
    const t = setInterval(() => {
      const p = playerRef.current;
      if (p) {
        setCas(p.getTime());
        setBezi(p.isPlaying());
        setDelkaVidea((d) => {
          const nova = p.getDuration();
          return nova > 0 && nova !== d ? nova : d;
        });
        setRychlost(p.getRate());
        // Posun přehrávání bodů patří do tiku: čas videa je vnější
        // zdroj, na který se dá jen dívat.
        tikRef.current(p.getTime());
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

  /* -------------------------------------------- celá obrazovka */

  // Přes nativní fullscreen YouTube iframu nejde vykreslit nic vlastního —
  // prohlížeč pouští navrch jen ten jeden prvek. Proto se do fullscreenu
  // dává náš box, ve kterém je video i plovoucí panel s počítadly.
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [celaObrazovka, setCelaObrazovka] = useState(false);

  const prepniObrazovku = useCallback(() => {
    if (typeof document !== "undefined" && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => setCelaObrazovka(false));
      return;
    }
    if (celaObrazovka) {
      setCelaObrazovka(false);
      return;
    }
    setCelaObrazovka(true);
    // Když prohlížeč fullscreen prvku neumí (iOS Safari), zůstane
    // překryv přes stránku. Ovládání je stejné, jen zbyde lišta.
    boxRef.current?.requestFullscreen?.().catch(() => {});
  }, [celaObrazovka]);

  useEffect(() => {
    const zmena = () => {
      if (!document.fullscreenElement) setCelaObrazovka(false);
    };
    document.addEventListener("fullscreenchange", zmena);
    return () => document.removeEventListener("fullscreenchange", zmena);
  }, []);

  // Které panely jsou v celé obrazovce otevřené. Uložená hodnota se
  // čte stejně jako posun zápisu — přes useSyncExternalStore, aby se
  // server a klient neshodly na různých věcech při hydrataci.
  const ulozenePanely = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return window.localStorage.getItem(PANELY_KEY);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const [rucniPanely, setRucniPanely] = useState<Record<KlicPanelu, boolean> | null>(null);
  const otevrene = rucniPanely ?? parsePanely(ulozenePanely);

  const prepniPanel = (klic: KlicPanelu) => {
    const novy = { ...otevrene, [klic]: !otevrene[klic] };
    setRucniPanely(novy);
    try {
      window.localStorage.setItem(PANELY_KEY, JSON.stringify(novy));
    } catch {
      /* nevadí, příště se otevřou výchozí */
    }
  };

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

  // Dokud se píše poznámka, dávka počká. Odeslání totiž přinese
  // čerstvá data ze serveru, čekající zápis vymění za uložený a
  // rozepsaná poznámka by zmizela pod rukama.
  const pisePoznamku = useRef(false);
  const odesliRef = useRef<() => void>(() => {});

  const odesli = useCallback((hned = false) => {
    const davka = noveRef.current;
    if (davka.length === 0) return;
    if (!hned && pisePoznamku.current) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => odesliRef.current(), FLUSH_MS);
      return;
    }
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

  useEffect(() => {
    odesliRef.current = () => odesli();
  }, [odesli]);

  // Odeslat i při odchodu ze stránky a při zavření karty — jinak by se
  // poslední naklikané zápisy ztratily. Tady se na rozepsanou poznámku
  // nečeká; lepší uložit zápis bez poznámky než přijít o obojí.
  useEffect(() => {
    const pri = () => odesli(true);
    window.addEventListener("pagehide", pri);
    return () => {
      window.removeEventListener("pagehide", pri);
      pri();
    };
  }, [odesli]);

  // Na co se váže poznámka „k poslednímu zápisu“. Nedrží se id: čekající
  // zápis ho po uložení vymění za serverové. Typ a zaokrouhlený čas
  // přežijou obojí.
  const [posledniKlic, setPosledniKlic] = useState<KlicZapisu | null>(null);

  const zapis = useCallback(
    (typeId: string) => {
      const hrac = players.find((p) => p.id === zaHrace) ?? null;
      const at = Math.max(0, casRef.current - offset);
      const e: Ev = {
        id: `novy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        typeId,
        atSeconds: at,
        playerId: hrac?.id ?? null,
        playerName: hrac?.name ?? null,
        note: null,
      };
      setNove((n) => [...n, e]);
      setPosledniKlic({ typeId, at: Math.round(at) });

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => odesliRef.current(), FLUSH_MS);
    },
    [offset, players, zaHrace],
  );

  /* ------------------------------------------- úpravy zápisů */

  // Čekající zápis se opraví v paměti, uložený na serveru. Jedno místo
  // pro záznam i pro poznámku v celé obrazovce.
  const zmenZapis = useCallback(
    (ev: Ev, patch: { note?: string | null; playerId?: string | null }) => {
      if (ev.id.startsWith("novy-")) {
        setNove((n) =>
          n.map((x) =>
            x.id === ev.id
              ? {
                  ...x,
                  ...patch,
                  playerName:
                    patch.playerId === undefined
                      ? x.playerName
                      : (players.find((p) => p.id === patch.playerId)?.name ?? null),
                }
              : x,
          ),
        );
        return;
      }
      start(async () => {
        await updateEvent(ev.id, patch);
        router.refresh();
      });
    },
    [players, router, start],
  );

  const smazZapis = useCallback(
    (ev: Ev) => {
      if (ev.id.startsWith("novy-")) {
        setNove((n) => n.filter((x) => x.id !== ev.id));
        return;
      }
      start(async () => {
        await deleteEvent(ev.id);
        router.refresh();
      });
    },
    [router, start],
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
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        prepniObrazovku();
        return;
      }
      // Escape zavírá i náhradní překryv, u kterého se prohlížeč
      // sám neozve.
      if (e.key === "Escape" && celaObrazovka && !document.fullscreenElement) {
        setCelaObrazovka(false);
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
  }, [celaObrazovka, prehrat, prepniObrazovku, zapis, zivaTlacitka]);

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
  const pocty = new Map(stats.balance.byType.map((t) => [t.typeId, t.count]));

  const delka = celkovaDelka(
    delkaVidea,
    vsechny.map((e) => e.atSeconds),
    cas,
  );
  // `undefined` znamená „nech to na délce“ — dokud si trenér okno
  // nepřepne sám, jede podle záznamu.
  const [rucniOkno, setRucniOkno] = useState<number | null | undefined>(undefined);
  const okno = rucniOkno === undefined ? vychoziOkno(delka) : rucniOkno;
  const rozsah = rozsahOsy(delka, cas, okno);

  const zaznam = [...vsechny].sort((a, b) => b.atSeconds - a.atSeconds);
  // Vzestupně: podle toho se kroká „průběhem“ a hledá aktuální bod.
  const poCase = [...vsechny].sort((a, b) => a.atSeconds - b.atSeconds);
  const indexBodu = indexBoduVCase(poCase, cas);
  const bod = indexBodu == null ? null : poCase[indexBodu]!;

  const skocNaBod = (posun: -1 | 1) => {
    if (poCase.length === 0) return;
    const zaklad = indexBodu ?? 0;
    // Když se ukazuje blížící se bod, „další“ znamená opravdu ten,
    // ne přeskočit o jeden.
    const cil =
      indexBodu != null && posun === 1 && poCase[indexBodu]!.atSeconds > cas
        ? indexBodu
        : Math.min(poCase.length - 1, Math.max(0, zaklad + posun));
    skoc(poCase[cil]!.atSeconds);
  };

  // Poslední naklikaný zápis — na něj se v celé obrazovce věší poznámka.
  const posledni = najdiPosledniZapis(vsechny, posledniKlic);

  /* --------------------------------------------------- modaly */

  const [modal, setModal] = useState<null | "uprava" | "soupiska">(null);

  return (
    <>
      <div className="mb-5 mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight text-slate-800">
            {review.name}
            {!review.visibleToPlayers && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-normal text-slate-500">
                skrytý pro hráče
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {review.opponent ? `${review.opponent} · ` : ""}
            {review.playedOnLabel}
            {review.groupName ? ` · ${review.groupName}` : ""}
            {review.seasonName ? ` · ${review.seasonName}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" className={btn} onClick={() => setModal("soupiska")}>
            Soupiska
            {review.roster.length > 0 && (
              <span className="ml-1.5 text-xs text-slate-500">{review.roster.length}</span>
            )}
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
            {/* Do celé obrazovky jde tenhle box, ne samotné video —
                jinak by prohlížeč pustil navrch jen iframe a panel
                s počítadly by zmizel. */}
            <div
              ref={boxRef}
              className={
                celaObrazovka
                  ? "fixed inset-0 z-[60] flex items-center justify-center bg-black"
                  : "flex justify-center bg-black"
              }
            >
              {/* Výška se drží pod polovinou okna, aby počítadla pod
                  videem zůstala vidět bez scrollování. */}
              <div
                className="w-full"
                style={{
                  width: celaObrazovka
                    ? "min(100vw, 177.7vh)"
                    : "min(100%, calc(56vh * 16 / 9))",
                }}
              >
                {review.videoId && !stopky ? (
                  <YouTubePlayer
                    videoId={review.videoId}
                    onReady={onReady}
                    onFail={onFail}
                    hideFullscreen
                  />
                ) : (
                  <div
                    className="grid aspect-video w-full place-items-center"
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
              </div>

              {celaObrazovka && (
                <>
                  {/* Panely jsou tři a každý jde vypnout: při zapisování
                      je k ruce potřeba něco jiného než při prohlížení.
                      Lišta je nahoře uprostřed, ať nepřekáží panelům. */}
                  <div className="fixed left-1/2 top-2 z-[75] flex -translate-x-1/2 flex-wrap items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-2 py-1.5 shadow-2xl backdrop-blur">
                    {PANELY.map((p) => (
                      <button
                        key={p.klic}
                        type="button"
                        aria-pressed={otevrene[p.klic]}
                        onClick={() => prepniPanel(p.klic)}
                        className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
                          otevrene[p.klic]
                            ? "border-club-line bg-club-soft font-medium text-club"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {p.nadpis}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={prepniObrazovku}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] text-slate-600 transition hover:bg-slate-100"
                    >
                      ✕ Zpět
                    </button>
                  </div>

                  {otevrene.hraci && (
                  <PlovouciPanel
                    klic="hraci"
                    nadpis="Hráči"
                    vychozi={{ x: 12, y: 72, w: 260, h: 300 }}
                    onZavrit={() => prepniPanel("hraci")}
                  >
                    <VyberHrace
                      players={naSoupisce}
                      zaHrace={zaHrace}
                      setZaHrace={setZaHrace}
                      velke
                    />
                    {review.roster.length === 0 && players.length > 8 && (
                      <p className="mt-2 text-[11px] text-slate-500">
                        Soupisku vybereš tlačítkem „Soupiska“ mimo celou obrazovku.
                      </p>
                    )}
                  </PlovouciPanel>
                  )}

                  {otevrene.situace && (
                  <PlovouciPanel
                    klic="situace"
                    nadpis="Situace"
                    vychozi={{ x: "vpravo", y: 72, w: 320, h: 380 }}
                    onZavrit={() => prepniPanel("situace")}
                  >
                    <div className="mb-2 flex items-baseline gap-2">
                      <span className="font-heading text-lg font-bold tabular-nums text-slate-900">
                        {formatVideoTime(cas)}
                      </span>
                      <span className="flex-1" />
                      <span className="text-[11px] text-slate-500">
                        {nove.length > 0
                          ? `${nove.length} čeká`
                          : ukladam
                            ? "ukládám…"
                            : "uloženo"}
                      </span>
                    </div>

                    <Tlacitka tlacitka={zivaTlacitka} pocty={pocty} onZapis={zapis} husto />

                    <PoznamkaKZapisu
                      ev={posledni}
                      typ={posledni ? typById.get(posledni.typeId) : undefined}
                      prazdno="Po kliknutí se sem dá napsat poznámka k té situaci."
                      onZmena={(patch) => posledni && zmenZapis(posledni, patch)}
                      onSmazat={() => posledni && smazZapis(posledni)}
                      onPise={(ano) => {
                        pisePoznamku.current = ano;
                      }}
                    />
                  </PlovouciPanel>
                  )}

                  {otevrene.prubeh && (
                  <PlovouciPanel
                    klic="prubeh"
                    nadpis="Průběh"
                    vychozi={{ x: 12, y: 400, w: 360, h: 300 }}
                    onZavrit={() => prepniPanel("prubeh")}
                  >
                    {/* Prohlížení, ne zapisování: osa na pár minut kolem
                        místa, kde jsem, a krokování po jednotlivých
                        bodech i s poznámkou. */}
                    <Osa
                      rozsah={rozsah}
                      cas={cas}
                      events={vsechny}
                      typById={typById}
                      onSeek={skoc}
                    />

                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        className={btn}
                        onClick={() => skocNaBod(-1)}
                        disabled={poCase.length === 0}
                        aria-label="Předchozí bod"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        className={btn}
                        onClick={() => skocNaBod(1)}
                        disabled={poCase.length === 0}
                        aria-label="Další bod"
                      >
                        ›
                      </button>
                      {prehravani.bezi ? (
                        <button
                          type="button"
                          className={btn}
                          onClick={prehravani.zastav}
                          title="Zastavit přehrávání bodů"
                        >
                          ■
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={btn}
                          onClick={() => prehravani.spust(vsechnyKPrehrani.map((e) => e.id))}
                          disabled={vsechnyKPrehrani.length === 0}
                          title="Přehrát body za sebou"
                        >
                          ▶ body
                        </button>
                      )}
                      <span className="flex-1" />
                      <span className="text-[11.5px] tabular-nums text-slate-500">
                        {prehravani.bezi
                          ? `${prehravani.kde} / ${prehravani.pocet}`
                          : `${indexBodu == null ? 0 : indexBodu + 1} / ${poCase.length}`}
                      </span>
                    </div>

                    <PoznamkaKZapisu
                      ev={bod}
                      typ={bod ? typById.get(bod.typeId) : undefined}
                      prazdno="V rozboru zatím nejsou žádné zápisy."
                      onZmena={(patch) => bod && zmenZapis(bod, patch)}
                      onSmazat={() => bod && smazZapis(bod)}
                      onPise={(ano) => {
                        pisePoznamku.current = ano;
                      }}
                    />
                  </PlovouciPanel>
                  )}
                </>
              )}
            </div>

            {/* Počítadla hned pod videem: při zápase se kliká za běhu
                a scrollovat pro tlačítko nejde. */}
            <div className="px-4 py-3.5 sm:px-5">
              <div className="mb-3 flex flex-wrap items-center gap-2.5">
                <span className="font-heading text-xl font-bold tabular-nums text-slate-900">
                  {formatVideoTime(cas)}
                </span>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={prepniObrazovku}
                  className={btn}
                  title="Video přes celou obrazovku i s počítadly (klávesa F)"
                >
                  ⛶ Celá obrazovka
                </button>
              </div>

              {!stopky && (
                <div className="mb-3">
                  <VideoOvladani
                    bezi={bezi}
                    rychlost={rychlost}
                    onKrok={(o) => skoc(Math.max(0, cas + o))}
                    onPrehrat={prehrat}
                    onRychlost={(r) => {
                      playerRef.current?.setRate(r);
                      setRychlost(r);
                    }}
                  />
                </div>
              )}

              <VyberHrace
                players={naSoupisce}
                zaHrace={zaHrace}
                setZaHrace={setZaHrace}
              />
              <Tlacitka tlacitka={zivaTlacitka} pocty={pocty} onZapis={zapis} />

              <p className="mt-3 text-xs text-slate-500">
                {nove.length > 0
                  ? `${nove.length} ${czPlural(nove.length, "zápis čeká", "zápisy čekají", "zápisů čeká")} na uložení…`
                  : ukladam
                    ? "Ukládám…"
                    : "Vše uloženo."}{" "}
                <span className="text-slate-400">
                  klávesy 1–{Math.min(9, zivaTlacitka.length)} · mezerník přehrát · F celá obrazovka
                </span>
              </p>
              {chyba && (
                <p role="alert" className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {chyba}
                </p>
              )}
            </div>
          </Panel>

          <Panel>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className={sec}>Časová osa</span>
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
              rozsah={rozsah}
              cas={cas}
              events={vsechny}
              typById={typById}
              onSeek={skoc}
            />

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs tabular-nums text-slate-500">
                {formatVideoTime(rozsah.od)} – {formatVideoTime(rozsah.do)}
              </span>
              <span className="flex-1" />
              {/* Záznam ze streamu má klidně tři hodiny; přes celou
                  délku by značky splynuly do jednoho místa. */}
              {OKNA.filter((o) => o == null || o < delka).map((o) => (
                <button
                  key={String(o)}
                  type="button"
                  aria-pressed={okno === o}
                  onClick={() => setRucniOkno(o)}
                  className={`rounded-full border px-2 py-0.5 text-[11.5px] transition ${
                    okno === o
                      ? "border-club-line bg-club-soft font-medium text-club"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {POPIS_OKNA.get(o) ?? `${o} s`}
                </button>
              ))}
            </div>
          </Panel>
        </div>

        {/* ------------------------------------- pravý sloupec */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Poznámky k celému zápasu. Psaly se v úpravě rozboru, ale
              vidět nebyly nikde — přitom je to shrnutí, kvůli kterému
              se rozbor dělá. */}
          <Panel>
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className={sec}>Poznámky k zápasu</span>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => setModal("uprava")}
                className="text-xs text-club underline decoration-club-line underline-offset-4"
              >
                {review.notes ? "Upravit" : "Napsat"}
              </button>
            </div>
            {review.notes ? (
              <p className="whitespace-pre-line text-sm text-slate-700">{review.notes}</p>
            ) : (
              <p className="text-xs italic text-slate-500">
                Zatím nic. Sem patří shrnutí celého zápasu — co fungovalo, co
                ne, na co se zaměřit na tréninku. Hráči to uvidí nahoře
                v nasdíleném rozboru.
              </p>
            )}
          </Panel>

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

            <div className={`${sec} mb-2.5`}>Rozpad akcí</div>
            <RozpadAkci stats={stats} />
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
                    players={naSoupisce}
                    ceka={e.id.startsWith("novy-")}
                    onSeek={() => skoc(e.atSeconds)}
                    onSmazat={() => smazZapis(e)}
                    onZmena={(patch) => zmenZapis(e, patch)}
                  />
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {/* Tabulka hráč × akce je široká — v úzkém sloupci se musela
          posouvat posuvníkem. Přes celou šířku se přečte na jeden pohled. */}
      <div className="mt-4">
        <Panel>
          <div className={`${sec} mb-2.5`}>Hráči podle akcí</div>
          <HraciPodleAkci stats={stats} />
        </Panel>
      </div>

      {/* Debata k rozboru. Hráči píšou ze svého odkazu, trenér odsud. */}
      <div className="mt-4">
        <Panel>
          <ReviewKomentare reviewId={review.id} komentare={comments} trener />
        </Panel>
      </div>

      {modal === "soupiska" && (
        <Soupiska
          review={review}
          players={players}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            // Zapisovalo se možná za hráče, který ze soupisky vypadl.
            setZaHrace(null);
            router.refresh();
          }}
        />
      )}
      {modal === "uprava" && (
        <Uprava
          review={review}
          kategorie={kategorie}
          sezony={sezony}
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
  velke = false,
  children,
}: {
  on: boolean;
  onClick: () => void;
  velke?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border transition ${
        velke ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-[13px]"
      } ${
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

/**
 * Za koho se zapisuje. Stejný kus kódu na stránce i v plovoucím
 * panelu — kdyby to byly dvě verze, jedna by časem přestala sedět.
 */
function VyberHrace({
  players,
  zaHrace,
  setZaHrace,
  velke = false,
}: {
  players: Hrac[];
  zaHrace: string | null;
  setZaHrace: (id: string | null) => void;
  /** Do panelu ve fullscreenu: větší terč, jméno na celý řádek. */
  velke?: boolean;
}) {
  return (
    <div className={`mb-2.5 flex flex-wrap items-center gap-1.5 ${velke ? "gap-2" : ""}`}>
      {!velke && <span className="mr-0.5 text-xs text-slate-500">Zapisuji za:</span>}
      <Pill on={zaHrace == null} onClick={() => setZaHrace(null)} velke={velke}>
        celý tým
      </Pill>
      {players.map((p) => (
        <Pill
          key={p.id}
          on={zaHrace === p.id}
          onClick={() => setZaHrace(p.id)}
          velke={velke}
        >
          {p.name}
        </Pill>
      ))}
    </div>
  );
}

/** Počítadla situací. */
function Tlacitka({
  tlacitka,
  pocty,
  onZapis,
  husto = false,
}: {
  tlacitka: StatType[];
  pocty: Map<string, number>;
  onZapis: (typeId: string) => void;
  /** Menší varianta do plovoucího panelu. */
  husto?: boolean;
}) {
  return (
    <>
      <div
        className={`grid gap-2 ${
          husto
            ? "[grid-template-columns:repeat(auto-fill,minmax(7rem,1fr))]"
            : "[grid-template-columns:repeat(auto-fill,minmax(9rem,1fr))]"
        }`}
      >
        {tlacitka.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onZapis(t.id)}
            style={{ borderLeftColor: t.color }}
            className={`relative flex flex-col items-start gap-0.5 rounded-lg border border-slate-200 border-l-[3px] bg-slate-50 text-left transition hover:bg-slate-100 ${
              husto ? "min-h-[3.5rem] px-2.5 py-2" : "min-h-[4.5rem] px-3 py-2.5"
            }`}
          >
            {i < 9 && (
              <span className="absolute right-2 top-1.5 text-[10.5px] text-slate-400">
                {i + 1}
              </span>
            )}
            <span
              style={{ color: t.color }}
              className={`font-heading font-bold leading-tight tabular-nums ${
                husto ? "text-base" : "text-xl"
              }`}
            >
              {pocty.get(t.id) ?? 0}
            </span>
            <span
              className={`leading-snug text-slate-700 ${husto ? "text-[12px]" : "text-[13px]"}`}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

/** Poznámka k zápisu, aby se kvůli větě nemuselo z celé obrazovky ven. */
function PoznamkaKZapisu({
  ev,
  typ,
  prazdno,
  onZmena,
  onSmazat,
  onPise,
}: {
  ev: Ev | null;
  typ: StatType | undefined;
  /** Co říct, když není k čemu poznámku psát. */
  prazdno: string;
  onZmena: (patch: { note?: string | null }) => void;
  onSmazat: () => void;
  /** Hlásí ven, že se píše — dávka zápisů zatím počká. */
  onPise: (ano: boolean) => void;
}) {
  const [drzeny, setDrzeny] = useState<string | null>(null);
  const [text, setText] = useState("");

  // Po novém kliknutí se pole přepne na čerstvý zápis. Nastavuje se
  // při vykreslení, ne v efektu — jinak by problikla stará poznámka.
  if (ev != null && ev.id !== drzeny) {
    setDrzeny(ev.id);
    setText(ev.note ?? "");
  }

  if (ev == null) {
    return <p className="mt-2.5 text-[11.5px] italic text-slate-500">{prazdno}</p>;
  }

  const uloz = () => {
    const v = text.trim();
    if (v !== (ev.note ?? "")) onZmena({ note: v === "" ? null : v });
  };

  return (
    <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <i
          aria-hidden
          style={{ background: typ?.color ?? "#64748b" }}
          className="inline-block h-1.5 w-1.5 shrink-0 rotate-45 rounded-[2px]"
        />
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-700">
          {typ?.label ?? "Akce"}
          {ev.playerName ? ` · ${ev.playerName}` : ""}
        </span>
        <span className="shrink-0 text-[11.5px] tabular-nums text-slate-500">
          {formatVideoTime(ev.atSeconds)}
        </span>
        <button
          type="button"
          onClick={onSmazat}
          aria-label="Smazat poslední zápis"
          className="shrink-0 rounded px-1 text-slate-500 transition hover:bg-red-50 hover:text-red-800"
        >
          ✕
        </button>
      </div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => onPise(true)}
        onBlur={() => {
          onPise(false);
          uloz();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            uloz();
            e.currentTarget.blur();
          }
        }}
        placeholder="poznámka k téhle situaci…"
        aria-label="Poznámka k poslednímu zápisu"
        className="mt-1 w-full rounded border border-slate-200 bg-slate-100 px-2 py-1 text-[12.5px] text-slate-800 outline-none focus:border-club"
      />
    </div>
  );
}

/* ------------------------------------------- plovoucí panel */

type Vychozi = { x: number | "vpravo"; y: number; w: number; h: number };

function nactiRamec(klic: string): Ramec | null {
  try {
    const s = window.localStorage.getItem(PANEL_KEY + klic);
    if (!s) return null;
    const p: unknown = JSON.parse(s);
    if (typeof p !== "object" || p === null) return null;
    const r = p as Partial<Ramec>;
    if (
      typeof r.x !== "number" ||
      typeof r.y !== "number" ||
      typeof r.w !== "number" ||
      typeof r.h !== "number"
    ) {
      return null;
    }
    return { x: r.x, y: r.y, w: r.w, h: r.h };
  } catch {
    return null;
  }
}

/** Panel se nesmí zatáhnout za hranu obrazovky; myší by se nevrátil. */
function vObrazovce(r: Ramec): Ramec {
  return omezRamec(r, { w: window.innerWidth, h: window.innerHeight });
}

/**
 * Panel nad videem v celé obrazovce: přetáhnout za hlavičku, zvětšit
 * za pravý dolní roh. Poloha i velikost se pamatují pro každý panel
 * zvlášť — u každého streamu sedí něco jiného.
 */
function PlovouciPanel({
  klic,
  nadpis,
  vychozi,
  onZavrit,
  children,
}: {
  klic: string;
  nadpis: string;
  vychozi: Vychozi;
  onZavrit: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const uchopRef = useRef<{ x: number; y: number } | null>(null);
  const [ramec, setRamec] = useState<Ramec>(() =>
    vObrazovce(
      nactiRamec(klic) ?? {
        ...vychozi,
        x:
          vychozi.x === "vpravo"
            ? Math.max(8, window.innerWidth - vychozi.w - 12)
            : vychozi.x,
      },
    ),
  );
  const [schovano, setSchovano] = useState(false);

  const uloz = useCallback(
    (r: Ramec) => {
      try {
        window.localStorage.setItem(PANEL_KEY + klic, JSON.stringify(r));
      } catch {
        /* nevadí, jen se příště otevře na výchozím místě */
      }
    },
    [klic],
  );

  // Zvětšování drží prohlížeč (CSS resize), takže se změna jen odchytí
  // a uloží. Vlastní úchyt by na dotyku ani nefungoval líp.
  useEffect(() => {
    const el = panelRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        setRamec((r) => {
          const novy = { ...r, w: el.offsetWidth, h: el.offsetHeight };
          if (novy.w === r.w && novy.h === r.h) return r;
          uloz(novy);
          return novy;
        });
      }, 250);
    });
    ro.observe(el);
    return () => {
      if (t) clearTimeout(t);
      ro.disconnect();
    };
  }, [uloz]);

  return (
    <div
      ref={panelRef}
      style={{
        left: ramec.x,
        top: ramec.y,
        width: ramec.w,
        height: schovano ? undefined : ramec.h,
        resize: schovano ? "none" : "both",
        minWidth: MIN_W,
        minHeight: schovano ? undefined : MIN_H,
        maxWidth: "calc(100vw - 1rem)",
        maxHeight: "calc(100vh - 1rem)",
      }}
      className="fixed z-[70] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur"
    >
      <div className="mb-2 flex shrink-0 items-center gap-1.5">
        <span
          onPointerDown={(e) => {
            const el = panelRef.current;
            if (!el) return;
            const b = el.getBoundingClientRect();
            uchopRef.current = { x: e.clientX - b.left, y: e.clientY - b.top };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const u = uchopRef.current;
            if (!u) return;
            e.preventDefault();
            setRamec((r) => vObrazovce({ ...r, x: e.clientX - u.x, y: e.clientY - u.y }));
          }}
          onPointerUp={() => {
            if (!uchopRef.current) return;
            uchopRef.current = null;
            uloz(ramec);
          }}
          role="button"
          tabIndex={-1}
          aria-label={`Přesunout panel ${nadpis}`}
          title="Chytni a táhni, kam potřebuješ. Velikost se mění za pravý dolní roh."
          className="min-w-0 flex-1 cursor-move touch-none select-none truncate font-heading text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500"
        >
          ⠿ {nadpis}
        </span>
        <button
          type="button"
          onClick={() => setSchovano((s) => !s)}
          aria-label={schovano ? "Rozbalit panel" : "Sbalit panel"}
          className="shrink-0 rounded px-1.5 py-0.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        >
          {schovano ? "▾" : "▴"}
        </button>
        <button
          type="button"
          onClick={onZavrit}
          aria-label="Zpět z celé obrazovky"
          className="shrink-0 rounded px-1.5 py-0.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        >
          ✕
        </button>
      </div>

      {!schovano && <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>}
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

/**
 * Kdo u zápasu hrál. Bez soupisky se při zapisování proklikává celý
 * klub, i lidi, co na turnaji vůbec nebyli.
 */
function Soupiska({
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
  const [vybrani, setVybrani] = useState<string[]>(review.roster);
  const [chyba, setChyba] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const prepni = (id: string) =>
    setVybrani((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  return (
    <Obal title="Soupiska zápasu" onClose={onClose}>
      <p className="mb-3 text-xs text-slate-500">
        Vyber, kdo tenhle zápas hrál. Při zapisování se pak nabízejí jen
        oni. Prázdná soupiska znamená celý klub.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={btn}
          onClick={() => setVybrani(players.map((p) => p.id))}
        >
          Označit všechny
        </button>
        <button type="button" className={btn} onClick={() => setVybrani([])}>
          Zrušit výběr
        </button>
        <span className="self-center text-xs text-slate-500">
          vybráno {vybrani.length} z {players.length}
        </span>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2">
        {players.map((p) => (
          <label
            key={p.id}
            className={`flex items-center gap-2.5 rounded-md border px-2.5 py-1.5 ${
              vybrani.includes(p.id)
                ? "border-club-line bg-club-soft"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <input
              type="checkbox"
              checked={vybrani.includes(p.id)}
              onChange={() => prepni(p.id)}
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
              const res = await setRoster(review.id, vybrani);
              if (!res.ok) setChyba(res.error);
              else onSaved();
            })
          }
        >
          {pending ? "Ukládám…" : "Uložit soupisku"}
        </button>
      </div>
    </Obal>
  );
}

function Uprava({
  review,
  kategorie,
  sezony,
  onClose,
  onSaved,
  onDeleted,
}: {
  review: Review;
  kategorie: { id: string; name: string }[];
  sezony: { id: string; name: string }[];
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
          <label className="block">
            <span className={sec}>Kategorie</span>
            <select name="groupId" defaultValue={review.groupId ?? ""} className={field}>
              <option value="">— nezařazeno —</option>
              {kategorie.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={sec}>Sezóna</span>
            <select name="seasonId" defaultValue={review.seasonId ?? ""} className={field}>
              <option value="">podle data zápasu</option>
              {sezony.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
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
          <label className="flex items-center gap-2.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 sm:col-span-2">
            <input
              type="checkbox"
              name="visibleToPlayers"
              defaultChecked={review.visibleToPlayers}
              className="h-4 w-4"
            />
            <span className="text-[13.5px] text-slate-800">
              Vidí hráči
              <span className="ml-1.5 text-xs text-slate-500">
                (u rozborů cizích týmů vypni)
              </span>
            </span>
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
