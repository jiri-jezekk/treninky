import Link from "next/link";
import { auth } from "@/auth";
import { isRegistrationOpen } from "@/lib/site-config";
import { redirect } from "next/navigation";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const session = await auth();
  if (session) redirect("/prehled");
  if (!isRegistrationOpen()) {
    redirect("/prihlaseni?reg=closed");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm min-w-0 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-semibold text-slate-800">Nový účet</h1>
        <p className="mt-1 text-sm text-slate-600">
          Zvolte e-mail a heslo (min. 8 znaků). Data jsou vázaná na tento účet.
        </p>
        <div className="mt-6">
          <RegisterForm />
        </div>
        <p className="mt-6 text-center text-sm text-slate-600">
          Už máte účet?{" "}
          <Link
            href="/prihlaseni"
            className="text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
          >
            Přihlásit se
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
