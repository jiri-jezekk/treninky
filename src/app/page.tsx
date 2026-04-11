import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (session) redirect("/prehled");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-50 px-4">
      <div className="max-w-lg text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Docházka na tréninky
        </h1>
        <p className="mt-3 text-slate-600">
          Evidence účasti, plateb a skupinových výdajů. Přihlaste se pro přístup ke
          svým datům.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/prihlaseni"
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700"
        >
          Přihlásit se
        </Link>
        <Link
          href="/registrace"
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Vytvořit účet
        </Link>
      </div>
    </div>
  );
}
