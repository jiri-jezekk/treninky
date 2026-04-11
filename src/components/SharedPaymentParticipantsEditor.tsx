"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SharedPaymentQrPanel } from "@/components/SharedPaymentQrPanel";
import { toggleParticipantPaid, updateSharedPaymentAmounts } from "@/actions/shared-payments";
import {
  ceilCentsToWholeKoruny,
  formatCzkFromCents,
  formatKcInputFromCents,
  parseCzkToCentsCeilWholeKoruny,
} from "@/lib/money";
import { sortParticipantsForDisplay } from "@/lib/shared-payment-display";
import {
  PAYMENT_MARK_PAID_BUTTON_CLASS,
  PAYMENT_MARK_UNDO_BUTTON_CLASS,
} from "@/components/payment-mark-styles";

export type ParticipantRow = {
  id: string;
  amountCents: number;
  paidAt: Date | null;
  player: { name: string };
};

type Props = {
  sharedPaymentId: string;
  iban: string | null;
  title: string;
  participants: ParticipantRow[];
  /** Např. formulář „Rozdělit rovnoměrně“. */
  belowList?: ReactNode;
};

const DEBOUNCE_MS = 550;

export function SharedPaymentParticipantsEditor({
  sharedPaymentId,
  iban,
  title,
  participants,
  belowList,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const sorted = useMemo(() => sortParticipantsForDisplay(participants), [participants]);

  const serverSig = participants.map((p) => `${p.id}:${p.amountCents}`).join("|");
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(participants.map((p) => [p.id, formatKcInputFromCents(p.amountCents)])),
  );

  useEffect(() => {
    setAmounts(
      Object.fromEntries(participants.map((p) => [p.id, formatKcInputFromCents(p.amountCents)])),
    );
  }, [serverSig]);

  const amountsRef = useRef(amounts);
  amountsRef.current = amounts;

  const participantsRef = useRef(participants);
  participantsRef.current = participants;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistAll = useCallback(async () => {
    const fd = new FormData();
    fd.append("sharedPaymentId", sharedPaymentId);
    for (const p of participantsRef.current) {
      fd.append(`amount_${p.id}`, amountsRef.current[p.id] ?? "");
    }
    await updateSharedPaymentAmounts(fd);
    startTransition(() => {
      router.refresh();
    });
  }, [sharedPaymentId, router]);

  const schedulePersist = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void persistAll();
    }, DEBOUNCE_MS);
  }, [persistAll]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const centsForQr = (participantId: string, fallbackCents: number) => {
    const raw = (amounts[participantId] ?? "").trim().replace(",", ".");
    const c = parseCzkToCentsCeilWholeKoruny(raw);
    if (c !== null && c >= 0) return c;
    return ceilCentsToWholeKoruny(fallbackCents);
  };

  const unpaid = useMemo(() => sorted.filter((p) => p.paidAt == null), [sorted]);
  const paid = useMemo(() => sorted.filter((p) => p.paidAt != null), [sorted]);

  return (
    <div>
      {unpaid.length === 0 && paid.length > 0 && (
        <p className="mb-4 text-sm text-slate-600">
          Všichni účastníci jsou označeni jako zaplacení (viz níže).
        </p>
      )}

      {unpaid.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200/90">
          <p className="border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-xs font-medium text-slate-600 sm:px-4">
            K úhradě
          </p>
          <ul className="divide-y divide-slate-100">
            {unpaid.map((part) => (
              <li
                key={part.id}
                className="flex flex-col gap-3 px-3 py-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:px-4"
              >
                <div className="min-w-0 flex-1 space-y-3">
                  <span className="break-words font-medium text-slate-800">{part.player.name}</span>
                  <label className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    Částka (Kč)
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amounts[part.id] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAmounts((prev) => ({ ...prev, [part.id]: v }));
                        schedulePersist();
                      }}
                      className="w-28 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-slate-900 tabular-nums"
                      aria-label={`Částka pro ${part.player.name}`}
                    />
                  </label>
                </div>
                <div className="flex min-w-0 w-full flex-wrap items-center gap-3 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] sm:w-auto sm:justify-end">
                  <SharedPaymentQrPanel
                    iban={iban}
                    title={title}
                    playerName={part.player.name}
                    amountCents={centsForQr(part.id, part.amountCents)}
                  />
                  <form action={toggleParticipantPaid.bind(null, part.id, true)}>
                    <button type="submit" className={PAYMENT_MARK_PAID_BUTTON_CLASS}>
                      Zaplaceno
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {paid.length > 0 && (
        <div
          className={`overflow-hidden rounded-lg border border-slate-200/90 ${unpaid.length > 0 ? "mt-6" : ""}`}
        >
          <p className="border-b border-slate-100 bg-emerald-50/60 px-4 py-2 text-xs font-medium text-emerald-900">
            Zaplaceno
          </p>
          <div className="touch-pan-x overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Účastník</th>
                  <th className="px-4 py-3 font-medium">Částka</th>
                  <th className="px-4 py-3 font-medium">Platba</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paid.map((part) => (
                  <tr key={part.id} className="bg-slate-50/40 text-slate-600">
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {part.player.name}
                      <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-normal text-emerald-800">
                        zaplaceno
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatCzkFromCents(part.amountCents)}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <form action={toggleParticipantPaid.bind(null, part.id, false)}>
                        <button type="submit" className={PAYMENT_MARK_UNDO_BUTTON_CLASS}>
                          Zrušit označení
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

      {belowList != null && <div className="mt-6 border-t border-slate-100 pt-4">{belowList}</div>}

      <p className="mt-4 text-xs text-slate-500">
        Úpravy částek se po krátké pauze uloží samy; QR u hráče v sekci „K úhradě“ reaguje hned při psaní.
      </p>
    </div>
  );
}
