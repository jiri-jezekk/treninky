"use client";

import { QRCodeSVG } from "qrcode.react";
import { buildSpaydString } from "@/lib/spayd";
import { formatCzkFromCents } from "@/lib/money";

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
  if (!iban) {
    return (
      <span className="text-xs text-amber-700">
        Doplňte IBAN v nastavení.
      </span>
    );
  }
  if (amountCents <= 0) return null;

  let spayd: string;
  try {
    spayd = buildSpaydString({
      iban,
      amountKc: amountCents / 100,
      message: `${title} — ${playerName}`.slice(0, 60),
    });
  } catch {
    return <span className="text-xs text-red-600">Neplatný IBAN</span>;
  }

  return (
    <div className="flex flex-col items-center">
      <QRCodeSVG value={spayd} size={120} level="M" />
      <span className="mt-1 text-xs text-slate-500">{formatCzkFromCents(amountCents)}</span>
    </div>
  );
}
