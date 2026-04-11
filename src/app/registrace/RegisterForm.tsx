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
        <p className="rounded-md border border-red-100 bg-red-50/80 px-3 py-2 text-sm text-red-900">
          {state.error}
        </p>
      )}
      <label className="block text-sm text-slate-600">
        E-mail
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
        />
      </label>
      <label className="block text-sm text-slate-600">
        Heslo (min. 8 znaků)
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 hover:bg-slate-100 disabled:opacity-60"
      >
        {pending ? "Vytvářím účet…" : "Zaregistrovat se"}
      </button>
    </form>
  );
}
