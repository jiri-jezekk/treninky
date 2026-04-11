import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { formatCzkFromCents } from "@/lib/money";
import { createSharedPayment } from "@/actions/shared-payments";

export default async function SkupinovePlatbyPage() {
  const userId = await requireUserId();

  const [players, payments] = await Promise.all([
    prisma.player.findMany({
      where: { userId, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.sharedPayment.findMany({
      where: { userId, archived: false },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const archived = await prisma.sharedPayment.findMany({
    where: { userId, archived: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Skupinové platby</h1>
        <p className="mt-1 text-slate-600">
          Ubytování, zápasy a další společné výdaje — rozdělení částky a QR pro
          každého hráče.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Nová platba</h2>
        <form action={createSharedPayment} className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Název / událost
            <input
              name="title"
              required
              placeholder="např. Ubytování Olomouc"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Popis (volitelné)
            <textarea
              name="description"
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Celková částka (Kč)
            <input
              name="totalKc"
              required
              placeholder="např. 4500"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            />
          </label>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">
              Kdo se podílí
            </legend>
            <div className="mt-2 flex max-h-48 flex-col gap-2 overflow-y-auto rounded-md border border-slate-200 p-3">
              {players.length === 0 && (
                <p className="text-sm text-slate-500">Nejdřív přidejte hráče.</p>
              )}
              {players.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="playerIds" value={p.id} />
                  {p.name}
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Vytvořit a rozdělit částku
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Aktivní</h2>
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {payments.length === 0 && (
            <li className="px-4 py-8 text-center text-slate-500">Žádné záznamy.</li>
          )}
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <div className="font-medium text-slate-900">{p.title}</div>
                <div className="text-sm text-slate-600">
                  Celkem {formatCzkFromCents(p.totalAmountCents)}
                </div>
              </div>
              <Link
                href={`/skupinove-platby/${p.id}`}
                className="text-sm font-medium text-emerald-700 hover:underline"
              >
                Detail
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Archiv (uhrazeno)</h2>
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
          {archived.length === 0 && (
            <li className="px-4 py-6 text-center text-slate-500">Prázdné.</li>
          )}
          {archived.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <div className="font-medium text-slate-800">{p.title}</div>
                <div className="text-sm text-slate-600">
                  {formatCzkFromCents(p.totalAmountCents)}
                </div>
              </div>
              <Link
                href={`/skupinove-platby/${p.id}`}
                className="text-sm text-emerald-800 hover:underline"
              >
                Otevřít
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
