"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { CopyQrImageButton } from "@/components/CopyQrImageButton";
import {
  ceilCentsToWholeKoruny,
  formatCzkFromCents,
  formatKcInputFromCents,
  parseCzkToCentsCeilWholeKoruny,
} from "@/lib/money";
import { buildSpaydString } from "@/lib/spayd";

/**
 * Jedno QR pro hromadné sdílení — v poznámce jen název platby (bez jména hráče).
 */
export function SharedPaymentUniversalQrPanel({
  iban,
  title,
  defaultAmountCents,
}: {
  iban: string | null;
  title: string;
  defaultAmountCents: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [amountInput, setAmountInput] = useState(() =>
    formatKcInputFromCents(ceilCentsToWholeKoruny(defaultAmountCents)),
  );

  useEffect(() => {
    setAmountInput(formatKcInputFromCents(ceilCentsToWholeKoruny(defaultAmountCents)));
  }, [defaultAmountCents]);

  const amountCents = useMemo(() => {
    const c = parseCzkToCentsCeilWholeKoruny(amountInput.replace(",", ".").trim());
    return c !== null && c >= 0 ? c : 0;
  }, [amountInput]);

  const payCents = ceilCentsToWholeKoruny(amountCents);

  const spayd = useMemo(() => {
    if (!iban || payCents <= 0) return "";
    try {
      const msg = title.trim().slice(0, 60);
      return buildSpaydString({
        iban,
        amountKc: payCents / 100,
        message: msg || undefined,
      });
    } catch {
      return "";
    }
  }, [iban, payCents, title]);

  if (!iban) {
    return (
      <p className="text-sm text-slate-500">Doplňte IBAN v nastavení — bez něj QR nelze vygenerovat.</p>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
      <div className="flex items-start justify-center gap-1 sm:justify-start">
        <div className="flex flex-col items-center">
          {spayd ? (
            <>
              <QRCodeCanvas
                ref={canvasRef}
                value={spayd}
                size={160}
                level="M"
                marginSize={2}
              />
              <span className="mt-2 text-xs text-slate-500">{formatCzkFromCents(payCents)}</span>
            </>
          ) : (
            <span className="text-sm text-slate-500">Zadejte kladnou částku.</span>
          )}
        </div>
        {spayd ? <CopyQrImageButton canvasRef={canvasRef} size="md" /> : null}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <label className="block text-sm text-slate-600">
          Částka pro QR (Kč)
          <input
            type="text"
            inputMode="decimal"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            className="mt-1 w-full max-w-[12rem] rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 tabular-nums sm:max-w-none"
          />
        </label>
        <p className="text-xs text-slate-500">
          V poznámce platby je jen název („{title.slice(0, 40)}
          {title.length > 40 ? "…" : ""}“). Částka se pro platbu bere nahoru na celé koruny; náhled QR
          se neukládá do databáze.
        </p>
      </div>
    </div>
  );
}
