"use client";

import { QRCodeCanvas } from "qrcode.react";
import { useRef } from "react";
import { CopyQrImageButton } from "@/components/CopyQrImageButton";
import { buildSpaydString } from "@/lib/spayd";
import { buildMonthlyPaymentMessage } from "@/lib/training-pricing";

export function MonthlyPlayerQr({
  iban,
  playerName,
  totalCents,
  year,
  month,
}: {
  iban: string | null;
  playerName: string;
  totalCents: number;
  year: number;
  month: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const message = buildMonthlyPaymentMessage(playerName, year, month);

  let spayd = "";
  try {
    if (iban && totalCents > 0) {
      spayd = buildSpaydString({
        iban,
        amountKc: totalCents / 100,
        message,
      });
    }
  } catch {
    spayd = "";
  }

  if (!iban) {
    return (
      <p className="text-xs text-slate-500">Doplňte IBAN v nastavení.</p>
    );
  }

  if (totalCents <= 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <div className="flex items-center gap-1">
      <div className="rounded border border-slate-200 bg-white p-2">
        <QRCodeCanvas
          ref={canvasRef}
          value={spayd}
          size={140}
          level="M"
          marginSize={2}
        />
      </div>
      <CopyQrImageButton canvasRef={canvasRef} size="sm" />
    </div>
  );
}
