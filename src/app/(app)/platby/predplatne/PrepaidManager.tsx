"use client";

import { useMemo, useState } from "react";
import {
  addPrepayment,
  addPrepaymentBulk,
  createSeason,
  deletePrepayment,
  deleteSeason,
  setPrepaymentPaid,
  updatePrepayment,
  updateSeason,
} from "@/actions/prepaid";
import { formatCzkFromCents } from "@/lib/money";
import { czPlural, initials } from "@/lib/czech";

export type SeasonRow = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  defaultPriceCents: number | null;
  incomeKind: string;
  prepaidCount: number;
};

export type PlayerLite = {
  id: string;
  name: string;
  number: number;
  active: boolean;
};

export type PrepaymentRow = {
  id: string;
  playerId: string;
  playerName: string;
  seasonId: string | null;
  seasonName: string | null;
  startsOn: string;
  endsOn: string;
  amountCents: number;
  incomeKind: string;
  incomeKindLabel: string;
  vs: string;
  note: string | null;
  paid: boolean;
  current: boolean;
};

const INCOME_OPTIONS: { value: string; label: string }[] = [
  { value: "TRAINING", label: "Tréninkové" },
  { value: "MEMBERSHIP", label: "Členský příspěvek" },
  { value: "EVENT", label: "Akce" },
  { value: "GOODS", label: "Zboží" },
  { value: "OTHER", label: "Ostatní" },
];

const btn =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 px-4 py-2 font-heading text-sm font-semibold transition";
const btnPrimary = `${btn} border-club bg-club text-onclub hover:bg-club-hover`;
const btnOutline = `${btn} border-slate-300 text-slate-800 hover:border-club hover:bg-club-soft`;
const btnDanger = `${btn} border-red-200 text-red-800 hover:border-red-600 hover:bg-red-50`;
const btnSm = "px-3 py-1.5 text-xs";
const mini =
  "rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900";
const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
const field =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-club";

/** „1. 9. 2026“ z hodnoty pole typu date. */
function czDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)}. ${Number(m)}. ${y}`;
}

function czRange(from: string, to: string): string {
  return `${czDay(from)} – ${czDay(to)}`;
}

export function PrepaidManager({
  seasons,
  players,
  prepayments,
}: {
  seasons: SeasonRow[];
  players: PlayerLite[];
  prepayments: PrepaymentRow[];
}) {
  const [seasonDialog, setSeasonDialog] = useState(false);
  const [editingSeason, setEditingSeason] = useState<SeasonRow | null>(null);
  const [assigning, setAssigning] = useState<SeasonRow | null>(null);
  const [editing, setEditing] = useState<PrepaymentRow | null>(null);
  const [customFor, setCustomFor] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const visible = useMemo(
    () => (showPast ? prepayments : prepayments.filter((p) => p.current)),
    [prepayments, showPast],
  );

  const currentCount = prepayments.filter((p) => p.current).length;
  const unpaid = prepayments.filter((p) => !p.paid && p.amountCents > 0);
  const unpaidCents = unpaid.reduce((s, p) => s + p.amountCents, 0);

  return (
    <>
      <dl className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat title="Sezón" value={String(seasons.length)} />
        <Stat title="Předplaceno teď" value={String(currentCount)} accent />
        <Stat title="Nezaplacených" value={String(unpaid.length)} />
        <Stat
          title="Čeká se na"
          value={unpaidCents > 0 ? formatCzkFromCents(unpaidCents) : "—"}
        />
      </dl>

      {/* ---------------------------------------------------------- sezóny */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className={label}>Sezóny</h2>
          <button
            type="button"
            className={`${btnOutline} ${btnSm}`}
            onClick={() => setSeasonDialog(true)}
          >
            + Nová sezóna
          </button>
        </div>

        {seasons.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm italic text-slate-500">
            Zatím žádná sezóna. Založ si ji a pak k ní přiřaď hráče, kteří mají
            zaplaceno dopředu.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {seasons.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-800">{s.name}</span>
                  <span className="block text-xs text-slate-500">
                    {czRange(s.startsOn, s.endsOn)}
                    {s.defaultPriceCents != null &&
                      ` · ${formatCzkFromCents(s.defaultPriceCents)}`}
                    {" · "}
                    {s.prepaidCount}{" "}
                    {czPlural(s.prepaidCount, "hráč", "hráči", "hráčů")}
                  </span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={mini}
                    onClick={() => setAssigning(s)}
                  >
                    Přiřadit hráče
                  </button>
                  <button
                    type="button"
                    className={mini}
                    onClick={() => setEditingSeason(s)}
                  >
                    Upravit
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ----------------------------------------------------- předplatná */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className={label}>Předplatná</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={mini}
              onClick={() => setShowPast((v) => !v)}
            >
              {showPast ? "Jen platná teď" : `Zobrazit i minulá (${prepayments.length})`}
            </button>
            <button
              type="button"
              className={`${btnOutline} ${btnSm}`}
              onClick={() => setCustomFor(true)}
            >
              + Vlastní období
            </button>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm italic text-slate-500">
            {prepayments.length === 0
              ? "Nikdo nemá předplaceno. Všichni platí měsíčně podle docházky."
              : "Teď nemá předplaceno nikdo. Minulá období si zobrazíš tlačítkem nahoře."}
          </p>
        ) : (
          <>
            {/* stůl */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <Th>Hráč</Th>
                    <Th>Období</Th>
                    <Th>Částka</Th>
                    <Th>VS</Th>
                    <Th>Stav</Th>
                    <Th right>Akce</Th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-club-line bg-club-soft font-heading text-[10px] font-extrabold text-club">
                            {initials(p.playerName)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-800">
                              {p.playerName}
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                              {p.seasonName ?? "Vlastní období"}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {czRange(p.startsOn, p.endsOn)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-slate-800">
                        {p.amountCents > 0 ? formatCzkFromCents(p.amountCents) : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-slate-500">
                        {p.amountCents > 0 ? p.vs : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StateBadge row={p} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          className={mini}
                          onClick={() => setEditing(p)}
                        >
                          Upravit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* karty na telefon */}
            <div className="divide-y divide-slate-100 md:hidden">
              {visible.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setEditing(p)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-club-line bg-club-soft font-heading text-[11px] font-extrabold text-club">
                    {initials(p.playerName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-800">
                      {p.playerName}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {czRange(p.startsOn, p.endsOn)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-heading text-sm font-bold tabular-nums text-slate-800">
                      {p.amountCents > 0 ? formatCzkFromCents(p.amountCents) : "—"}
                    </span>
                    <StateBadge row={p} />
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ------------------------------------------------------- dialogy */}

      {seasonDialog && (
        <Dialog title="Nová sezóna" onClose={() => setSeasonDialog(false)}>
          <form action={createSeason} onSubmit={() => setSeasonDialog(false)}>
            <div className="space-y-4 px-6 py-5">
              <SeasonFields />
            </div>
            <DialogFooter onCancel={() => setSeasonDialog(false)} submit="Založit" />
          </form>
        </Dialog>
      )}

      {editingSeason && (
        <Dialog
          title={`Sezóna ${editingSeason.name}`}
          onClose={() => setEditingSeason(null)}
        >
          <form
            action={updateSeason.bind(null, editingSeason.id)}
            onSubmit={() => setEditingSeason(null)}
          >
            <div className="space-y-4 px-6 py-5">
              <SeasonFields season={editingSeason} />
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <input type="checkbox" name="applyToPrepayments" className="mt-0.5" />
                <span className="text-xs text-slate-600">
                  Přepsat období i u{" "}
                  {editingSeason.prepaidCount}{" "}
                  {czPlural(editingSeason.prepaidCount, "hráče", "hráčů", "hráčů")},
                  kteří tuhle sezónu mají. Bez zaškrtnutí zůstanou jejich data
                  taková, jaká jsou — třeba nástup v půlce roku.
                </span>
              </label>
            </div>
            <DialogFooter
              onCancel={() => setEditingSeason(null)}
              submit="Uložit"
              extra={
                <button
                  type="submit"
                  formAction={deleteSeason.bind(null, editingSeason.id)}
                  className={`${btnDanger} ${btnSm}`}
                >
                  Smazat sezónu
                </button>
              }
            />
          </form>
          <p className="border-t border-slate-200 px-6 py-3 text-xs text-slate-500">
            Smazání sezóny nesebere hráčům předplacená období — jen ztratí název.
            Kdyby je sebralo, obnovily by se jim staré platby.
          </p>
        </Dialog>
      )}

      {assigning && (
        <Dialog
          title={`Přiřadit k ${assigning.name}`}
          onClose={() => setAssigning(null)}
          wide
        >
          <form action={addPrepaymentBulk} onSubmit={() => setAssigning(null)}>
            <input type="hidden" name="seasonId" value={assigning.id} />
            <div className="space-y-4 px-6 py-5">
              <p className="text-xs text-slate-500">
                Období {czRange(assigning.startsOn, assigning.endsOn)}. Kdo už
                tuhle sezónu nebo překrývající období má, přeskočí se.
              </p>
              <div>
                <span className={label}>Částka na hráče</span>
                <input
                  type="text"
                  name="amount"
                  inputMode="decimal"
                  defaultValue={
                    assigning.defaultPriceCents != null
                      ? String(assigning.defaultPriceCents / 100)
                      : ""
                  }
                  placeholder="např. 3500"
                  className={`${field} mt-1.5`}
                />
                <p className="mt-1 text-xs italic text-slate-500">
                  Prázdné = jen vyjmutí z účtování, hráči se nezobrazí žádná
                  platba k úhradě.
                </p>
              </div>
              <div>
                <span className={label}>Hráči</span>
                <div className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                  {players.map((pl) => {
                    const has = prepayments.some(
                      (p) => p.playerId === pl.id && p.seasonId === assigning.id,
                    );
                    return (
                      <label
                        key={pl.id}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm ${
                          has ? "opacity-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="playerIds"
                          value={pl.id}
                          disabled={has}
                        />
                        <span className="min-w-0 flex-1 truncate text-slate-800">
                          {pl.name}
                        </span>
                        {has && (
                          <span className="shrink-0 text-xs text-slate-500">už má</span>
                        )}
                        {!pl.active && (
                          <span className="shrink-0 text-xs text-slate-500">
                            neaktivní
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter onCancel={() => setAssigning(null)} submit="Přiřadit" />
          </form>
        </Dialog>
      )}

      {customFor && (
        <Dialog title="Vlastní období" onClose={() => setCustomFor(false)}>
          <form action={addPrepayment} onSubmit={() => setCustomFor(false)}>
            <input type="hidden" name="seasonId" value="vlastni" />
            <div className="space-y-4 px-6 py-5">
              <p className="text-xs text-slate-500">
                Pro případ, kdy období neodpovídá žádné sezóně — třeba půlrok
                nebo dohoda na pár měsíců.
              </p>
              <div>
                <span className={label}>Hráč</span>
                <select name="playerId" required className={`${field} mt-1.5`}>
                  {players.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name}
                    </option>
                  ))}
                </select>
              </div>
              <DateRangeFields />
              <AmountAndKindFields />
              <div>
                <span className={label}>Poznámka</span>
                <input type="text" name="note" className={`${field} mt-1.5`} />
              </div>
              <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700">
                <input type="checkbox" name="paid" />
                Už zaplaceno
              </label>
            </div>
            <DialogFooter onCancel={() => setCustomFor(false)} submit="Přidat" />
          </form>
        </Dialog>
      )}

      {editing && (
        <Dialog
          title={`${editing.playerName} — předplatné`}
          onClose={() => setEditing(null)}
        >
          <form
            action={updatePrepayment.bind(null, editing.id)}
            onSubmit={() => setEditing(null)}
          >
            <div className="space-y-4 px-6 py-5">
              <p className="text-xs text-slate-500">
                {editing.seasonName ?? "Vlastní období"}
                {editing.amountCents > 0 && ` · VS ${editing.vs}`}
              </p>
              <DateRangeFields from={editing.startsOn} to={editing.endsOn} />
              <AmountAndKindFields
                amountCents={editing.amountCents}
                incomeKind={editing.incomeKind}
              />
              <div>
                <span className={label}>Poznámka</span>
                <input
                  type="text"
                  name="note"
                  defaultValue={editing.note ?? ""}
                  className={`${field} mt-1.5`}
                />
              </div>
            </div>
            <DialogFooter
              onCancel={() => setEditing(null)}
              submit="Uložit"
              extra={
                <>
                  {editing.amountCents > 0 && (
                    <button
                      type="submit"
                      formAction={setPrepaymentPaid.bind(null, editing.id, !editing.paid)}
                      className={`${btnOutline} ${btnSm}`}
                    >
                      {editing.paid ? "Zrušit zaplaceno" : "Označit zaplaceno"}
                    </button>
                  )}
                  <button
                    type="submit"
                    formAction={deletePrepayment.bind(null, editing.id)}
                    className={`${btnDanger} ${btnSm}`}
                  >
                    Smazat
                  </button>
                </>
              }
            />
          </form>
          <p className="border-t border-slate-200 px-6 py-3 text-xs text-slate-500">
            Smazáním se hráči tréninky z tohohle období zase začnou účtovat do
            měsíčních plateb.
          </p>
        </Dialog>
      )}
    </>
  );
}

/* ------------------------------------------------------------ kousky */

function SeasonFields({ season }: { season?: SeasonRow }) {
  return (
    <>
      <div>
        <span className={label}>Název</span>
        <input
          type="text"
          name="name"
          required
          defaultValue={season?.name}
          placeholder="Sezóna 2026/27"
          className={`${field} mt-1.5`}
        />
      </div>
      <DateRangeFields from={season?.startsOn} to={season?.endsOn} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className={label}>Nabízená cena (Kč)</span>
          <input
            type="text"
            name="defaultPrice"
            inputMode="decimal"
            defaultValue={
              season?.defaultPriceCents != null
                ? String(season.defaultPriceCents / 100)
                : ""
            }
            className={`${field} mt-1.5`}
          />
        </div>
        <div>
          <span className={label}>Druh příjmu</span>
          <select
            name="incomeKind"
            defaultValue={season?.incomeKind ?? "TRAINING"}
            className={`${field} mt-1.5`}
          >
            {INCOME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}

function DateRangeFields({ from, to }: { from?: string; to?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <span className={label}>Od</span>
        <input
          type="date"
          name="startsOn"
          required
          defaultValue={from}
          className={`${field} mt-1.5`}
        />
      </div>
      <div>
        <span className={label}>Do</span>
        <input
          type="date"
          name="endsOn"
          required
          defaultValue={to}
          className={`${field} mt-1.5`}
        />
      </div>
    </div>
  );
}

function AmountAndKindFields({
  amountCents,
  incomeKind,
}: {
  amountCents?: number;
  incomeKind?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <span className={label}>Částka (Kč)</span>
        <input
          type="text"
          name="amount"
          inputMode="decimal"
          defaultValue={
            amountCents != null && amountCents > 0 ? String(amountCents / 100) : ""
          }
          className={`${field} mt-1.5`}
        />
        <p className="mt-1 text-xs italic text-slate-500">
          Prázdné = jen vyjmutí z účtování.
        </p>
      </div>
      <div>
        <span className={label}>Druh příjmu</span>
        <select
          name="incomeKind"
          defaultValue={incomeKind ?? "TRAINING"}
          className={`${field} mt-1.5`}
        >
          {INCOME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function StateBadge({ row }: { row: PrepaymentRow }) {
  if (row.amountCents <= 0) {
    return <Badge tone="off">Bez platby</Badge>;
  }
  if (row.paid) return <Badge tone="ok">Zaplaceno</Badge>;
  return <Badge tone="warn">Čeká na platbu</Badge>;
}

function Badge({
  tone,
  children,
}: {
  tone: "ok" | "off" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-800"
      : tone === "warn"
        ? "bg-amber-50 text-amber-900"
        : "bg-slate-50 text-slate-500";
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider ${cls}`}
    >
      {children}
    </span>
  );
}

function Stat({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <dt className={label}>{title}</dt>
      <dd
        className={`mt-1 font-heading text-2xl font-extrabold tabular-nums ${
          accent ? "text-club" : "text-slate-800"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-4 py-2.5 font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 ${
        right ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Dialog({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(2,6,23,.75)] p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`my-8 w-full rounded-2xl border border-slate-200 bg-[#0f172a] shadow-2xl ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <h3 className="font-heading text-lg font-extrabold text-slate-800">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-slate-500 hover:text-slate-900"
            aria-label="Zavřít"
          >
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function DialogFooter({
  onCancel,
  submit,
  extra,
}: {
  onCancel: () => void;
  submit: string;
  extra?: React.ReactNode;
}) {
  return (
    <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
      {extra}
      <button type="button" className={`${btnOutline} ${btnSm}`} onClick={onCancel}>
        Zrušit
      </button>
      <button type="submit" className={`${btnPrimary} ${btnSm}`}>
        {submit}
      </button>
    </footer>
  );
}
