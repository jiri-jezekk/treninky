import Link from "next/link";
import { createSinglePayment } from "@/actions/shared-payments";
import { INCOME_KINDS } from "@/lib/accounting";
import { INCOME_KIND_LABELS } from "@/lib/player-balance";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
const field =
  "mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-club";

export default async function PlatbaHraciPage({
  searchParams,
}: {
  searchParams: Promise<{ hrac?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;

  const players = await prisma.player.findMany({
    where: { userId, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, number: true },
  });
  const preselected = players.some((p) => p.id === sp.hrac) ? sp.hrac : "";

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <Link
        href="/platby?zalozka=akce"
        className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800"
      >
        ← Zpět na Platby
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="font-heading text-3xl font-extrabold uppercase tracking-wide text-slate-800">
          Platba hráči
        </h1>
        <div className="mt-3 h-1 w-14 rounded bg-club" />
        <p className="mt-3 max-w-prose text-sm text-slate-600">
          Jedna platba jednomu hráči — registrace, startovné, licence. Objeví se mu
          v odkazu s QR kódem a mezi dlužníky, dokud ji neoznačíš jako zaplacenou.
        </p>
      </div>

      <form
        action={createSinglePayment}
        className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6"
      >
        <label className="block">
          <span className={label}>Hráč</span>
          <select
            name="playerId"
            required
            defaultValue={preselected}
            className={field}
          >
            <option value="" disabled>
              Vyberte hráče…
            </option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (č. {p.number})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={label}>Za co</span>
          <input
            name="title"
            required
            maxLength={120}
            placeholder="Např. Registrace 2026/27"
            className={field}
          />
        </label>

        <label className="block">
          <span className={label}>Poznámka (nepovinné)</span>
          <textarea
            name="description"
            rows={2}
            maxLength={500}
            placeholder="Startovné Turnaj Praha"
            className={`${field} resize-y`}
          />
        </label>

        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Částka</span>
            <input
              name="amountKc"
              required
              inputMode="decimal"
              placeholder="500"
              className={field}
            />
            <span className="mt-1.5 block text-xs italic text-slate-500">
              V korunách, zaokrouhlí se nahoru na celé koruny.
            </span>
          </label>

          <label className="block">
            <span className={label}>Účetní druh příjmu</span>
            <select name="incomeKind" defaultValue="EVENT" className={field}>
              {INCOME_KINDS.map((k) => (
                <option key={k} value={k}>
                  {INCOME_KIND_LABELS[k]}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-xs italic text-slate-500">
              Rozhoduje o zařazení v sestavě pro účetní.
            </span>
          </label>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
          <Link
            href="/platby?zalozka=akce"
            className="inline-flex items-center rounded-full border-2 border-slate-300 px-4 py-2 font-heading text-sm font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft"
          >
            Zrušit
          </Link>
          <button
            type="submit"
            className="inline-flex items-center rounded-full border-2 border-club bg-club px-4 py-2 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover"
          >
            Přidat platbu
          </button>
        </div>
      </form>
    </div>
  );
}
