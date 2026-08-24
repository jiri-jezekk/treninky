"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword, type PasswordActionState } from "@/actions/settings";

const inputClass =
  "mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    changePassword,
    {} as PasswordActionState,
  );

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-md border border-red-100 bg-red-50/80 px-3 py-2 text-sm text-red-900">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-md border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-900">
          Heslo bylo změněno.
        </p>
      )}

      <label className="block text-sm text-slate-600">
        Stávající heslo
        <input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </label>

      <label className="block text-sm text-slate-600">
        Nové heslo (min. 8 znaků)
        <input
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>

      <label className="block text-sm text-slate-600">
        Nové heslo znovu
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 hover:bg-slate-100 disabled:opacity-60"
      >
        {pending ? "Měním heslo…" : "Změnit heslo"}
      </button>
    </form>
  );
}
