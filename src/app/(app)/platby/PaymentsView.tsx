"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  markPlayerAllPaid,
  setMonthPaid,
  setPaymentItemDue,
  setPaymentItemHidden,
  setPaymentItemPaid,
} from "@/actions/payments";
import { buildReminderMessage } from "@/lib/reminder-message";
import { formatCzkFromCents } from "@/lib/money";
import { formatMonthLabelCs } from "@/lib/training-pricing";
import { czPlural, initials } from "@/lib/czech";

export type DebtItem = {
  key: string;
  label: string;
  amountCents: number;
  kind: "monthly" | "event" | "prepaid";
  /** Hráč ji v odkazu nevidí a výzva k platbě ji vynechá. */
  hidden: boolean;
  /** Dohodnutá splatnost „RRRR-MM-DD“, nebo null. */
  dueOn: string | null;
  /** Splatnost ještě nenastala — do výzvy nepatří. */
  later: boolean;
  sortKey: number;
  year?: number;
  month?: number;
};

export type Debtor = {
  playerId: string;
  playerName: string;
  payToken: string;
  /** Splatné teď. */
  totalCents: number;
  /** Dohodnuto na později. */
  laterCents: number;
  items: DebtItem[];
};

export type MonthlyRow = {
  playerId: string;
  playerName: string;
  playerNumber: number;
  sessionCount: number;
  totalCents: number;
  paid: boolean;
  variableSymbol: string;
};

export type EventRow = {
  id: string;
  number: number;
  title: string;
  description: string | null;
  archived: boolean;
  createdAt: string;
  participantCount: number;
  /** Vyplněné = akce má jediného účastníka, typicky platba jednomu hráči. */
  singlePlayerName: string | null;
  paidCount: number;
  totalCents: number;
  collectedCents: number;
};

type Tab = "dluznici" | "mesicni" | "akce";

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
const mini =
  "rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50";
const miniPay =
  "rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 border-club bg-club px-4 py-2 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover";
const btnOutline =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 border-slate-300 px-4 py-2 font-heading text-sm font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft";

export function PaymentsView({
  tab,
  year,
  month,
  hasIban,
  clubName,
  debtors,
  monthly,
  events,
  activePlayerCount,
}: {
  tab: Tab;
  year: number;
  month: number;
  hasIban: boolean;
  clubName: string;
  debtors: Debtor[];
  monthly: MonthlyRow[];
  events: EventRow[];
  /** Jmenovatel u počtu dlužníků — „3 z 24 hráčů“. */
  activePlayerCount: number;
}) {
  const [remind, setRemind] = useState<Debtor | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [monthFilter, setMonthFilter] = useState<"all" | "due" | "paid">("all");
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [pending, startTransition] = useTransition();

  function toggleExpanded(playerId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
    });
  }

  // Výzva k platbě obsahuje jen to, co hráč v odkazu uvidí jako splatné.
  const visibleItems = (d: Debtor) => d.items.filter((i) => !i.hidden && !i.later);
  const visibleTotal = (d: Debtor) =>
    visibleItems(d).reduce((s, i) => s + i.amountCents, 0);
  const remindable = debtors.filter((d) => visibleItems(d).length > 0);

  const owedTotal = debtors.reduce((s, d) => s + d.totalCents, 0);
  // Kdo má jen dohodnutou pozdější splatnost, ten zatím nedluží.
  const owingCount = debtors.filter((d) => d.totalCents > 0).length;
  const monthTotal = monthly.reduce((s, r) => s + r.totalCents, 0);
  const monthPaid = monthly.filter((r) => r.paid).reduce((s, r) => s + r.totalCents, 0);
  const openEvents = events.filter((e) => e.paidCount < e.participantCount).length;

  const oldest = useMemo(() => {
    const months = debtors
      .flatMap((d) => d.items)
      .filter(
        (i) => !i.later && i.kind === "monthly" && i.year != null && i.month != null,
      )
      .sort((a, b) => a.sortKey - b.sortKey);
    const first = months[0];
    return first ? formatMonthLabelCs(first.year!, first.month!) : "—";
  }, [debtors]);

  const prev = new Date(year, month - 2, 1);
  const next = new Date(year, month, 1);

  const visibleMonthly = monthly.filter((r) =>
    monthFilter === "due" ? !r.paid : monthFilter === "paid" ? r.paid : true,
  );

  function messageFor(d: Debtor): string {
    const url =
      typeof window === "undefined"
        ? `/p/${d.payToken}`
        : `${window.location.origin}/p/${d.payToken}`;
    return buildReminderMessage({
      playerName: d.playerName,
      clubName,
      items: visibleItems(d),
      totalCents: visibleTotal(d),
      url,
    });
  }

  async function copy(text: string, tag: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(null), 2200);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-extrabold uppercase tracking-wide text-slate-800">
            Platby
          </h1>
          <div className="mt-3 h-1 w-14 rounded bg-club" />
          <p className="mt-3 max-w-prose text-sm text-slate-600">
            Kdo kolik dluží, za co, a jak mu to poslat. Měsíční tréninky i jednorázové
            akce na jednom místě.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/platby/predplatne" className={btnOutline}>
            Předplatné
          </Link>
          <Link href="/platby/ucetnictvi" className={btnOutline}>
            Pro účetní
          </Link>
          <button
            type="button"
            className={btnOutline}
            onClick={() => setShowAll(true)}
            disabled={remindable.length === 0}
          >
            Výzvy všem dlužníkům
          </button>
          <Link href="/platby/akce/platba-hraci" className={btnOutline}>
            + Platba hráči
          </Link>
          <Link href="/platby/akce/nova" className={btnPrimary}>
            + Nová akce
          </Link>
        </div>
      </div>

      {!hasIban && (
        <p className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          V <Link href="/nastaveni" className="underline">Nastavení</Link> chybí IBAN.
          Bez něj se hráčům nevykreslí QR kódy.
        </p>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat title="K inkasu celkem" value={formatCzkFromCents(owedTotal)} tone="bad" />
        <Stat
          title="Dlužníků"
          value={String(owingCount)}
          note={`z ${activePlayerCount} ${czPlural(activePlayerCount, "hráče", "hráčů", "hráčů")}`}
        />
        <Stat
          title={`Vybráno ${formatMonthLabelCs(year, month).split(" ")[0]}`}
          value={formatCzkFromCents(monthPaid)}
          note={`z ${formatCzkFromCents(monthTotal)}`}
          tone="good"
        />
        <Stat title="Nejstarší dluh" value={oldest} />
      </dl>

      <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-100 pb-5">
        <TabLink current={tab} value="dluznici" year={year} month={month} count={owingCount}>
          Dlužníci
        </TabLink>
        <TabLink current={tab} value="mesicni" year={year} month={month}>
          Měsíční tréninky
        </TabLink>
        <TabLink current={tab} value="akce" year={year} month={month} count={openEvents}>
          Akce
        </TabLink>
      </nav>

      {/* ---------------------------------------------------------- dlužníci */}
      {tab === "dluznici" &&
        (debtors.length === 0 ? (
          <Empty title="Nikdo nic nedluží" note="Všechny platby jsou vyrovnané." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {debtors.map((d) => (
                <DebtorRow
                  key={d.playerId}
                  debtor={d}
                  open={expanded.has(d.playerId)}
                  pending={pending}
                  remindableCount={visibleItems(d).length}
                  onToggle={() => toggleExpanded(d.playerId)}
                  onRemind={() => setRemind(d)}
                  run={run}
                />
              ))}
            </ul>
          </div>
        ))}

      {/* ---------------------------------------------------------- měsíční */}
      {tab === "mesicni" && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <MonthLink year={prev.getFullYear()} month={prev.getMonth() + 1} label="←" />
              <span className="min-w-[11ch] text-center font-heading text-base font-extrabold uppercase tracking-wide text-slate-800">
                {formatMonthLabelCs(year, month)}
              </span>
              <MonthLink year={next.getFullYear()} month={next.getMonth() + 1} label="→" />
            </div>
            <div className="flex gap-2">
              {(
                [
                  ["all", "Vše"],
                  ["due", "K úhradě"],
                  ["paid", "Zaplaceno"],
                ] as const
              ).map(([v, t]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={monthFilter === v}
                  onClick={() => setMonthFilter(v)}
                  className={`rounded-full border-2 px-4 py-1.5 font-heading text-xs font-semibold transition ${
                    monthFilter === v
                      ? "border-club bg-club text-onclub"
                      : "border-slate-300 text-slate-600 hover:border-club hover:bg-club-soft"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {visibleMonthly.length === 0 ? (
            <Empty
              title="V tomto měsíci není co účtovat"
              note="Nikdo nebyl na žádném placeném tréninku."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="table-scroll-wrapper">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-club bg-slate-50">
                      <th className={`px-4 py-3 ${label}`}>Hráč</th>
                      <th className={`px-4 py-3 ${label}`}>Tréninků</th>
                      <th className={`px-4 py-3 ${label}`}>Variabilní symbol</th>
                      <th className={`px-4 py-3 text-right ${label}`}>Částka</th>
                      <th className={`px-4 py-3 ${label}`}>Stav</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleMonthly.map((r) => (
                      <tr key={r.playerId} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-club-line bg-club-soft font-heading text-[10px] font-extrabold text-club">
                              {initials(r.playerName)}
                            </span>
                            <span className="font-medium text-slate-800">
                              {r.playerName}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 font-heading font-bold tabular-nums text-slate-800">
                          {r.sessionCount}
                        </td>
                        <td className="px-4 py-3 font-heading text-xs tabular-nums tracking-wide text-slate-500">
                          {r.variableSymbol}
                        </td>
                        <td className="px-4 py-3 text-right font-heading font-bold tabular-nums text-slate-800">
                          {formatCzkFromCents(r.totalCents)}
                        </td>
                        <td className="px-4 py-3">
                          {r.paid ? (
                            <Badge tone="ok">Zaplaceno</Badge>
                          ) : (
                            <Badge tone="due">K úhradě</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <form action={setMonthPaid} className="inline">
                            <input type="hidden" name="playerId" value={r.playerId} />
                            <input type="hidden" name="year" value={year} />
                            <input type="hidden" name="month" value={month} />
                            <input
                              type="hidden"
                              name="paid"
                              value={r.paid ? "false" : "true"}
                            />
                            <button
                              type="submit"
                              className={r.paid ? mini : miniPay}
                            >
                              {r.paid ? "Zrušit" : "Zaplaceno"}
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ------------------------------------------------------------- akce */}
      {tab === "akce" &&
        (events.length === 0 ? (
          <Empty
            title="Zatím žádné akce"
            note="Turnaj, dresy, soustředění — cokoli, co se platí mimo tréninky."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((e) => {
              const done = e.paidCount === e.participantCount;
              const pct =
                e.totalCents > 0
                  ? Math.round((e.collectedCents / e.totalCents) * 100)
                  : 0;
              return (
                <Link
                  key={e.id}
                  href={`/platby/akce/${e.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-club-line"
                >
                  <div>
                    <h2 className="font-heading text-base font-bold uppercase tracking-wide text-slate-800">
                      {e.title}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {e.description || "Jednorázová akce"}
                    </p>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-heading text-xl font-extrabold tabular-nums text-slate-800">
                      {formatCzkFromCents(e.collectedCents)}
                    </span>
                    <span className="text-xs text-slate-500">
                      z {formatCzkFromCents(e.totalCents)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full rounded-full bg-emerald-600"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    {e.singlePlayerName != null ? (
                      <span className="min-w-0 truncate">{e.singlePlayerName}</span>
                    ) : (
                      <span>
                        {e.paidCount} z {e.participantCount} zaplatilo
                      </span>
                    )}
                    {done ? (
                      <Badge tone="ok">
                        {e.singlePlayerName != null ? "Zaplaceno" : "Vyrovnáno"}
                      </Badge>
                    ) : (
                      <Badge tone="due">
                        {e.singlePlayerName != null
                          ? "K úhradě"
                          : `${e.participantCount - e.paidCount} chybí`}
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}

      {/* --------------------------------------------------- výzva jednomu */}
      {remind && (
        <Modal onClose={() => setRemind(null)} title={remind.playerName}
          subtitle={`${formatCzkFromCents(visibleTotal(remind))} · ${visibleItems(remind).length} ${czPlural(visibleItems(remind).length, "položka", "položky", "položek")}`}>
          <div className="flex flex-col gap-4">
            <label className="block">
              <span className={label}>Zpráva k odeslání</span>
              <textarea
                readOnly
                rows={9}
                value={messageFor(remind)}
                className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-relaxed text-slate-800 outline-none focus:border-club"
              />
            </label>
            <p className="text-xs italic text-slate-500">
              Odkaz na konci je pro tohoto hráče trvalý. Otevře přehled plateb i s QR.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              className={btnOutline}
              onClick={() =>
                void copy(
                  `${window.location.origin}/p/${remind.payToken}`,
                  "link",
                )
              }
            >
              {copied === "link" ? "Zkopírováno" : "Jen odkaz"}
            </button>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => void copy(messageFor(remind), "msg")}
            >
              {copied === "msg" ? "Zkopírováno" : "Zkopírovat zprávu"}
            </button>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------ výzvy všem */}
      {showAll && (
        <Modal
          onClose={() => setShowAll(false)}
          title="Výzvy všem dlužníkům"
          subtitle={`${remindable.length} ${czPlural(remindable.length, "dlužník", "dlužníci", "dlužníků")} · celkem ${formatCzkFromCents(remindable.reduce((s, d) => s + visibleTotal(d), 0))}`}
        >
          <p className="text-sm text-slate-600">
            Každému patří jedna zpráva s jeho vlastním odkazem. Zkopíruj je najednou,
            nebo po jedné.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {remindable.map((d) => (
              <li
                key={d.playerId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="font-medium text-slate-800">{d.playerName}</span>{" "}
                  <span className="font-heading font-bold text-red-800">
                    {formatCzkFromCents(visibleTotal(d))}
                  </span>
                </span>
                <button
                  type="button"
                  className={mini}
                  onClick={() => void copy(messageFor(d), d.playerId)}
                >
                  {copied === d.playerId ? "Zkopírováno" : "Kopírovat"}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              className={btnPrimary}
              onClick={() =>
                void copy(
                  remindable.map((d) => messageFor(d)).join("\n\n———\n\n"),
                  "all",
                )
              }
            >
              {copied === "all" ? "Zkopírováno" : "Zkopírovat všechny zprávy"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- pomocné */

/** „2027-01-31“ → „31. 1. 2027“. */
function formatDueCs(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${m}. ${y}`;
}

function Tag({
  tone,
  children,
}: {
  tone: "muted" | "later" | "due";
  children: React.ReactNode;
}) {
  const cls =
    tone === "later"
      ? "border-amber-300 bg-amber-50 text-amber-600"
      : tone === "due"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-slate-200 bg-slate-100 text-slate-500";
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider ${cls}`}
    >
      {children}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M5 7.5 10 12.5 15 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ItemTags({ item }: { item: DebtItem }) {
  return (
    <>
      {item.hidden && <Tag tone="muted">Skryto hráči</Tag>}
      {item.dueOn && (
        <Tag tone={item.later ? "later" : "due"}>
          {item.later ? "Splatné do" : "Splatnost"} {formatDueCs(item.dueOn)}
        </Tag>
      )}
    </>
  );
}

/**
 * Jeden dlužník. Sbalený ukazuje, za co dluží; rozbalený nabízí
 * u každé položky zaplacení, skrytí a splatnost zvlášť.
 */
function DebtorRow({
  debtor: d,
  open,
  pending,
  remindableCount,
  onToggle,
  onRemind,
  run,
}: {
  debtor: Debtor;
  open: boolean;
  pending: boolean;
  remindableCount: number;
  onToggle: () => void;
  onRemind: () => void;
  run: (action: () => Promise<void>) => void;
}) {
  const hiddenCount = d.items.filter((i) => i.hidden).length;

  return (
    <li className={`transition ${open ? "bg-slate-50" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-club-line bg-club-soft font-heading text-[11px] font-extrabold text-club">
          {initials(d.playerName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-slate-800">{d.playerName}</span>
          <span className="block text-xs text-slate-500">
            {d.items.length} {czPlural(d.items.length, "položka", "položky", "položek")}
            {hiddenCount > 0 &&
              ` · ${hiddenCount} ${czPlural(hiddenCount, "skrytá", "skryté", "skrytých")}`}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span
            className={`block font-heading text-lg font-extrabold tabular-nums ${
              d.totalCents > 0 ? "text-red-800" : "text-slate-500"
            }`}
          >
            {formatCzkFromCents(d.totalCents)}
          </span>
          {d.laterCents > 0 && (
            <span className="block text-xs tabular-nums text-amber-600">
              + {formatCzkFromCents(d.laterCents)} později
            </span>
          )}
        </span>
        <Chevron open={open} />
      </button>

      {open ? (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <ul className="flex flex-col gap-2">
            {d.items.map((i) => (
              <li
                key={i.key}
                className={`rounded-xl border border-slate-200 bg-white p-3 sm:p-4 ${
                  i.hidden ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{i.label}</p>
                    {(i.hidden || i.dueOn) && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <ItemTags item={i} />
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 font-heading text-base font-extrabold tabular-nums text-slate-800">
                    {formatCzkFromCents(i.amountCents)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <label className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
                    <span className="font-heading text-[10px] font-bold uppercase tracking-wider">
                      Splatné do
                    </span>
                    <input
                      type="date"
                      defaultValue={i.dueOn ?? ""}
                      disabled={pending}
                      onChange={(e) => {
                        const value = e.currentTarget.value;
                        // Při psaní roku ručně chodí i „0002-01-31“ —
                        // ukládá se až celé datum, nebo smazání.
                        if (value !== "" && value < "2000-01-01") return;
                        run(() => setPaymentItemDue(d.playerId, i.key, value));
                      }}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-800 outline-none [color-scheme:dark] focus:border-club"
                    />
                  </label>
                  <span className="ml-auto flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={mini}
                      disabled={pending}
                      onClick={() =>
                        run(() => setPaymentItemHidden(d.playerId, i.key, !i.hidden))
                      }
                    >
                      {i.hidden ? "Ukázat hráči" : "Skrýt hráči"}
                    </button>
                    <button
                      type="button"
                      className={miniPay}
                      disabled={pending}
                      onClick={() => run(() => setPaymentItemPaid(d.playerId, i.key, true))}
                    >
                      ✓ Zaplaceno
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <a
              href={`/p/${d.payToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className={mini}
            >
              Náhled hráče ↗
            </a>
            <button
              type="button"
              className={mini}
              onClick={onRemind}
              disabled={remindableCount === 0}
              title={
                remindableCount === 0
                  ? "Hráč teď nemá nic splatného, co by viděl."
                  : undefined
              }
            >
              Poslat výzvu
            </button>
            <button
              type="button"
              className={miniPay}
              disabled={pending || d.totalCents === 0}
              onClick={() => run(() => markPlayerAllPaid(d.playerId))}
            >
              Vše splatné zaplaceno
            </button>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5 px-4 pb-4 pl-[4.25rem] text-sm sm:px-5 sm:pl-[4.5rem]">
          {d.items.map((i) => (
            <li
              key={i.key}
              className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${
                i.hidden ? "text-slate-400" : "text-slate-600"
              }`}
            >
              <b className={`tabular-nums ${i.hidden ? "text-slate-500" : "text-slate-800"}`}>
                {formatCzkFromCents(i.amountCents)}
              </b>
              <span className="min-w-0">{i.label}</span>
              <ItemTags item={i} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Stat({
  title,
  value,
  note,
  tone,
}: {
  title: string;
  value: string;
  note?: string;
  tone?: "good" | "bad";
}) {
  const cls =
    tone === "bad" ? "text-red-800" : tone === "good" ? "text-emerald-800" : undefined;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <dt className={label}>{title}</dt>
      <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-slate-800">
        <span className={cls}>{value}</span>
        {note && <span className="ml-1.5 text-sm font-semibold text-slate-500">{note}</span>}
      </dd>
    </div>
  );
}

function TabLink({
  current,
  value,
  year,
  month,
  count,
  children,
}: {
  current: Tab;
  value: Tab;
  year: number;
  month: number;
  count?: number;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <Link
      href={`/platby?zalozka=${value}&rok=${year}&mesic=${month}`}
      className={`inline-flex items-center gap-2 rounded-full border-2 px-5 py-2 font-heading text-sm font-semibold transition ${
        active
          ? "border-club bg-club text-onclub"
          : "border-slate-300 text-slate-600 hover:border-club hover:bg-club-soft"
      }`}
    >
      {children}
      {count != null && count > 0 && (
        <span className="rounded-full bg-slate-900/20 px-2 text-xs tabular-nums">
          {count}
        </span>
      )}
    </Link>
  );
}

function MonthLink({
  year,
  month,
  label: text,
}: {
  year: number;
  month: number;
  label: string;
}) {
  return (
    <Link
      href={`/platby?zalozka=mesicni&rok=${year}&mesic=${month}`}
      className="grid h-9 w-9 place-items-center rounded-full border-2 border-slate-300 text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900"
      aria-label={text === "←" ? "Předchozí měsíc" : "Další měsíc"}
    >
      {text}
    </Link>
  );
}

function Badge({ tone, children }: { tone: "ok" | "due"; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider ${
        tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
      }`}
    >
      {children}
    </span>
  );
}

function Empty({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
      <p className="font-heading font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-sm italic text-slate-500">{note}</p>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,6,23,.85)] p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="presentation"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-club-line bg-[rgba(2,6,23,.97)] shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b-2 border-club px-6 py-5">
          <div className="min-w-0">
            <h2 className="font-heading text-xl font-extrabold uppercase tracking-wide text-slate-800">
              {title}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            aria-label="Zavřít"
          >
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
