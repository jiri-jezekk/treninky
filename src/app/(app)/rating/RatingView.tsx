"use client";

import { useState } from "react";
import {
  awardCoachRating,
  confirmDuel,
  createDuel,
  deleteDuel,
  reportDuelResult,
} from "@/actions/duels";
import {
  closeChallenge,
  createChallenge,
  createDiscipline,
  deleteChallenge,
  deleteChallengeEntry,
  updateDiscipline,
} from "@/actions/challenges";
import { czPlural, initials } from "@/lib/czech";
import type { RatingRow } from "@/lib/rating";

export type DuelRow = {
  id: string;
  discipline: string;
  unit: string | null;
  challengerName: string;
  opponentName: string;
  status: string;
  challengerValue: number | null;
  opponentValue: number | null;
  challengerDelta: number | null;
  opponentDelta: number | null;
  note: string | null;
  createdAt: string;
};

export type ChallengeRow = {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  higherWins: boolean;
  startsOn: string;
  endsOn: string;
  closed: boolean;
  entries: {
    id: string;
    playerName: string;
    value: number;
    note: string | null;
    rank: number;
  }[];
};

export type DisciplineRow = {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  higherWins: boolean;
  archived: boolean;
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

const TABS = ["Žebříček", "Duely", "Výzvy", "Disciplíny"] as const;
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

function fmt(value: number | null, unit: string | null): string {
  if (value == null) return "—";
  const n = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return unit ? `${n} ${unit}` : n;
}

function delta(n: number | null): string {
  if (n == null) return "";
  return n > 0 ? `+${n}` : String(n);
}

export function RatingView({
  board,
  duels,
  challenges,
  disciplines,
  players,
}: {
  board: RatingRow[];
  duels: DuelRow[];
  challenges: ChallengeRow[];
  disciplines: DisciplineRow[];
  players: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<Tab>("Žebříček");

  const waiting = duels.filter((d) => d.status === "REPORTED").length;
  const openChallenges = challenges.filter((c) => !c.closed).length;

  return (
    <>
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
        <Stat title="Otevřených výzev" value={String(openChallenges)} />
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
          </button>
        ))}
      </nav>

      {tab === "Žebříček" && <Leaderboard board={board} players={players} />}
      {tab === "Duely" && (
        <Duels duels={duels} disciplines={disciplines} players={players} />
      )}
      {tab === "Výzvy" && (
        <Challenges
          challenges={challenges}
          disciplines={disciplines}
          players={players}
        />
      )}
      {tab === "Disciplíny" && <Disciplines disciplines={disciplines} />}
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
            <li key={r.playerId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
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
  disciplines,
  players,
}: {
  duels: DuelRow[];
  disciplines: DisciplineRow[];
  players: { id: string; name: string }[];
}) {
  const [adding, setAdding] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);
  const active = disciplines.filter((d) => !d.archived);

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <h2 className={label}>Duely</h2>
        {active.length > 0 && !adding && (
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
              <span className={label}>Disciplína</span>
              <select name="disciplineId" required className={field}>
                {active.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
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
          Zatím žádné duely. Hráči si je můžou domluvit sami ve svém odkazu.
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
                    <span className="text-xs text-slate-500">{d.discipline}</span>
                  </div>
                  <p className="mt-1.5 font-medium text-slate-800">
                    {d.challengerName}{" "}
                    <span className="text-slate-500">vs</span> {d.opponentName}
                  </p>
                  {d.challengerValue != null && (
                    <p className="mt-1 text-sm tabular-nums text-slate-600">
                      {fmt(d.challengerValue, d.unit)} : {fmt(d.opponentValue, d.unit)}
                      {d.status === "CONFIRMED" && (
                        <span className="ml-2 text-xs text-slate-500">
                          ({delta(d.challengerDelta)} / {delta(d.opponentDelta)})
                        </span>
                      )}
                    </p>
                  )}
                  {d.note && (
                    <p className="mt-1 text-xs text-slate-500">{d.note}</p>
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
                  {(d.status === "ACCEPTED" || d.status === "PENDING") && (
                    <button
                      type="button"
                      className={mini}
                      onClick={() => setReporting(reporting === d.id ? null : d.id)}
                    >
                      Zapsat výsledek
                    </button>
                  )}
                  {d.status !== "CONFIRMED" && (
                    <form action={deleteDuel.bind(null, d.id)}>
                      <button type="submit" className={mini}>
                        Smazat
                      </button>
                    </form>
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
                      <input
                        name="challengerValue"
                        required
                        inputMode="decimal"
                        className={`${field} tabular-nums`}
                      />
                    </label>
                    <label className="block">
                      <span className={label}>{d.opponentName}</span>
                      <input
                        name="opponentValue"
                        required
                        inputMode="decimal"
                        className={`${field} tabular-nums`}
                      />
                    </label>
                  </div>
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

/* ------------------------------------------------------------ výzvy */

function Challenges({
  challenges,
  disciplines,
  players,
}: {
  challenges: ChallengeRow[];
  disciplines: DisciplineRow[];
  players: { id: string; name: string }[];
}) {
  const [adding, setAdding] = useState(false);
  const active = disciplines.filter((d) => !d.archived);

  return (
    <>
      <section className={`${card} mb-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className={label}>Měsíční výzvy</h2>
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
                <input
                  name="name"
                  required
                  placeholder="Výběh Ještědu"
                  className={field}
                />
              </label>
              <label className="block">
                <span className={label}>Disciplína z číselníku</span>
                <select name="disciplineId" defaultValue="vlastni" className={field}>
                  <option value="vlastni">— vlastní —</option>
                  {active.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={label}>Od</span>
                <input type="date" name="startsOn" required className={field} />
              </label>
              <label className="block">
                <span className={label}>Do</span>
                <input type="date" name="endsOn" required className={field} />
              </label>
              <label className="block">
                <span className={label}>Jednotka</span>
                <input name="unit" placeholder="min, km, opakování" className={field} />
              </label>
              <label className="flex cursor-pointer items-end gap-2.5 pb-2 text-sm text-slate-700">
                <input type="checkbox" name="higherWins" defaultChecked />
                Vyhrává vyšší hodnota
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
              U výzvy na čas odškrtni „vyhrává vyšší hodnota“ — pak vede nižší číslo.
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
                  </p>
                  {c.description && (
                    <p className="mt-1 text-sm text-slate-600">{c.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {!c.closed && c.entries.length >= 2 && (
                    <form action={closeChallenge.bind(null, c.id)}>
                      <button type="submit" className={btnPrimary}>
                        Uzavřít a rozdat rating
                      </button>
                    </form>
                  )}
                  {!c.closed && (
                    <form action={deleteChallenge.bind(null, c.id)}>
                      <button type="submit" className={btnDanger}>
                        Smazat
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {c.entries.length > 0 ? (
                <ol className="mt-3 space-y-1">
                  {c.entries.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-1.5 text-sm"
                    >
                      <span className="w-5 shrink-0 text-center font-heading text-xs font-extrabold tabular-nums text-slate-500">
                        {e.rank}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-slate-800">
                        {e.playerName}
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-700">
                        {fmt(e.value, c.unit)}
                      </span>
                      {!c.closed && (
                        <form action={deleteChallengeEntry.bind(null, e.id)}>
                          <button
                            type="submit"
                            className="text-xs text-slate-500 hover:text-red-800"
                            aria-label="Smazat zápis"
                          >
                            ✕
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-xs italic text-slate-500">
                  Zatím nikdo nezapsal výsledek. Hráči je zapisují ve svém odkazu.
                </p>
              )}

              {!c.closed && c.entries.length === 1 && (
                <p className="mt-2 text-xs italic text-amber-900">
                  Na uzavření je potřeba aspoň dva zapsané výsledky — s jedním
                  není proti komu poměřovat.
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {players.length > 0 && (
        <p className="text-xs italic text-slate-500">
          Uzavřením se rozdá rating podle pořadí a výzva se zamkne. Zpět to
          nejde, tak si napřed zkontroluj zapsané hodnoty.
        </p>
      )}
    </>
  );
}

/* ------------------------------------------------------- disciplíny */

function Disciplines({ disciplines }: { disciplines: DisciplineRow[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className={label}>Disciplíny</h2>
          <p className="mt-1 text-xs text-slate-500">
            V čem se dá soupeřit. Přidej si vlastní, kdykoli něco vymyslíte.
          </p>
        </div>
        {!adding && (
          <button type="button" className={btnOutline} onClick={() => setAdding(true)}>
            + Přidat disciplínu
          </button>
        )}
      </div>

      {adding && (
        <form
          action={createDiscipline}
          onSubmit={() => setAdding(false)}
          className="border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-5"
        >
          <DisciplineFields />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="submit" className={btnPrimary}>
              Přidat
            </button>
            <button type="button" className={btnOutline} onClick={() => setAdding(false)}>
              Zrušit
            </button>
          </div>
        </form>
      )}

      <ul className="divide-y divide-slate-100">
        {disciplines.map((d) =>
          editing === d.id ? (
            <li key={d.id} className="bg-slate-50 px-4 py-4 sm:px-5">
              <form
                action={updateDiscipline.bind(null, d.id)}
                onSubmit={() => setEditing(null)}
              >
                <DisciplineFields discipline={d} />
                <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                  <input type="checkbox" name="archived" defaultChecked={d.archived} />
                  Archivovat (nebude se nabízet)
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="submit" className={btnPrimary}>
                    Uložit
                  </button>
                  <button
                    type="button"
                    className={btnOutline}
                    onClick={() => setEditing(null)}
                  >
                    Zrušit
                  </button>
                </div>
              </form>
            </li>
          ) : (
            <li
              key={d.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
            >
              <span className="min-w-0 flex-1">
                <span
                  className={`block font-medium ${d.archived ? "text-slate-500" : "text-slate-800"}`}
                >
                  {d.name}
                  {d.archived && (
                    <span className="ml-2 text-xs text-slate-500">· archiv</span>
                  )}
                </span>
                <span className="block text-xs text-slate-500">
                  {d.unit ?? "bez jednotky"} ·{" "}
                  {d.higherWins ? "vyhrává vyšší" : "vyhrává nižší"}
                  {d.description && ` · ${d.description}`}
                </span>
              </span>
              <button type="button" className={mini} onClick={() => setEditing(d.id)}>
                Upravit
              </button>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function DisciplineFields({ discipline }: { discipline?: DisciplineRow }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="block">
          <span className={label}>Název</span>
          <input
            name="name"
            required
            defaultValue={discipline?.name}
            placeholder="Hod na přesnost"
            className={field}
          />
        </label>
        <label className="block">
          <span className={label}>Jednotka</span>
          <input
            name="unit"
            defaultValue={discipline?.unit ?? ""}
            placeholder="zásahů"
            className={field}
          />
        </label>
        <label className="flex cursor-pointer items-end gap-2.5 pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="higherWins"
            defaultChecked={discipline?.higherWins ?? true}
          />
          Vyhrává vyšší
        </label>
      </div>
      <label className="block">
        <span className={label}>Popis</span>
        <input
          name="description"
          defaultValue={discipline?.description ?? ""}
          placeholder="Deset hodů na kužely."
          className={field}
        />
      </label>
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
