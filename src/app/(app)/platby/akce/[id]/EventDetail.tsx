"use client";

import Link from "next/link";
import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  deleteSharedPayment,
  redistributeSharedPaymentEvenly,
  setSharedPaymentArchived,
  setSharedPaymentIncomeKind,
  toggleParticipantPaid,
  updateSharedPaymentAmounts,
} from "@/actions/shared-payments";
import { INCOME_KIND_LABELS, type IncomeKind } from "@/lib/player-balance";
import { INCOME_KINDS } from "@/lib/accounting";
import { formatCzkFromCents, formatKcInputFromCents } from "@/lib/money";
import { buildSpaydString } from "@/lib/spayd";
import { czPlural, initials } from "@/lib/czech";

type Participant = {
  id: string;
  playerName: string;
  playerNumber: number;
  payToken: string;
  amountCents: number;
  paid: boolean;
  variableSymbol: string;
};

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
const mini =
  "rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900";
const miniPay =
  "rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-800";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 border-club bg-club px-4 py-2 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover";
const btnOutline =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 border-slate-300 px-4 py-2 font-heading text-sm font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft";

export function EventDetail({
  id,
  number,
  title,
  description,
  archived,
  incomeKind,
  iban,
  clubName,
  participants,
}: {
  id: string;
  number: number;
  title: string;
  description: string | null;
  archived: boolean;
  incomeKind: IncomeKind;
  iban: string | null;
  clubName: string;
  participants: Participant[];
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const total = participants.reduce((s, p) => s + p.amountCents, 0);
  const collected = participants
    .filter((p) => p.paid)
    .reduce((s, p) => s + p.amountCents, 0);
  const paidCount = participants.filter((p) => p.paid).length;
  const unpaid = participants.filter((p) => !p.paid);
  const pct = total > 0 ? Math.round((collected / total) * 100) : 0;

  async function copy(text: string, tag: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(null), 2200);
    } catch {
      setCopied(null);
    }
  }

  function messagesForUnpaid(): string {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return unpaid
      .map((p) => {
        const first = p.playerName.split(/\s+/)[0] ?? p.playerName;
        return [
          `Ahoj ${first}, ${clubName} — ${title}: ${formatCzkFromCents(p.amountCents)}.`,
          `Zaplatit můžeš přes QR tady:`,
          `${origin}/p/${p.payToken}`,
        ].join("\n");
      })
      .join("\n\n———\n\n");
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <Link
        href="/platby?zalozka=akce"
        className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800"
      >
        ← Zpět na Platby
      </Link>

      <div className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-extrabold uppercase tracking-wide text-slate-800">
            {title}
          </h1>
          <div className="mt-3 h-1 w-14 rounded bg-club" />
          {description && (
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
              {description}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Akce č. {number} · variabilní symboly začínají{" "}
            <span className="font-heading tabular-nums">2</span>
          </p>
        </div>
        {archived && (
          <span className="rounded-full bg-slate-50 px-3 py-1 font-heading text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Archiv
          </span>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="font-heading text-2xl font-extrabold tabular-nums text-slate-800">
            {formatCzkFromCents(collected)}
            <span className="ml-2 text-sm font-semibold text-slate-500">
              z {formatCzkFromCents(total)}
            </span>
          </span>
          <span className="text-sm text-slate-500">
            {paidCount} z {participants.length} zaplatilo
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <span
            className="block h-full rounded-full bg-emerald-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <form
        action={setSharedPaymentIncomeKind.bind(null, id)}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5"
      >
        <label className="min-w-0 flex-1">
          <span className={label}>Účetní druh příjmu</span>
          <select
            name="incomeKind"
            defaultValue={incomeKind}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-club sm:max-w-xs"
          >
            {INCOME_KINDS.map((k) => (
              <option key={k} value={k}>
                {INCOME_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`${btnOutline} !py-1.5 !text-xs`}>
          Uložit
        </button>
        <p className="w-full text-xs italic text-slate-500">
          Určuje, kam částky spadnou v sestavě pro účetní. Členské příspěvky mají
          jiný daňový režim než dresy nebo startovné.
        </p>
      </form>

      <form
        action={updateSharedPaymentAmounts}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
      >
        <input type="hidden" name="sharedPaymentId" value={id} />

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 className={label}>Účastníci</h2>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={mini}>
              Uložit částky
            </button>
          </div>
        </div>

        <ul className="divide-y divide-slate-100">
          {participants.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-4 px-5 py-4 sm:flex-nowrap"
            >
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border font-heading text-[11px] font-extrabold ${
                    p.paid
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-club-line bg-club-soft text-club"
                  }`}
                >
                  {initials(p.playerName)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-slate-800">{p.playerName}</span>
                  <span className="block font-heading text-[11px] tabular-nums text-slate-500">
                    VS {p.variableSymbol}
                  </span>
                </span>
              </span>

              <label className="shrink-0">
                <span className="sr-only">Částka pro {p.playerName}</span>
                <input
                  type="text"
                  name={`amount_${p.id}`}
                  defaultValue={formatKcInputFromCents(p.amountCents)}
                  inputMode="decimal"
                  className="w-24 rounded-xl border border-slate-200 px-3 py-1.5 text-right text-sm tabular-nums text-slate-900 outline-none focus:border-club"
                />
              </label>

              {!p.paid && iban && p.amountCents > 0 && (
                <span className="shrink-0 rounded-lg bg-white p-1.5" style={{ backgroundColor: "#fff" }}>
                  <EventQr
                    iban={iban}
                    amountCents={p.amountCents}
                    message={`${title} - ${p.playerName}`}
                    variableSymbol={p.variableSymbol}
                  />
                </span>
              )}

              <span className="flex shrink-0 items-center gap-2">
                {p.paid ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    Zaplaceno
                  </span>
                ) : (
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-red-800">
                    Dluží
                  </span>
                )}
                <button
                  type="button"
                  className={p.paid ? mini : miniPay}
                  onClick={() => void toggleParticipantPaid(p.id, !p.paid)}
                >
                  {p.paid ? "Zrušit" : "Zaplaceno"}
                </button>
              </span>
            </li>
          ))}
          {participants.length === 0 && (
            <li className="px-5 py-12 text-center text-sm italic text-slate-500">
              Akce nemá žádné účastníky.
            </li>
          )}
        </ul>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action={redistributeSharedPaymentEvenly.bind(null, id)}>
          <button type="submit" className={btnOutline}>
            Rozdělit rovnoměrně
          </button>
        </form>

        <button
          type="button"
          className={btnPrimary}
          disabled={unpaid.length === 0}
          onClick={() => void copy(messagesForUnpaid(), "vyzvy")}
        >
          {copied === "vyzvy"
            ? "Zkopírováno"
            : unpaid.length === 0
              ? "Všichni zaplatili"
              : `Výzvy pro ${unpaid.length} ${czPlural(unpaid.length, "hráče", "hráče", "hráčů")}`}
        </button>

        <form action={setSharedPaymentArchived.bind(null, id, !archived)}>
          <button type="submit" className={btnOutline}>
            {archived ? "Vyjmout z archivu" : "Archivovat"}
          </button>
        </form>

        <form action={deleteSharedPayment.bind(null, id)} className="ml-auto">
          <button
            type="submit"
            className="inline-flex items-center rounded-full border-2 border-red-200 px-4 py-2 font-heading text-sm font-semibold text-red-800 transition hover:border-red-600 hover:bg-red-50"
          >
            Smazat akci
          </button>
        </form>
      </div>
    </div>
  );
}

function EventQr({
  iban,
  amountCents,
  message,
  variableSymbol,
}: {
  iban: string;
  amountCents: number;
  message: string;
  variableSymbol: string;
}) {
  let spayd = "";
  try {
    spayd = buildSpaydString({
      iban,
      amountKc: amountCents / 100,
      message,
      variableSymbol,
    });
  } catch {
    return null;
  }
  return <QRCodeCanvas value={spayd} size={72} level="M" marginSize={2} />;
}
