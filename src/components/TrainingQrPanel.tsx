"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { buildSpaydString } from "@/lib/spayd";
import { formatCzkFromCents } from "@/lib/money";

export type QrLine = {
  playerId: string;
  playerName: string;
  amountCents: number;
  message: string;
};

export function TrainingQrPanel({
  iban,
  lines,
}: {
  iban: string | null;
  lines: QrLine[];
}) {
  const payable = useMemo(
    () => lines.filter((l) => l.amountCents > 0),
    [lines],
  );
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const l of payable) init[l.playerId] = true;
    return init;
  });

  if (!iban) {
    return (
      <p className="text-sm text-amber-800">
        Vyplňte IBAN v{" "}
        <a href="/nastaveni" className="font-medium underline">
          Nastavení
        </a>{" "}
        pro generování QR plateb.
      </p>
    );
  }

  if (payable.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Žádní hráči s platbou k úhradě (předplaceno nebo 0 Kč).
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Zaškrtněte hráče, pro které chcete zobrazit QR platbu (stejný účet, jiná
        částka / zpráva).
      </p>
      <ul className="flex flex-col gap-2">
        {payable.map((l) => (
          <li key={l.playerId} className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={selected[l.playerId] ?? false}
              onChange={(e) =>
                setSelected((s) => ({ ...s, [l.playerId]: e.target.checked }))
              }
            />
            <span className="font-medium text-slate-800">{l.playerName}</span>
            <span className="text-slate-600">{formatCzkFromCents(l.amountCents)}</span>
          </li>
        ))}
      </ul>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {payable
          .filter((l) => selected[l.playerId])
          .map((l) => {
            let spayd: string;
            try {
              spayd = buildSpaydString({
                iban,
                amountKc: l.amountCents / 100,
                message: l.message.slice(0, 60),
              });
            } catch {
              return (
                <div key={l.playerId} className="text-sm text-red-700">
                  Chybný IBAN pro {l.playerName}
                </div>
              );
            }
            return (
              <div
                key={l.playerId}
                className="flex flex-col items-center rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="text-center text-sm font-medium text-slate-800">
                  {l.playerName}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {formatCzkFromCents(l.amountCents)}
                </div>
                <div className="mt-3 bg-white p-2">
                  <QRCodeSVG value={spayd} size={160} level="M" />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
