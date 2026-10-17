"use client";

import { useRef, useState } from "react";

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";

/**
 * Shrnutí plánu pro deník DDM. Text jde před kopírováním upravit;
 * úprava se neukládá — zdrojem jsou body plánu, a když se plán změní,
 * shrnutí se přepíše.
 */
export function DiarySummary({ summary }: { summary: string }) {
  const [text, setText] = useState(summary);
  const [lastSummary, setLastSummary] = useState(summary);
  const [copied, setCopied] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  if (lastSummary !== summary) {
    setLastSummary(summary);
    setText(summary);
    setCopied(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Starší prohlížeč nebo stránka bez HTTPS — označit text a zkopírovat postaru.
      areaRef.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  if (!summary) return null;

  return (
    <section
      id="denik"
      className="mb-6 scroll-mt-16 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
    >
      <h2 className={label}>Shrnutí do deníku</h2>
      <textarea
        ref={areaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCopied(false);
        }}
        rows={Math.min(10, Math.max(3, text.split("\n").length + 1))}
        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base text-slate-900 outline-none focus:border-club sm:text-sm"
        aria-label="Shrnutí do deníku"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-10 w-full items-center justify-center rounded-full border-2 border-club bg-club px-4 py-2 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover sm:w-auto"
        >
          {copied ? "Zkopírováno ✓" : "Kopírovat do deníku"}
        </button>
        {text !== summary && (
          <button
            type="button"
            onClick={() => setText(summary)}
            className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800"
          >
            Vrátit podle plánu
          </button>
        )}
      </div>
    </section>
  );
}
