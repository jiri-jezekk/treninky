"use client";

import Link from "next/link";
import { useState } from "react";
import {
  awardCoachRating,
  confirmDuel,
  createDuel,
  deleteDuel,
  reopenDuel,
  reportDuelResult,
} from "@/actions/duels";
import {
  closeChallenge,
  createChallenge,
  deleteChallenge,
  deleteChallengeEntry,
  reopenChallenge,
  updateChallengeEntry,
} from "@/actions/challenges";
import {
  closeMatch,
  createMatch,
  deleteMatch,
  reopenMatch,
  updateMatchScores,
} from "@/actions/matches";
import { ActionButton } from "./ActionButton";
import { czPlural, initials } from "@/lib/czech";
import { deleteSoloSession } from "@/actions/solo-sessions";
import type { RatingRow } from "@/lib/rating";
import {
  formatMeasured,
  measureHint,
  SCORE_MODE_LABELS,
  type Measure,
  type ScoreMode,
} from "@/lib/duration";
import { MeasuredInput } from "@/components/MeasuredInput";
const SCORE_MODES: ScoreMode[] = ["points-high", "points-low", "time"];

export type DuelRow = {
  id: string;
  name: string;
  description: string | null;
  higherWins: boolean;
  measure: Measure;
  weightPercent: number;
  challengerName: string;
  opponentName: string;
  status: string;
  challengerValue: number | null;
  opponentValue: number | null;
  challengerDelta: number | null;
  opponentDelta: number | null;
  note: string | null;
  /** Co se stane po potvrzení. Null u duelů, kde se ještě nezapsalo. */
  preview: {
    challengerDelta: number;
    opponentDelta: number;
    challengerWins: boolean | null;
  } | null;
};

export type MatchRow = {
  id: string;
  name: string;
  description: string | null;
  weightPercent: number;
  playedOn: string;
  closed: boolean;
  teams: {
    id: string;
    name: string;
    score: number;
    delta: number | null;
    /** Průměrný rating týmu — z něj se počítá. */
    rating: number | null;
    rank: number | null;
    /** Hráči i s tím, kolik po vyhodnocení dostanou. */
    players: { playerId: string; name: string; previewDelta: number | null }[];
  }[];
};

export type HistoryRow = {
  id: string;
  playerName: string;
  source: string;
  delta: number;
  ratingAfter: number;
  label: string;
  createdAt: string;
};

export type ChallengeRow = {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  higherWins: boolean;
  measure: Measure;
  weightPercent: number;
  startsOn: string;
  endsOn: string;
  closed: boolean;
  /** Pořadí podle nejlepšího pokusu; pokusy zůstávají jako historie. */
  standings: {
    playerId: string;
    playerName: string;
    best: number;
    bestAttemptId: string;
    rank: number;
    improvement: number;
    attempts: { id: string; value: number; note: string | null; when: string }[];
  }[];
  attemptCount: number;
};

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
const field =
  "mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-club";
const card = "overflow-hidden rounded-2xl border border-slate-200 bg-white";
const btnPrimary =
  "inline-flex items-center justify-center rounded-full border-2 border-club bg-club px-3 py-1.5 font-heading text-xs font-semibold text-onclub transition hover:bg-club-hover";
const btnOutline =
  "inline-flex items-center justify-center rounded-full border-2 border-slate-300 px-3 py-1.5 font-heading text-xs font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft";
const btnDanger =
  "inline-flex items-center justify-center rounded-full border-2 border-red-200 px-3 py-1.5 font-heading text-xs font-semibold text-red-800 transition hover:border-red-600 hover:bg-red-50";
const mini =
  "rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900";

const TABS = ["Žebříček", "Duely", "Zápasy", "Výzvy", "Historie"] as const;
type Tab = (typeof TABS)[number];

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Čeká na přijetí",
  ACCEPTED: "Domluveno",
  REPORTED: "Čeká na potvrzení",
  CONFIRMED: "Hotovo",
  DECLINED: "Odmítnuto",
};
const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-sky-50 text-sky-900",
  ACCEPTED: "bg-club-soft text-club",
  REPORTED: "bg-amber-50 text-amber-900",
  CONFIRMED: "bg-emerald-50 text-emerald-800",
  DECLINED: "bg-slate-50 text-slate-500",
};

function fmt(value: number | null, unit?: string | null): string {
  if (value == null) return "—";
  const n = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return unit ? `${n} ${unit}` : n;
}

const SOURCE_LABEL: Record<string, string> = {
  DUEL: "Duel",
  MATCH: "Zápas",
  CHALLENGE: "Výzva",
  COACH: "Trenér",
};

function delta(n: number | null): string {
  if (n == null) return "";
  return n > 0 ? `+${n}` : String(n);
}

export function RatingView({
  board,
  duels,
  matches,
  challenges,
  players,
  trainings,
  history,
  solos,
  hasSeason,
  today,
}: {
  board: RatingRow[];
  duels: DuelRow[];
  matches: MatchRow[];
  challenges: ChallengeRow[];
  players: { id: string; name: string }[];
  trainings: { id: string; label: string }[];
  history: HistoryRow[];
  solos: { id: string; playerName: string; name: string; performedOn: string }[];
  /** Bez běžící sezóny se rating nemá kam zapsat. */
  hasSeason: boolean;
  today: string;
}) {
  const [tab, setTab] = useState<Tab>("Žebříček");

  const waiting = duels.filter((d) => d.status === "REPORTED").length;
  const openMatches = matches.filter((m) => !m.closed).length;
  const openChallenges = challenges.filter((c) => !c.closed).length;

  return (
    <>
      {!hasSeason && (
        <p className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Neběží žádná ratingová sezóna, takže se nedá zakládat ani vyhodnocovat.
          Napiš mi a založím další.
        </p>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat title="Hráčů v žebříčku" value={String(board.length)} />
        <Stat
          title="Nejvyšší rating"
          value={board.length > 0 ? String(board[0]!.rating) : "—"}
          note={board.length > 0 ? board[0]!.playerName : undefined}
          accent
        />
        <Stat
          title="Čeká na potvrzení"
          value={String(waiting)}
          tone={waiting > 0 ? "warn" : undefined}
        />
        <Stat
          title="Nevyhodnoceno"
          value={String(openMatches + openChallenges)}
          note="zápasů a výzev"
        />
      </dl>

      <nav className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "rounded-full border-2 border-club bg-club px-4 py-1.5 font-heading text-xs font-semibold text-onclub"
                : "rounded-full border-2 border-slate-300 px-4 py-1.5 font-heading text-xs font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft"
            }
          >
            {t}
            {t === "Duely" && waiting > 0 && ` (${waiting})`}
            {t === "Zápasy" && openMatches > 0 && ` (${openMatches})`}
          </button>
        ))}
      </nav>

      {tab === "Žebříček" && <Leaderboard board={board} players={players} />}
      {tab === "Duely" && <Duels duels={duels} players={players} />}
      {tab === "Zápasy" && (
        <Matches
          matches={matches}
          players={players}
          trainings={trainings}
          today={today}
        />
      )}
      {tab === "Výzvy" && <Challenges challenges={challenges} today={today} />}
      {tab === "Historie" && <History history={history} solos={solos} />}
    </>
  );
}

/* --------------------------------------------------------- žebříček */

function Leaderboard({
  board,
  players,
}: {
  board: RatingRow[];
  players: { id: string; name: string }[];
}) {
  const [awarding, setAwarding] = useState(false);

  if (board.length === 0) {
    return (
      <p className={`${card} px-5 py-12 text-center text-sm italic text-slate-500`}>
        Žádní aktivní hráči.
      </p>
    );
  }

  return (
    <>
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className={label}>Žebříček</h2>
          <button
            type="button"
            className={btnOutline}
            onClick={() => setAwarding((v) => !v)}
          >
            Upravit rating ručně
          </button>
        </div>

        {awarding && (
          <form
            action={awardCoachRating}
            onSubmit={() => setAwarding(false)}
            className="border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-5"
          >
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_2fr]">
              <label className="block">
                <span className={label}>Hráč</span>
                <select name="playerId" required className={field}>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={label}>Změna</span>
                <input
                  name="delta"
                  required
                  inputMode="numeric"
                  placeholder="+10"
                  className={`${field} tabular-nums`}
                />
              </label>
              <label className="block">
                <span className={label}>Za co</span>
                <input name="label" placeholder="Pomoc s tréninkem" className={field} />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="submit" className={btnPrimary}>
                Připsat
              </button>
              <button
                type="button"
                className={btnOutline}
                onClick={() => setAwarding(false)}
              >
                Zrušit
              </button>
            </div>
            <p className="mt-2 text-xs italic text-slate-500">
              Záporné číslo rating sníží. Zapíše se do historie hráče, ať je
              později poznat proč.
            </p>
          </form>
        )}

        <ul className="divide-y divide-slate-100">
          {board.map((r) => (
            <li key={r.playerId}>
              {/* Celý řádek je odkaz na profil — tam je vidět, odkud se
                  rating vzal, po jednotlivých změnách. */}
              <Link
                href={`/rating/hrac/${r.playerId}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-club-soft sm:px-5"
              >
                <span className="w-7 shrink-0 text-center font-heading text-sm font-extrabold tabular-nums text-slate-500">
                  {r.rank}
                </span>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-club-line bg-club-soft font-heading text-[11px] font-extrabold text-club">
                  {initials(r.playerName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-800">
                    {r.playerName}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {r.band} · {r.duelsWon}–{r.duelsLost} v duelech ·{" "}
                    {r.fromDuels === 0 ? "±0" : delta(r.fromDuels)} z duelů,{" "}
                    +{r.fromAttendance} za {r.attendanceCount}{" "}
                    {czPlural(r.attendanceCount, "trénink", "tréninky", "tréninků")}
                  </span>
                </span>
                <span className="shrink-0 font-heading text-lg font-extrabold tabular-nums text-slate-800">
                  {r.rating}
                </span>
                <span aria-hidden className="shrink-0 text-slate-400">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/* ------------------------------------------------------------ duely */

function Duels({
  duels,
  players,
}: {
  duels: DuelRow[];
  players: { id: string; name: string }[];
}) {
  const [adding, setAdding] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className={label}>Duely</h2>
          <p className="mt-1 text-xs text-slate-500">
            Souboj dvou hráčů. Nejlehčí ze tří vah.
          </p>
        </div>
        {!adding && (
          <button type="button" className={btnOutline} onClick={() => setAdding(true)}>
            + Domluvit duel
          </button>
        )}
      </div>

      {adding && (
        <form
          action={createDuel}
          onSubmit={() => setAdding(false)}
          className="border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-5"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={label}>Název duelu</span>
              <input
                name="name"
                required
                placeholder="Hod na přesnost"
                className={field}
              />
            </label>
            <label className="block">
              <span className={label}>Vyzývá</span>
              <select name="challengerId" required className={field}>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={label}>Soupeř</span>
              <select name="opponentId" required className={field}>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 block">
            <span className={label}>Popis (nepovinné)</span>
            <input
              name="description"
              placeholder="10 hodů na kužely ze šesti metrů"
              className={field}
            />
          </label>
          <label className="mt-3 block">
            <span className={label}>Jak se měří</span>
            <select name="mode" defaultValue="points-high" className={field}>
              {SCORE_MODES.map((m) => (
                <option key={m} value={m}>
                  {SCORE_MODE_LABELS[m]}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs italic text-slate-500">
              Na čas se výsledek píše po částech: minuty, sekundy, setiny.
            </span>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="submit" className={btnPrimary}>
              Domluvit
            </button>
            <button type="button" className={btnOutline} onClick={() => setAdding(false)}>
              Zrušit
            </button>
          </div>
        </form>
      )}

      {duels.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm italic text-slate-500">
          Zatím žádné duely. Hráči si je můžou vytvořit a pojmenovat sami ve
          svém odkazu.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {duels.map((d) => (
            <li key={d.id} className="px-4 py-3.5 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider ${STATUS_CLASS[d.status] ?? ""}`}
                    >
                      {STATUS_LABEL[d.status] ?? d.status}
                    </span>
                    <span className="font-medium text-slate-800">{d.name}</span>
                    {!d.higherWins && (
                      <span className="text-xs text-slate-500">vyhrává nižší</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {d.challengerName} <span className="text-slate-500">vs</span>{" "}
                    {d.opponentName}
                  </p>
                  {d.description && (
                    <p className="mt-1 text-xs text-slate-500">{d.description}</p>
                  )}
                  {d.challengerValue != null && (
                    <Scoreboard
                      leftName={d.challengerName}
                      rightName={d.opponentName}
                      leftValue={d.challengerValue}
                      rightValue={d.opponentValue}
                      leftDelta={d.preview?.challengerDelta ?? d.challengerDelta}
                      rightDelta={d.preview?.opponentDelta ?? d.opponentDelta}
                      leftWins={
                        d.preview
                          ? d.preview.challengerWins
                          : d.challengerDelta == null
                            ? null
                            : d.challengerDelta === 0
                              ? null
                              : d.challengerDelta > 0
                      }
                      pending={d.status === "REPORTED"}
                      measure={d.measure}
                    />
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {d.status === "REPORTED" && (
                    <form action={confirmDuel.bind(null, d.id, undefined)}>
                      <button type="submit" className={btnPrimary}>
                        Potvrdit
                      </button>
                    </form>
                  )}
                  {(d.status === "ACCEPTED" ||
                    d.status === "PENDING" ||
                    d.status === "REPORTED") && (
                    <button
                      type="button"
                      className={mini}
                      onClick={() => setReporting(reporting === d.id ? null : d.id)}
                    >
                      {d.status === "REPORTED" ? "Opravit výsledek" : "Zapsat výsledek"}
                    </button>
                  )}
                  {d.status !== "CONFIRMED" && (
                    <form action={deleteDuel.bind(null, d.id)}>
                      <button type="submit" className={mini}>
                        Smazat
                      </button>
                    </form>
                  )}
                  {d.status === "CONFIRMED" && (
                    <ActionButton
                      action={reopenDuel.bind(null, d.id)}
                      label="Vrátit zpět"
                      pendingLabel="Vracím…"
                      className={mini}
                      confirm="Vrátit duel k opravě? Rating se oběma hráčům odečte a výsledek půjde zapsat znovu."
                    />
                  )}
                </div>
              </div>

              {reporting === d.id && (
                <form
                  action={reportDuelResult.bind(null, d.id)}
                  onSubmit={() => setReporting(null)}
                  className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className={label}>{d.challengerName}</span>
                      <span className="mt-1.5 block">
                        <MeasuredInput
                          name="challengerValue"
                          measure={d.measure}
                          defaultValue={d.challengerValue}
                          required
                        />
                      </span>
                    </label>
                    <label className="block">
                      <span className={label}>{d.opponentName}</span>
                      <span className="mt-1.5 block">
                        <MeasuredInput
                          name="opponentValue"
                          measure={d.measure}
                          defaultValue={d.opponentValue}
                          required
                        />
                      </span>
                    </label>
                  </div>
                  <p className="mt-2 text-xs italic text-slate-500">
                    {measureHint(d.measure)}
                  </p>
                  <button type="submit" className={`${btnPrimary} mt-3`}>
                    Zapsat
                  </button>
                  <p className="mt-2 text-xs italic text-slate-500">
                    Rating se hne až po potvrzení.
                  </p>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ----------------------------------------------------------- zápasy */

function Matches({
  matches,
  players,
  trainings,
  today,
}: {
  matches: MatchRow[];
  players: { id: string; name: string }[];
  trainings: { id: string; label: string }[];
  today: string;
}) {
  const [adding, setAdding] = useState(false);
  const [teamCount, setTeamCount] = useState(2);

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className={label}>Zápasy</h2>
          <p className="mt-1 text-xs text-slate-500">
            Dva týmy na tréninku, nebo turnájek o čtyřech. Střední váha.
          </p>
        </div>
        {!adding && (
          <button type="button" className={btnOutline} onClick={() => setAdding(true)}>
            + Zapsat zápas
          </button>
        )}
      </div>

      {adding && (
        <form
          action={createMatch}
          onSubmit={() => setAdding(false)}
          className="border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-5"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={label}>Název</span>
              <input name="name" required placeholder="Zápas 6 na 6" className={field} />
            </label>
            <label className="block">
              <span className={label}>Datum</span>
              <input
                type="date"
                name="playedOn"
                defaultValue={today}
                className={field}
              />
            </label>
            <label className="block">
              <span className={label}>Váha (%)</span>
              <input
                name="weightPercent"
                inputMode="numeric"
                defaultValue="150"
                className={`${field} tabular-nums`}
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Popis (nepovinné)</span>
              <input name="description" className={field} />
            </label>
            {trainings.length > 0 && (
              <label className="block">
                <span className={label}>Na kterém tréninku</span>
                <select name="trainingId" defaultValue="zadny" className={field}>
                  <option value="zadny">— neuvádět —</option>
                  {trainings.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={label}>Počet týmů:</span>
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTeamCount(n)}
                className={
                  teamCount === n
                    ? "rounded-full border border-club-line bg-club-soft px-3 py-1 text-xs text-slate-900"
                    : mini
                }
              >
                {n}
              </button>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: teamCount }, (_, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3">
                <div className="grid grid-cols-[2fr_1fr] gap-2">
                  <label className="block">
                    <span className={label}>Název týmu</span>
                    <input
                      name="teamName"
                      defaultValue={`Tým ${String.fromCharCode(65 + i)}`}
                      className={field}
                    />
                  </label>
                  <label className="block">
                    <span className={label}>Skóre</span>
                    <input
                      name="teamScore"
                      inputMode="decimal"
                      defaultValue="0"
                      className={`${field} tabular-nums`}
                    />
                  </label>
                </div>
                <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-200 p-1.5">
                  {players.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <input type="checkbox" name={`teamPlayers${i}`} value={p.id} />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="submit" className={btnPrimary}>
              Zapsat zápas
            </button>
            <button type="button" className={btnOutline} onClick={() => setAdding(false)}>
              Zrušit
            </button>
          </div>
          <p className="mt-2 text-xs italic text-slate-500">
            Vyšší skóre vyhrává. Hráč smí být jen v jednom týmu — kdyby byl ve
            dvou, počítal by se jeho rating dvakrát.
          </p>
        </form>
      )}

      {matches.length === 0 && !adding ? (
        <p className="px-5 py-12 text-center text-sm italic text-slate-500">
          Zatím žádný zápas. Zapiš ten z posledního tréninku.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {matches.map((m) => {
            const best = Math.max(...m.teams.map((t) => t.score));
            return (
              <li key={m.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-800">{m.name}</span>
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider ${
                          m.closed
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-amber-50 text-amber-900"
                        }`}
                      >
                        {m.closed ? "Vyhodnoceno" : "Čeká na vyhodnocení"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {m.playedOn} · váha {m.weightPercent} %
                    </p>
                    {m.description && (
                      <p className="mt-1 text-sm text-slate-600">{m.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-start gap-2">
                    {!m.closed ? (
                      <>
                        <ActionButton
                          action={closeMatch.bind(null, m.id)}
                          label="Vyhodnotit"
                          pendingLabel="Vyhodnocuji…"
                          className={btnPrimary}
                        />
                        <form action={deleteMatch.bind(null, m.id)}>
                          <button type="submit" className={btnDanger}>
                            Smazat
                          </button>
                        </form>
                      </>
                    ) : (
                      <ActionButton
                        action={reopenMatch.bind(null, m.id)}
                        label="Vrátit zpět"
                        pendingLabel="Vracím…"
                        className={btnOutline}
                        confirm="Vrátit vyhodnocení? Rating z tohohle zápasu se hráčům odečte a zápas půjde opravit."
                      />
                    )}
                  </div>
                </div>

                <form
                  action={updateMatchScores.bind(null, m.id)}
                  className="mt-3 grid gap-2 sm:grid-cols-2"
                >
                  {m.teams.map((t) => (
                    <div
                      key={t.id}
                      className={`rounded-lg border p-2.5 ${
                        t.score === best
                          ? "border-club-line bg-club-soft"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-slate-700">
                          {t.name}
                        </span>
                        {m.closed ? (
                          <span
                            className={`font-heading text-sm font-bold tabular-nums ${
                              (t.delta ?? 0) > 0
                                ? "text-emerald-800"
                                : (t.delta ?? 0) < 0
                                  ? "text-red-800"
                                  : "text-slate-500"
                            }`}
                          >
                            {fmt(t.score)} · {delta(t.delta) || "±0"}
                          </span>
                        ) : (
                          <input
                            name={`score-${t.id}`}
                            defaultValue={String(t.score)}
                            inputMode="decimal"
                            className="w-20 rounded border border-slate-200 px-2 py-1 text-right text-sm tabular-nums text-slate-900"
                          />
                        )}
                      </div>
                      {m.closed ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {t.players.map((p) => p.name).join(", ")}
                        </p>
                      ) : (
                        <>
                          {/* Co vyhodnocení udělá — vidět dřív, než se na
                              tlačítko klikne. Každý hráč má svou změnu:
                              počítá se proti soupeřům podle jeho ratingu. */}
                          {t.rank != null && (
                            <p className="mt-1.5 border-t border-slate-200 pt-1.5 text-xs text-slate-600">
                              <b className="font-heading text-slate-700">
                                {t.rank}. místo
                              </b>
                              {" · průměr týmu "}
                              {t.rating}
                            </p>
                          )}
                          <ul className="mt-1 space-y-0.5">
                            {t.players.map((p) => (
                              <li
                                key={p.playerId}
                                className="flex items-center justify-between gap-2 text-xs"
                              >
                                <span className="min-w-0 truncate text-slate-600">
                                  {p.name}
                                </span>
                                {p.previewDelta != null && (
                                  <b
                                    className={`shrink-0 tabular-nums ${
                                      p.previewDelta > 0
                                        ? "text-emerald-800"
                                        : p.previewDelta < 0
                                          ? "text-red-800"
                                          : "text-slate-500"
                                    }`}
                                  >
                                    {delta(p.previewDelta) || "±0"}
                                  </b>
                                )}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  ))}
                  {!m.closed && (
                    <button type="submit" className={`${mini} justify-self-start`}>
                      Uložit skóre
                    </button>
                  )}
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ výzvy */

function Challenges({
  challenges,
  today,
}: {
  challenges: ChallengeRow[];
  today: string;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <>
      <section className={`${card} mb-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className={label}>Měsíční výzvy</h2>
            <p className="mt-1 text-xs text-slate-500">
              Nejtěžší ze tří vah — běží celý měsíc.
            </p>
          </div>
          {!adding && (
            <button type="button" className={btnOutline} onClick={() => setAdding(true)}>
              + Vyhlásit výzvu
            </button>
          )}
        </div>

        {adding && (
          <form
            action={createChallenge}
            onSubmit={() => setAdding(false)}
            className="border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-5"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={label}>Název</span>
                <input name="name" required placeholder="Výběh Ještědu" className={field} />
              </label>
              <label className="block">
                <span className={label}>Jednotka</span>
                <input name="unit" placeholder="min, km, opakování" className={field} />
              </label>
              <label className="block">
                <span className={label}>Od</span>
                <input
                  type="date"
                  name="startsOn"
                  required
                  defaultValue={today}
                  className={field}
                />
              </label>
              <label className="block">
                <span className={label}>Do</span>
                <input type="date" name="endsOn" required className={field} />
              </label>
              <label className="block">
                <span className={label}>Váha (%)</span>
                <input
                  name="weightPercent"
                  inputMode="numeric"
                  defaultValue="200"
                  className={`${field} tabular-nums`}
                />
              </label>
              <label className="block">
                <span className={label}>Jak se měří</span>
                <select name="mode" defaultValue="points-high" className={field}>
                  {SCORE_MODES.map((m) => (
                    <option key={m} value={m}>
                      {SCORE_MODE_LABELS[m]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-3 block">
              <span className={label}>Popis</span>
              <input name="description" className={field} />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="submit" className={btnPrimary}>
                Vyhlásit
              </button>
              <button
                type="button"
                className={btnOutline}
                onClick={() => setAdding(false)}
              >
                Zrušit
              </button>
            </div>
            <p className="mt-2 text-xs italic text-slate-500">
              U výzvy na čas odškrtni „vyhrává vyšší hodnota“ — pak vede nižší
              číslo.
            </p>
          </form>
        )}

        {challenges.length === 0 && !adding && (
          <p className="px-5 py-12 text-center text-sm italic text-slate-500">
            Zatím žádná výzva. Vyhlas první — třeba výběh Ještědu nebo naběhané
            kilometry za měsíc.
          </p>
        )}

        <ul className="divide-y divide-slate-100">
          {challenges.map((c) => (
            <li key={c.id} className="px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-800">{c.name}</span>
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider ${
                        c.closed
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-sky-50 text-sky-900"
                      }`}
                    >
                      {c.closed ? "Uzavřeno" : "Běží"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {c.startsOn} – {c.endsOn}
                    {c.unit && ` · ${c.unit}`}
                    {!c.higherWins && " · vyhrává nižší"}
                    {` · váha ${c.weightPercent} %`}
                  </p>
                  {c.description && (
                    <p className="mt-1 text-sm text-slate-600">{c.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-start gap-2">
                  {!c.closed ? (
                    <>
                      {c.standings.length >= 2 && (
                        <ActionButton
                          action={closeChallenge.bind(null, c.id)}
                          label="Uzavřít a rozdat rating"
                          pendingLabel="Uzavírám…"
                          className={btnPrimary}
                        />
                      )}
                      <form action={deleteChallenge.bind(null, c.id)}>
                        <button type="submit" className={btnDanger}>
                          Smazat
                        </button>
                      </form>
                    </>
                  ) : (
                    <ActionButton
                      action={reopenChallenge.bind(null, c.id)}
                      label="Vrátit zpět"
                      pendingLabel="Vracím…"
                      className={btnOutline}
                      confirm="Vrátit vyhodnocení? Rating z téhle výzvy se hráčům odečte a půjde ji opravit."
                    />
                  )}
                </div>
              </div>

              {c.standings.length > 0 ? (
                <ol className="mt-3 space-y-2">
                  {c.standings.map((r) => (
                    <li key={r.playerId} className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="w-5 shrink-0 text-center font-heading text-xs font-extrabold tabular-nums text-slate-500">
                          {r.rank}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-slate-800">
                          {r.playerName}
                        </span>
                        <span className="shrink-0 font-heading font-bold tabular-nums text-slate-800">
                          {formatMeasured(r.best, c.measure, c.unit)}
                        </span>
                      </div>
                      {/* Na vlastním řádku: na mobilu by jinak ukrojilo
                          půlku jména. */}
                      {r.improvement > 0 && (
                        <p className="mt-0.5 pl-8 font-heading text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                          zlepšení o {formatMeasured(r.improvement, c.measure, c.unit)}{" "}
                          od prvního pokusu
                        </p>
                      )}

                      {/* Kvůli tomuhle to celé je: ať je vidět, jak se kdo
                          za měsíc posouval. Nejnovější pokus nahoře. */}
                      <ul className="mt-1.5 space-y-1 border-t border-slate-200 pt-1.5">
                        {r.attempts.map((a) => (
                          <li key={a.id} className="text-xs">
                            {/* Křížek musí zůstat na obrazovce i u času, kde
                                je pole dvojité. Odznak „nejlepší“ i poznámka
                                proto stojí pod řádkem, ne v něm. */}
                            <div
                              className={`flex items-center gap-2 rounded-lg px-1 py-0.5 ${
                                a.id === r.bestAttemptId ? "bg-club-soft" : ""
                              }`}
                            >
                              {/* Hvězdička má vlastní pevný sloupeček, takže
                                  se řádek podle ní neposouvá. */}
                              <span
                                className="w-3 shrink-0 text-center text-club"
                                title={
                                  a.id === r.bestAttemptId
                                    ? "Nejlepší pokus"
                                    : undefined
                                }
                              >
                                {a.id === r.bestAttemptId ? "★" : ""}
                              </span>
                              <span className="w-16 shrink-0 tabular-nums text-slate-500">
                                {a.when}
                              </span>
                              {c.closed ? (
                                <span className="flex-1 tabular-nums text-slate-700">
                                  {formatMeasured(a.value, c.measure, c.unit)}
                                </span>
                              ) : (
                                <form
                                  action={updateChallengeEntry.bind(null, a.id)}
                                  className="flex min-w-0 flex-1 items-center gap-1.5"
                                >
                                  <MeasuredInput
                                    name="value"
                                    measure={c.measure}
                                    defaultValue={a.value}
                                    compact
                                  />
                                  <button type="submit" className={`${mini} shrink-0`}>
                                    Opravit
                                  </button>
                                </form>
                              )}
                              {!c.closed && (
                                <form
                                  action={deleteChallengeEntry.bind(
                                    null,
                                    a.id,
                                    undefined,
                                  )}
                                  className="shrink-0"
                                >
                                  <button
                                    type="submit"
                                    className="px-1 text-slate-500 hover:text-red-800"
                                    aria-label="Smazat pokus"
                                  >
                                    ✕
                                  </button>
                                </form>
                              )}
                            </div>

                            {a.note && (
                              <p className="pl-[5.25rem] text-slate-500">{a.note}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-xs italic text-slate-500">
                  Zatím nikdo nezapsal výsledek. Hráči je zapisují ve svém odkazu
                  a pokusů můžou mít víc — do pořadí se počítá ten nejlepší.
                </p>
              )}

              {!c.closed && c.standings.length === 1 && (
                <p className="mt-2 text-xs italic text-amber-900">
                  Na uzavření je potřeba aspoň dva zapsané hráče — s jedním
                  není proti komu poměřovat.
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs italic text-slate-500">
        Do pořadí se počítá nejlepší pokus, ne poslední — horší pokus nikoho
        nesrazí, takže se dá zkoušet znovu celý měsíc. Uzavřením se rozdá rating
        podle pořadí; kdyby se zapsalo něco špatně, jde vyhodnocení vrátit
        a rating se hráčům zase odečte.
      </p>
    </>
  );
}

/* --------------------------------------------------------- historie */

function History({
  history,
  solos,
}: {
  history: HistoryRow[];
  solos: { id: string; playerName: string; name: string; performedOn: string }[];
}) {
  if (history.length === 0 && solos.length === 0) {
    return (
      <p className={`${card} px-5 py-12 text-center text-sm italic text-slate-500`}>
        Zatím se rating nikde nezměnil.
      </p>
    );
  }

  return (
    <>
    <section className={card}>
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <h2 className={label}>Historie ratingu</h2>
        <p className="mt-1 text-xs text-slate-500">
          U každé změny je vidět, odkud se vzala. Vidí to i hráči ve svém odkazu.
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {history.map((h) => (
          <li key={h.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
            <span className="w-20 shrink-0 text-xs tabular-nums text-slate-500">
              {h.createdAt}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-800">
                {h.playerName}
              </span>
              <span className="block truncate text-xs text-slate-500">
                {SOURCE_LABEL[h.source] ?? h.source} · {h.label}
              </span>
            </span>
            <span
              className={`w-12 shrink-0 text-right font-heading text-sm font-bold tabular-nums ${
                h.delta > 0
                  ? "text-emerald-800"
                  : h.delta < 0
                    ? "text-red-800"
                    : "text-slate-500"
              }`}
            >
              {delta(h.delta)}
            </span>
            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-500">
              {h.ratingAfter}
            </span>
          </li>
        ))}
      </ul>
    </section>

    {solos.length > 0 && (
      <section className={`${card} mt-5`}>
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className={label}>Individuální tréninky</h2>
          <p className="mt-1 text-xs text-slate-500">
            Co si hráči zapsali sami. Každý den +1, stejně jako za klubový
            trénink. Kdyby něco nesedělo, smaž to křížkem.
          </p>
        </div>
        <ul className="divide-y divide-slate-100">
          {solos.map((so) => (
            <li
              key={so.id}
              className="flex items-center gap-3 px-4 py-2.5 sm:px-5"
            >
              <span className="w-20 shrink-0 text-xs tabular-nums text-slate-500">
                {so.performedOn}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-800">
                  {so.playerName}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {so.name}
                </span>
              </span>
              <span className="shrink-0 font-heading text-sm font-bold text-emerald-800">
                +1
              </span>
              <form action={deleteSoloSession.bind(null, so.id, undefined)}>
                <button
                  type="submit"
                  className="px-1 text-xs text-slate-500 hover:text-red-800"
                  aria-label="Smazat"
                >
                  ✕
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    )}
    </>
  );
}

/**
 * Výsledek duelu tak, aby bylo na první pohled jasné, kdo vyhrál
 * a kolik to komu udělá. U nepotvrzených je to náhled — počítá se
 * stejnou funkcí, jaká se pak použije při zápisu.
 */
function Scoreboard({
  leftName,
  rightName,
  leftValue,
  rightValue,
  leftDelta,
  rightDelta,
  leftWins,
  pending,
  measure,
}: {
  leftName: string;
  rightName: string;
  leftValue: number | null;
  rightValue: number | null;
  leftDelta: number | null;
  rightDelta: number | null;
  leftWins: boolean | null;
  pending: boolean;
  measure: Measure;
}) {
  const rows: {
    name: string;
    value: number | null;
    delta: number | null;
    wins: boolean;
  }[] = [
    { name: leftName, value: leftValue, delta: leftDelta, wins: leftWins === true },
    { name: rightName, value: rightValue, delta: rightDelta, wins: leftWins === false },
  ];

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
      {rows.map((r) => (
        <div
          key={r.name}
          className={`flex items-center gap-2 px-3 py-2 ${
            r.wins ? "bg-emerald-50" : ""
          }`}
        >
          {/* Štítek nesmí být uvnitř ořezávaného jména — ořízl by se
              zrovna on, a to je ta nejdůležitější informace v řádku. */}
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="min-w-0 truncate text-sm text-slate-800">{r.name}</span>
            {r.wins && (
              <span className="shrink-0 font-heading text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                vyhrál
              </span>
            )}
          </span>
          <span className="w-16 shrink-0 text-right text-sm tabular-nums text-slate-700">
            {formatMeasured(r.value, measure)}
          </span>
          <span
            className={`w-14 shrink-0 text-right font-heading text-sm font-bold tabular-nums ${
              (r.delta ?? 0) > 0
                ? "text-emerald-800"
                : (r.delta ?? 0) < 0
                  ? "text-red-800"
                  : "text-slate-500"
            }`}
          >
            {r.delta == null ? "—" : delta(r.delta) || "±0"}
          </span>
        </div>
      ))}
      {leftWins === null && (
        <p className="border-t border-slate-100 px-3 py-1.5 text-xs italic text-slate-500">
          Remíza — rating se nemění.
        </p>
      )}
      {pending && (
        <p className="border-t border-slate-100 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
          Takhle se rating změní po potvrzení.
        </p>
      )}
    </div>
  );
}

function Stat({
  title,
  value,
  note,
  accent,
  tone,
}: {
  title: string;
  value: string;
  note?: string;
  accent?: boolean;
  tone?: "warn";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <dt className={label}>{title}</dt>
      <dd
        className={`mt-1 font-heading text-2xl font-extrabold tabular-nums ${
          tone === "warn" ? "text-amber-900" : accent ? "text-club" : "text-slate-800"
        }`}
      >
        {value}
      </dd>
      {note && <p className="mt-1 truncate text-xs text-slate-500">{note}</p>}
    </div>
  );
}
