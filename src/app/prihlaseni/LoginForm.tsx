"use client";

import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/prehled";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setPending(false);
    if (res?.error) {
      setError("Neplatné přihlašovací údaje.");
      return;
    }
    if (res?.url) {
      window.location.href = res.url;
    } else {
      window.location.href = callbackUrl;
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error && (
        <p className="rounded-md border border-red-100 bg-red-50/80 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      )}
      <label className="block text-sm font-medium text-slate-700">
        E-mail
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Heslo
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 hover:bg-slate-100 disabled:opacity-60"
      >
        {pending ? "Přihlašuji…" : "Přihlásit se"}
      </button>
    </form>
  );
}
