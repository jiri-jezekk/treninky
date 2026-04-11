import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/prehled");
  const sp = await searchParams;
  const justRegistered = sp.registered === "1";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Přihlášení</h1>
        <p className="mt-1 text-sm text-slate-600">
          Zadejte e-mail a heslo k vašemu účtu.
        </p>
        {justRegistered && (
          <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Účet byl vytvořen. Nyní se můžete přihlásit.
          </p>
        )}
        <div className="mt-6">
          <Suspense fallback={<p className="text-sm text-slate-500">Načítám…</p>}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm text-slate-600">
          Nemáte účet?{" "}
          <Link href="/registrace" className="font-medium text-emerald-700 hover:underline">
            Registrace
          </Link>
        </p>
        <p className="mt-4 text-center">
          <Link href="/" className="text-sm text-slate-500 hover:underline">
            ← Zpět na úvod
          </Link>
        </p>
      </div>
    </div>
  );
}
