import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const session = await auth();
  if (session) redirect("/prehled");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Nový účet</h1>
        <p className="mt-1 text-sm text-slate-600">
          Zvolte e-mail a heslo (min. 8 znaků). Data jsou vázaná na tento účet.
        </p>
        <div className="mt-6">
          <RegisterForm />
        </div>
        <p className="mt-6 text-center text-sm text-slate-600">
          Už máte účet?{" "}
          <Link href="/prihlaseni" className="font-medium text-emerald-700 hover:underline">
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
