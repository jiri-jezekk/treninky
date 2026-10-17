"use client";

import Link from "next/link";
import { useState } from "react";
import { saveReflection } from "@/actions/training-plan";

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";

/** Poznámka po tréninku — co fungovalo, co ne. */
export function PlanReflection({
  planId,
  reflection,
}: {
  planId: string;
  reflection: string | null;
}) {
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={saveReflection.bind(null, planId)}
      onSubmit={() => setSaved(true)}
      className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
    >
      <label className="block">
        <span className={label}>Poznámka po tréninku</span>
        <textarea
          name="reflection"
          rows={3}
          defaultValue={reflection ?? ""}
          onChange={() => setSaved(false)}
          placeholder="Co fungovalo, co ne, na co navázat příště…"
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base text-slate-900 outline-none focus:border-club sm:text-sm"
        />
      </label>
      <p className="mt-1 text-xs text-slate-500">
        Ukáže se u dalšího plánu stejné kategorie.
      </p>
      <button
        type="submit"
        className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-full border-2 border-slate-300 px-4 py-2 font-heading text-sm font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft sm:w-auto"
      >
        {saved ? "Uloženo ✓" : "Uložit poznámku"}
      </button>
    </form>
  );
}

/** Poznámka z minulého tréninku stejné kategorie — při plánování dalšího. */
export function PreviousReflection({
  href,
  dateLabel,
  text,
}: {
  href: string;
  dateLabel: string;
  text: string;
}) {
  return (
    <aside className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-heading text-[11px] font-bold uppercase tracking-[0.15em]">
        Poznámka z minula ·{" "}
        <Link href={href} className="underline underline-offset-4">
          {dateLabel}
        </Link>
      </p>
      <p className="mt-1 whitespace-pre-line break-words">{text}</p>
    </aside>
  );
}
