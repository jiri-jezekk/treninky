import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { updateSettings } from "@/actions/settings";

export default async function NastaveniPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      defaultTrainingPriceCents: true,
      bankIban: true,
      bankMessagePrefix: true,
    },
  });

  const defaultPrice =
    user.defaultTrainingPriceCents != null
      ? String(user.defaultTrainingPriceCents / 100)
      : "";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Nastavení účtu</h1>
        <p className="mt-1 text-slate-600">
          Výchozí ceny a údaje pro QR platby (český účet – formát SPAYD).
        </p>
      </div>

      <form
        action={updateSettings}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <label className="block text-sm font-medium text-slate-700">
          Výchozí cena tréninku (Kč)
          <input
            name="defaultPrice"
            defaultValue={defaultPrice}
            placeholder="např. 100"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Použije se, když u tréninku není nastavena vlastní cena.
          </span>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          IBAN příjemce (QR platby)
          <input
            name="bankIban"
            defaultValue={user.bankIban ?? ""}
            placeholder="CZ65 0800 0000 1920 0014 5399"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-slate-900"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Předpona zprávy u tréninků
          <input
            name="bankMessagePrefix"
            defaultValue={user.bankMessagePrefix ?? ""}
            placeholder="Trénink"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Do zprávy pro příjemce se doplní datum a jméno hráče.
          </span>
        </label>

        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Uložit
        </button>
      </form>
    </div>
  );
}
