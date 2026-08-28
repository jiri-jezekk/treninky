"use client";

import { useState } from "react";
import {
  confirmDuel,
  createDuel,
  reportDuelResult,
  respondToDuel,
} from "@/actions/duels";
import { submitChallengeEntry } from "@/actions/challenges";
import { initials } from "@/lib/czech";

export type PortalDuel = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  iAmChallenger: boolean;
  opponentName: string;
  myValue: number | null;
  theirValue: number | null;
  myDelta: number | null;
  iReported: boolean;
  note: string | null;
};

type BoardRow = {
  playerId: string;
  playerName: string;
  rating: number;
  rank: number;
  isMe: boolean;
};

type HistoryRow = {
  id: string;
  playerName: string;
  source: string;
  delta: number;
  label: string;
  createdAt: string;
};

const SOURCE_LABEL: Record<string, string> = {
  DUEL: "Duel",
  MATCH: "Zápas",
  CHALLENGE: "Výzva",
  COACH: "Trenér",
};

type ChallengeRow = {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  endsOn: string;
  myValue: number | null;
};

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
const field =
  "mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-club";
const card = "rounded-2xl border border-slate-200 bg-white p-5";
const btnPrimary =
  "inline-flex items-center justify-center rounded-full border-2 border-club bg-club px-4 py-2 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover";
const btnOutline =
  "inline-flex items-center justify-center rounded-full border-2 border-slate-300 px-4 py-2 font-heading text-sm font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft";
const btnSm = "px-3 py-1.5 text-xs";

function fmt(value: number | null, unit?: string | null): string {
  if (value == null) return "—";
  const n = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return unit ? `${n} ${unit}` : n;
}

export function PortalRating({
  payToken,
  myName,
  myRating,
  myRank,
  myBand,
  seasonName,
  board,
  duels,
  opponents,
  challenges,
  history,
}: {
  payToken: string;
  myName: string;
  myRating: number | null;
  myRank: number | null;
  myBand: string | null;
  seasonName: string | null;
  board: BoardRow[];
  duels: PortalDuel[];
  opponents: { id: string; name: string }[];
  challenges: ChallengeRow[];
  history: HistoryRow[];
}) {
  const [challenging, setChallenging] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);

  const open = duels.filter((d) => d.status !== "CONFIRMED" && d.status !== "DECLINED");
  const done = duels.filter((d) => d.status === "CONFIRMED");

  return (
    <>
      <div className="mt-4 rounded-2xl border border-club-line bg-club-soft px-6 py-6 text-center">
        <p className="font-heading text-4xl font-extrabold text-slate-800">
          {myRating ?? "—"}
        </p>
        <p className="mt-2 font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
          Tvůj rating{seasonName ? ` · ${seasonName}` : ""}
        </p>
        {myRank && (
          <p className="mt-2 text-sm text-slate-600">
            {myRank}. místo z {board.length}
            {myBand && ` · ${myBand}`}
          </p>
        )}
      </div>

      {/* ------------------------------------------------- moje duely */}
      <section className={`${card} mt-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={label}>Moje duely</h2>
          {opponents.length > 0 && !challenging && (
            <button
              type="button"
              className={`${btnOutline} ${btnSm}`}
              onClick={() => setChallenging(true)}
            >
              + Vyzvat
            </button>
          )}
        </div>

        {challenging && (
          <form
            action={createDuel}
            onSubmit={() => setChallenging(false)}
            className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"
          >
            <input type="hidden" name="payToken" value={payToken} />
            <label className="block">
              <span className={label}>Koho vyzýváš</span>
              <select name="opponentId" required className={field}>
                {opponents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className={label}>Název duelu</span>
              <input
                name="name"
                required
                placeholder="Hod na přesnost"
                className={field}
              />
            </label>
            <label className="mt-3 block">
              <span className={label}>Z čeho se skládá</span>
              <input
                name="description"
                placeholder="10 hodů na kužely ze šesti metrů"
                className={field}
              />
            </label>
            <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
              <input type="checkbox" name="higherWins" defaultChecked />
              Vyhrává vyšší číslo
            </label>
            <label className="mt-3 block">
              <span className={label}>Vzkaz</span>
              <input name="note" placeholder="Ve čtvrtek po tréninku?" className={field} />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="submit" className={`${btnPrimary} ${btnSm}`}>
                Poslat výzvu
              </button>
              <button
                type="button"
                className={`${btnOutline} ${btnSm}`}
                onClick={() => setChallenging(false)}
              >
                Zrušit
              </button>
            </div>
          </form>
        )}

        {open.length === 0 && !challenging && (
          <p className="mt-3 text-sm italic text-slate-500">
            Žádný rozjetý duel. Vyzvi někoho — porazit silnějšího vynese
            nejvíc.
          </p>
        )}

        <ul className="mt-3 flex flex-col gap-3">
          {open.map((d) => (
            <li key={d.id} className="rounded-xl border border-slate-200 p-3">
              <p className="font-medium text-slate-800">
                {d.opponentName}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {d.name}
                </span>
              </p>
              {d.description && (
                <p className="mt-1 text-xs text-slate-500">{d.description}</p>
              )}
              {d.note && <p className="mt-1 text-xs text-slate-500">{d.note}</p>}

              {/* vyzvaný se rozhoduje */}
              {d.status === "PENDING" && !d.iAmChallenger && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={respondToDuel.bind(null, d.id, true, payToken)}>
                    <button type="submit" className={`${btnPrimary} ${btnSm}`}>
                      Přijmout
                    </button>
                  </form>
                  <form action={respondToDuel.bind(null, d.id, false, payToken)}>
                    <button type="submit" className={`${btnOutline} ${btnSm}`}>
                      Odmítnout
                    </button>
                  </form>
                </div>
              )}
              {d.status === "PENDING" && d.iAmChallenger && (
                <p className="mt-2 text-xs italic text-slate-500">
                  Čeká se, až {d.opponentName} výzvu přijme.
                </p>
              )}

              {/* domluveno — zapsat výsledek */}
              {d.status === "ACCEPTED" && (
                <>
                  {reporting === d.id ? (
                    <form
                      action={reportDuelResult.bind(null, d.id)}
                      onSubmit={() => setReporting(null)}
                      className="mt-3"
                    >
                      <input type="hidden" name="payToken" value={payToken} />
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className={label}>
                            {d.iAmChallenger ? myName : d.opponentName}
                          </span>
                          <input
                            name="challengerValue"
                            required
                            inputMode="decimal"
                            className={`${field} tabular-nums`}
                          />
                        </label>
                        <label className="block">
                          <span className={label}>
                            {d.iAmChallenger ? d.opponentName : myName}
                          </span>
                          <input
                            name="opponentValue"
                            required
                            inputMode="decimal"
                            className={`${field} tabular-nums`}
                          />
                        </label>
                      </div>
                      <button type="submit" className={`${btnPrimary} ${btnSm} mt-3`}>
                        Zapsat
                      </button>
                      <p className="mt-2 text-xs italic text-slate-500">
                        {d.opponentName} to pak odklepne a rating se propíše.
                      </p>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className={`${btnOutline} ${btnSm} mt-3`}
                      onClick={() => setReporting(d.id)}
                    >
                      Zapsat výsledek
                    </button>
                  )}
                </>
              )}

              {/* zapsáno — čeká na potvrzení */}
              {d.status === "REPORTED" && (
                <>
                  <p className="mt-2 text-sm tabular-nums text-slate-700">
                    {fmt(d.myValue)} : {fmt(d.theirValue)}
                  </p>
                  {d.iReported ? (
                    <p className="mt-2 text-xs italic text-slate-500">
                      Čeká se, až to {d.opponentName} potvrdí. Sám sobě výsledek
                      odklepnout nemůžeš.
                    </p>
                  ) : (
                    <form
                      action={confirmDuel.bind(null, d.id, payToken)}
                      className="mt-3"
                    >
                      <button type="submit" className={`${btnPrimary} ${btnSm}`}>
                        Sedí, potvrdit
                      </button>
                      <p className="mt-2 text-xs italic text-slate-500">
                        Kdyby výsledek nesouhlasil, řekni to trenérovi — opraví ho.
                      </p>
                    </form>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>

        {done.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {done.slice(0, 6).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  {d.name} — {d.opponentName}
                </span>
                <span
                  className={`shrink-0 tabular-nums ${
                    (d.myDelta ?? 0) > 0
                      ? "text-emerald-800"
                      : (d.myDelta ?? 0) < 0
                        ? "text-red-800"
                        : ""
                  }`}
                >
                  {(d.myDelta ?? 0) > 0 ? "+" : ""}
                  {d.myDelta ?? 0}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------- výzvy */}
      {challenges.length > 0 && (
        <section className={`${card} mt-4`}>
          <h2 className={label}>Běžící výzvy</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {challenges.map((c) => (
              <li key={c.id} className="rounded-xl border border-slate-200 p-3">
                <p className="font-medium text-slate-800">{c.name}</p>
                {c.description && (
                  <p className="mt-1 text-xs text-slate-500">{c.description}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">do {c.endsOn}</p>

                <form action={submitChallengeEntry.bind(null, c.id)} className="mt-3">
                  <input type="hidden" name="payToken" value={payToken} />
                  <div className="flex items-end gap-2">
                    <label className="block flex-1">
                      <span className={label}>
                        Můj výsledek{c.unit ? ` (${c.unit})` : ""}
                      </span>
                      <input
                        name="value"
                        required
                        inputMode="decimal"
                        defaultValue={c.myValue ?? ""}
                        className={`${field} tabular-nums`}
                      />
                    </label>
                    <button type="submit" className={`${btnPrimary} ${btnSm} mb-0.5`}>
                      {c.myValue == null ? "Zapsat" : "Upravit"}
                    </button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------- žebříček */}
      <section className={`${card} mt-4`}>
        <h2 className={label}>Žebříček</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {board.map((r) => (
            <li
              key={r.playerId}
              className={`flex items-center gap-3 py-2 ${r.isMe ? "font-medium" : ""}`}
            >
              <span className="w-6 shrink-0 text-center font-heading text-xs font-extrabold tabular-nums text-slate-500">
                {r.rank}
              </span>
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border font-heading text-[9px] font-extrabold ${
                  r.isMe
                    ? "border-club bg-club text-onclub"
                    : "border-club-line bg-club-soft text-club"
                }`}
              >
                {initials(r.playerName)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                {r.playerName}
              </span>
              <span className="shrink-0 font-heading text-sm font-bold tabular-nums text-slate-800">
                {r.rating}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {history.length > 0 && (
        <section className={`${card} mt-4`}>
          <h2 className={label}>Co se dělo</h2>
          <p className="mt-1 text-xs text-slate-500">
            Poslední změny ratingu celého týmu.
          </p>
          <ul className="mt-3 divide-y divide-slate-100">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-2 py-2">
                <span className="w-16 shrink-0 text-xs tabular-nums text-slate-500">
                  {h.createdAt}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-800">
                    {h.playerName}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {SOURCE_LABEL[h.source] ?? h.source} · {h.label}
                  </span>
                </span>
                <span
                  className={`shrink-0 font-heading text-sm font-bold tabular-nums ${
                    h.delta > 0
                      ? "text-emerald-800"
                      : h.delta < 0
                        ? "text-red-800"
                        : "text-slate-500"
                  }`}
                >
                  {h.delta > 0 ? "+" : ""}
                  {h.delta}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
        Za každou účast — trénink i posilovnu — je +1. Zbytek si vybojuješ v duelech
        a výzvách — porazit silnějšího vynese nejvíc, prohrát s ním skoro nic
        nestojí.
      </p>
    </>
  );
}
