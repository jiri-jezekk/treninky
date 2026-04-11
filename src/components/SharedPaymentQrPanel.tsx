"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { CopyQrImageButton } from "@/components/CopyQrImageButton";
import { buildSpaydString } from "@/lib/spayd";
import { ceilCentsToWholeKoruny, formatCzkFromCents } from "@/lib/money";

export function SharedPaymentQrPanel({
  iban,
  title,
  playerName,
  amountCents,
}: {
  iban: string | null;
  title: string;
  playerName: string;
  amountCents: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (!iban) {
    return (
      <span className="text-xs text-slate-500">Doplňte IBAN v nastavení.</span>
    );
  }
  if (amountCents <= 0) return null;

  const payCents = ceilCentsToWholeKoruny(amountCents);

  let spayd: string;
  try {
    spayd = buildSpaydString({
      iban,
      amountKc: payCents / 100,
      message: `${title} - ${playerName}`.slice(0, 60),
    });
  } catch {
    return <span className="text-xs text-red-600">Neplatný IBAN</span>;
  }

  return (
    <div className="flex min-w-0 shrink-0 items-start gap-1">
      <div className="flex flex-col items-center">
        <QRCodeCanvas
          ref={canvasRef}
          value={spayd}
          size={120}
          level="M"
          marginSize={2}
        />
        <span className="mt-1 text-xs text-slate-500">{formatCzkFromCents(payCents)}</span>
      </div>
      <CopyQrImageButton canvasRef={canvasRef} size="md" />
    </div>
  );
}
