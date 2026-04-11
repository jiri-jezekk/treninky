"use client";

import { QRCodeCanvas } from "qrcode.react";
import { useCallback, useRef, useState } from "react";
import { buildSpaydString } from "@/lib/spayd";
import { buildMonthlyPaymentMessage } from "@/lib/training-pricing";
import { formatCzkFromCents } from "@/lib/money";

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("toBlob failed"));
    }, "image/png");
  });
}

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
  const [copyState, setCopyState] = useState<"idle" | "ok" | "err">("idle");

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

  const copyQrImage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || totalCents <= 0) return;
    setCopyState("idle");
    try {
      const blob = await canvasToPngBlob(canvas);
      if (!navigator.clipboard?.write) {
        throw new Error("clipboard");
      }
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopyState("ok");
      window.setTimeout(() => setCopyState("idle"), 2500);
    } catch {
      setCopyState("err");
      window.setTimeout(() => setCopyState("idle"), 4000);
    }
  }, [totalCents]);

  if (!iban) {
    return (
      <p className="text-xs text-slate-500">Doplňte IBAN v nastavení.</p>
    );
  }

  if (totalCents <= 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
      <div className="rounded border border-slate-200 bg-white p-2">
        <QRCodeCanvas
          ref={canvasRef}
          value={spayd}
          size={140}
          level="M"
          marginSize={2}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-slate-500">{formatCzkFromCents(totalCents)}</span>
        <button
          type="button"
          onClick={() => void copyQrImage()}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
        >
          Zkopírovat QR (obrázek)
        </button>
        {copyState === "ok" && (
          <span className="text-xs text-emerald-600">Zkopírováno — vložte Ctrl+V</span>
        )}
        {copyState === "err" && (
          <span className="text-xs text-amber-700">
            Kopírování nejde v tomto prohlížeči. Zkuste Chrome nebo Edge.
          </span>
        )}
      </div>
    </div>
  );
}
