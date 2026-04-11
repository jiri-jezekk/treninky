"use client";

import type { RefObject } from "react";
import { useState } from "react";
import { copyCanvasQrToClipboard } from "@/lib/copy-qr-image";

type Size = "sm" | "md";

const sizeClass: Record<Size, string> = {
  sm: "h-6 w-6",
  md: "h-7 w-7",
};

/** Zkopíruje QR jako obrázek (PNG) ze canvasu do schránky. */
export function CopyQrImageButton({
  canvasRef,
  size = "md",
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  size?: Size;
}) {
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        setErr(false);
        const ok = await copyCanvasQrToClipboard(canvasRef.current);
        if (ok) {
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } else {
          setErr(true);
          setTimeout(() => setErr(false), 3000);
        }
      }}
      className={`inline-flex ${sizeClass[size]} shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 ${err ? "border-amber-300" : ""}`}
      title={done ? "Zkopírováno" : err ? "Kopírování selhalo" : "Zkopírovat QR jako obrázek"}
      aria-label="Zkopírovat QR kód jako obrázek do schránky"
    >
      {done ? (
        <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : err ? (
        <svg className="h-3.5 w-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}
