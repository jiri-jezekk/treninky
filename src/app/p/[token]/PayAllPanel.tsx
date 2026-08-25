"use client";

import { useState } from "react";
import { ensurePaymentBatch } from "@/actions/payment-batch";
import { PortalQr } from "./PortalQr";
import { formatCzkFromCents } from "@/lib/money";

/**
 * Jedna platba za všechno. Nabízí se až od dvou položek — u jediné
 * by to bylo jen matoucí druhé QR na tutéž částku.
 */
export function PayAllPanel({
  payToken,
  iban,
  playerName,
  totalCents,
  itemCount,
}: {
  payToken: string;
  iban: string | null;
  playerName: string;
  totalCents: number;
  itemCount: number;
}) {
  const [state, setState] = useState<
    { status: "idle" } | { status: "loading" } | { status: "ready"; vs: string } | { status: "error"; message: string }
  >({ status: "idle" });

  if (itemCount < 2) return null;

  async function prepare() {
    setState({ status: "loading" });
    const res = await ensurePaymentBatch(payToken);
    setState(
      res.ok
        ? { status: "ready", vs: res.variableSymbol }
        : { status: "error", message: res.error },
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-club-line bg-club-soft p-5">
      <h2 className="font-heading text-base font-bold text-slate-800">
        Zaplatit vše najednou
      </h2>
      <p className="mt-1 text-xs text-slate-600">
        Jedna platba za všech {itemCount} položek — {formatCzkFromCents(totalCents)}.
      </p>

      {state.status === "ready" ? (
        <div className="mt-4 flex flex-col items-center gap-3">
          <PortalQr
            iban={iban}
            amountCents={totalCents}
            message={`Platby - ${playerName}`}
            variableSymbol={state.vs}
            size={148}
          />
          <p className="text-center text-xs tabular-nums text-slate-600">
            Variabilní symbol <b className="text-slate-800">{state.vs}</b>
          </p>
          <p className="text-center text-xs italic text-slate-500">
            Trenér u tohoto symbolu vidí, co všechno pokrývá.
          </p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void prepare()}
            disabled={state.status === "loading"}
            className="mt-4 w-full rounded-full border-2 border-club bg-club px-4 py-2.5 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover disabled:opacity-60"
          >
            {state.status === "loading"
              ? "Připravuji…"
              : `Vytvořit jedno QR na ${formatCzkFromCents(totalCents)}`}
          </button>
          {state.status === "error" && (
            <p className="mt-3 text-center text-xs text-red-900">{state.message}</p>
          )}
        </>
      )}
    </div>
  );
}
