"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";

/**
 * Tlačítko pro akci, která může selhat.
 *
 * Server action, která vyhodí výjimku, skončí na produkci obecnou
 * stránkou „A server error occurred“ — uživatel vidí bílou obrazovku
 * a nedozví se nic. Přesně tak vypadalo vyhodnocení zápasu, když
 * spadlo. Akce proto vrací výsledek místo výjimky a tohle tlačítko
 * ho ukáže hned pod sebou.
 *
 * `useActionState` navíc dává `pending`, takže dvojklik nespustí
 * vyhodnocení dvakrát.
 */
export function ActionButton({
  action,
  label,
  pendingLabel,
  className,
  confirm,
}: {
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel?: string;
  className: string;
  /** Text potvrzení, když je krok nevratný nebo hne ratingem. */
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null>(
    async () => action(),
    null,
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <button type="submit" className={className} disabled={pending}>
        {pending ? (pendingLabel ?? "Pracuji…") : label}
      </button>
      {state && !state.ok && (
        <p
          role="alert"
          className="mt-2 max-w-xs rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-800"
        >
          {state.error}
        </p>
      )}
      {state && state.ok && state.message && (
        <p className="mt-2 max-w-xs rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
          {state.message}
        </p>
      )}
    </form>
  );
}
