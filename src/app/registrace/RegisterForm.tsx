"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { registerAction, type AuthActionState } from "@/actions/auth";

export function RegisterForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    registerAction,
    {} as AuthActionState,
  );

  useEffect(() => {
    if (state.ok) {
      router.push("/prihlaseni?registered=1");
    }
  }, [state.ok, router]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      )}
      <label className="block text-sm font-medium text-slate-700">
        E-mail
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Heslo (min. 8 znaků)
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Vytvářím účet…" : "Zaregistrovat se"}
      </button>
    </form>
  );
}
