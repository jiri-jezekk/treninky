import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import { isRegistrationOpen } from "@/lib/site-config";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; reg?: string; session?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/prehled");
  const sp = await searchParams;
  const justRegistered = sp.registered === "1";
  const regClosed = sp.reg === "closed";
  const sessionStale = sp.session === "stale";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800">Přihlášení</h1>
        <p className="mt-1 text-sm text-slate-600">
          Zadejte e-mail a heslo k vašemu účtu.
        </p>
        {justRegistered && (
          <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Účet byl vytvořen. Nyní se můžete přihlásit.
          </p>
        )}
        {regClosed && (
          <p className="mt-3 rounded-md border border-amber-100 bg-amber-50/80 px-3 py-2 text-sm text-amber-900">
            Registrace nových účtů je vypnutá. Použijte své přihlašovací údaje.
          </p>
        )}
        {sessionStale && (
          <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Relace už neplatí (např. po přepnutí na jinou databázi). Přihlaste se znovu.
          </p>
        )}
        <div className="mt-6">
          <Suspense fallback={<p className="text-sm text-slate-500">Načítám…</p>}>
            <LoginForm />
          </Suspense>
        </div>
        {isRegistrationOpen() && (
          <p className="mt-6 text-center text-sm text-slate-600">
            Nemáte účet?{" "}
            <Link
              href="/registrace"
              className="text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
            >
              Registrace
            </Link>
          </p>
        )}
        <p className="mt-4 text-center">
          <Link href="/" className="text-sm text-slate-500 hover:underline">
            ← Zpět na úvod
          </Link>
        </p>
      </div>
    </div>
  );
}
