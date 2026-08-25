"use client";

import { QRCodeCanvas } from "qrcode.react";
import { buildSpaydString } from "@/lib/spayd";

/**
 * QR platba pro jednu položku. Variabilní symbol jde přímo do SPAYD,
 * takže platba půjde ve výpisu spárovat i bez čtení poznámky.
 */
export function PortalQr({
  iban,
  amountCents,
  message,
  variableSymbol,
  size = 132,
}: {
  iban: string | null;
  amountCents: number;
  message: string;
  variableSymbol: string;
  size?: number;
}) {
  if (!iban) {
    return (
      <p className="text-xs italic text-slate-500">
        Trenér zatím nedoplnil číslo účtu.
      </p>
    );
  }

  let spayd = "";
  try {
    spayd = buildSpaydString({
      iban,
      amountKc: amountCents / 100,
      message,
      variableSymbol,
    });
  } catch {
    return (
      <p className="text-xs italic text-slate-500">QR se nepodařilo vytvořit.</p>
    );
  }

  return (
    <div className="rounded-xl bg-white p-2" style={{ backgroundColor: "#fff" }}>
      <QRCodeCanvas value={spayd} size={size} level="M" marginSize={2} />
    </div>
  );
}
