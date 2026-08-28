import { Panel } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { updateSettings } from "@/actions/settings";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { toDateInputValue } from "@/lib/prepaid";

export default async function NastaveniPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      bankIban: true,
      playerVisibleFrom: true,
    },
  });

  return (
    <div className="mx-auto w-full min-w-0 max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Nastavení účtu</h1>
        <p className="mt-1 text-sm text-slate-600">
          IBAN pro generování QR plateb (měsíční souhrn i skupinové platby). Zpráva u
          měsíční platby je vždy ve tvaru: Tréninky - jméno, měsíc.
        </p>
      </div>

      <Panel>
        <form action={updateSettings} className="space-y-4">
          <label className="block text-sm text-slate-600">
            IBAN příjemce
            <input
              name="bankIban"
              defaultValue={user.bankIban ?? ""}
              placeholder="CZ65 0800 0000 1920 0014 5399"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-slate-900"
            />
          </label>

          <label className="block text-sm text-slate-600">
            Hráči vidí platby od
            <input
              type="date"
              name="playerVisibleFrom"
              defaultValue={
                user.playerVisibleFrom
                  ? toDateInputValue(user.playerVisibleFrom)
                  : ""
              }
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
            />
            <span className="mt-1 block text-xs italic text-slate-500">
              Starší platby — zaplacené i dlužné — hráči ve svém odkazu
              neuvidí a nedostanou se ani do souhrnné platby. Ty je máš dál
              v Platbách. Prázdné pole = hráči vidí všechno.
            </span>
          </label>

          <button
            type="submit"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
          >
            Uložit
          </button>
        </form>
      </Panel>

      <div>
        <h2 className="text-lg font-semibold text-slate-800">Změna hesla</h2>
        <p className="mt-1 text-sm text-slate-600">
          Pro potvrzení zadejte stávající heslo. Nové heslo musí mít alespoň 8 znaků.
        </p>
      </div>

      <Panel>
        <ChangePasswordForm />
      </Panel>
    </div>
  );
}
