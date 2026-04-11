import Link from "next/link";
import { auth } from "@/auth";
import { isRegistrationOpen } from "@/lib/site-config";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (session) redirect("/prehled");

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 px-4">
      <div className="w-full max-w-lg min-w-0 rounded-lg border border-slate-200 bg-white px-5 py-8 text-center shadow-sm sm:px-8 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-800">
          Docházka na tréninky
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Evidence účasti, plateb a skupinových výdajů. Přihlaste se pro přístup ke
          svým datům.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/prihlaseni"
            className="rounded-md border border-slate-300 bg-slate-50 px-4 py-2 text-sm text-slate-800 hover:bg-slate-100"
          >
            Přihlásit se
          </Link>
          {isRegistrationOpen() && (
            <Link
              href="/registrace"
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Vytvořit účet
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
