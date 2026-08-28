"use client";

import { useState } from "react";
import {
  confirmDuel,
  createDuel,
  reportDuelResult,
  respondToDuel,
} from "@/actions/duels";
import { submitChallengeEntry } from "@/actions/challenges";
import { deleteSoloSession, logSoloSession } from "@/actions/solo-sessions";
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
  higherWins: boolean;
  /** Co se stane po potvrzení. Null, dokud se výsledek nezapsal. */
  preview: {
    myDelta: number;
    theirDelta: number;
    iWin: boolean | null;
  } | null;
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
  solos,
  inRating,
  today,
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
  solos: { id: string; name: string; performedOn: string }[];
  inRating: boolean;
  today: string;
}) {
  const [challenging, setChallenging] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);
  const [loggingSolo, setLoggingSolo] = useState(false);

  const open = duels.filter((d) => d.status !== "CONFIRMED" && d.status !== "DECLINED");
  const done = duels.filter((d) => d.status === "CONFIRMED");

  if (!inRating) {
    return (
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
        <p className="text-sm text-slate-600">
          Zatím nejsi zapojený do ratingu. Kdybys chtěl, řekni trenérovi —
          zapne ti to.
        </p>
      </div>
    );
  }

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
                      {/* Řádky, ne dva sloupce — dlouhá jména se na telefon
                          vedle sebe nevejdou a rozhodí layout. */}
                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        <ScoreInput
                          name="challengerValue"
                          player={d.iAmChallenger ? myName : d.opponentName}
                        />
                        <ScoreInput
                          name="opponentValue"
                          player={d.iAmChallenger ? d.opponentName : myName}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {d.higherWins
                          ? "Vyhrává vyšší číslo."
                          : "Vyhrává nižší číslo (čas)."}
                      </p>
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
                  <DuelResult
                    myName={myName}
                    theirName={d.opponentName}
                    myValue={d.myValue}
                    theirValue={d.theirValue}
                    myDelta={d.preview?.myDelta ?? null}
                    theirDelta={d.preview?.theirDelta ?? null}
                    iWin={d.preview?.iWin ?? null}
                    pending
                  />
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
                  {(d.myDelta ?? 0) > 0
                    ? "Výhra"
                    : (d.myDelta ?? 0) < 0
                      ? "Prohra"
                      : "Remíza"}{" "}
                  · {d.name} — {d.opponentName}
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

      {/* ------------------------------------- individuální tréninky */}
      <section className={`${card} mt-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className={label}>Trénoval jsem sám</h2>
            <p className="mt-1 text-xs text-slate-500">
              Házení, posilovna, běh — každý den +1 jako za trénink.
            </p>
          </div>
          {!loggingSolo && (
            <button
              type="button"
              className={`${btnOutline} ${btnSm}`}
              onClick={() => setLoggingSolo(true)}
            >
              + Zapsat
            </button>
          )}
        </div>

        {loggingSolo && (
          <form
            action={logSoloSession}
            onSubmit={() => setLoggingSolo(false)}
            className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"
          >
            <input type="hidden" name="payToken" value={payToken} />
            <label className="block">
              <span className={label}>Co jsi dělal</span>
              <input
                name="name"
                required
                placeholder="Házení na terč"
                className={field}
              />
            </label>
            <label className="mt-3 block">
              <span className={label}>Kdy</span>
              <input
                type="date"
                name="performedOn"
                required
                defaultValue={today}
                max={today}
                className={field}
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="submit" className={`${btnPrimary} ${btnSm}`}>
                Zapsat
              </button>
              <button
                type="button"
                className={`${btnOutline} ${btnSm}`}
                onClick={() => setLoggingSolo(false)}
              >
                Zrušit
              </button>
            </div>
            <p className="mt-2 text-xs italic text-slate-500">
              Jeden zápis na den — počítá se pravidelnost, ne počet řádků.
              Zápis na tentýž den ten předchozí přepíše.
            </p>
          </form>
        )}

        {solos.length === 0 ? (
          <p className="mt-3 text-sm italic text-slate-500">
            Zatím nic. Zapiš si, co jsi natrénoval mimo klub.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {solos.map((so) => (
              <li key={so.id} className="flex items-center gap-2 py-2">
                <span className="w-20 shrink-0 text-xs tabular-nums text-slate-500">
                  {so.performedOn}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                  {so.name}
                </span>
                <span className="shrink-0 font-heading text-sm font-bold text-emerald-800">
                  +1
                </span>
                <form action={deleteSoloSession.bind(null, so.id, payToken)}>
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
        )}
      </section>

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
        Za každou účast je +1 — klubový trénink, posilovna i to, co si
        zapíšeš sám. Zbytek si vybojuješ v duelech
        a výzvách — porazit silnějšího vynese nejvíc, prohrát s ním skoro nic
        nestojí.
      </p>
    </>
  );
}

/** Jeden řádek zadání skóre: jméno vlevo, políčko vpravo. */
function ScoreInput({ name, player }: { name: string; player: string }) {
  return (
    <label className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0">
      <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{player}</span>
      <input
        name={name}
        required
        inputMode="decimal"
        placeholder="0"
        className="w-16 shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm tabular-nums text-slate-900 outline-none focus:border-club"
      />
    </label>
  );
}

/**
 * Výsledek duelu tak, aby bylo jasné, kdo vyhrál a kolik to komu udělá.
 * U nepotvrzených je to náhled ze stejné funkce, jaká se pak použije
 * při zápisu — hráč nesmí vidět jedno číslo a dostat jiné.
 */
function DuelResult({
  myName,
  theirName,
  myValue,
  theirValue,
  myDelta,
  theirDelta,
  iWin,
  pending,
}: {
  myName: string;
  theirName: string;
  myValue: number | null;
  theirValue: number | null;
  myDelta: number | null;
  theirDelta: number | null;
  iWin: boolean | null;
  pending?: boolean;
}) {
  const rows = [
    { name: myName, value: myValue, delta: myDelta, wins: iWin === true },
    { name: theirName, value: theirValue, delta: theirDelta, wins: iWin === false },
  ];

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
      {rows.map((r) => (
        <div
          key={r.name}
          className={`flex items-center gap-2 px-3 py-2 ${r.wins ? "bg-emerald-50" : ""}`}
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
          <span className="w-14 shrink-0 text-right text-sm tabular-nums text-slate-700">
            {fmt(r.value)}
          </span>
          <span
            className={`w-12 shrink-0 text-right font-heading text-sm font-bold tabular-nums ${
              (r.delta ?? 0) > 0
                ? "text-emerald-800"
                : (r.delta ?? 0) < 0
                  ? "text-red-800"
                  : "text-slate-500"
            }`}
          >
            {r.delta == null ? "—" : r.delta > 0 ? `+${r.delta}` : String(r.delta)}
          </span>
        </div>
      ))}
      {iWin === null && myValue != null && (
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
