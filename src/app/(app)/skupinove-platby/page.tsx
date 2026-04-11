import Link from "next/link";
import { GroupFilterNav } from "@/components/GroupFilterNav";
import { Panel } from "@/components/ui";
import { formatCzkFromCents } from "@/lib/money";
import { parsePlayerGroupFilter } from "@/lib/player-groups";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { createSharedPayment } from "@/actions/shared-payments";

export default async function SkupinovePlatbyPage({
  searchParams,
}: {
  searchParams: Promise<{ skupina?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const skupina = parsePlayerGroupFilter(sp.skupina);

  const [players, payments] = await Promise.all([
    prisma.player.findMany({
      where: {
        userId,
        active: true,
        ...(skupina && {
          groupMembers: { some: { group: skupina } },
        }),
      },
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Skupinové platby</h1>
        <p className="mt-1 text-sm text-slate-600">
          Společné výdaje — rozdělení částky a QR. Filtr omezí seznam hráčů u nové
          platby.
        </p>
      </div>

      <Panel>
        <GroupFilterNav basePath="/skupinove-platby" current={skupina} />
      </Panel>

      <Panel>
        <h2 className="text-sm font-medium text-slate-800">Nová platba</h2>
        <form action={createSharedPayment} className="mt-4 space-y-4">
          <label className="block text-sm text-slate-600">
            Název / událost
            <input
              name="title"
              required
              placeholder="např. Ubytování Olomouc"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </label>
          <label className="block text-sm text-slate-600">
            Popis (volitelné)
            <textarea
              name="description"
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </label>
          <label className="block text-sm text-slate-600">
            Celková částka (Kč)
            <input
              name="totalKc"
              required
              placeholder="např. 4500"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </label>
          <fieldset>
            <legend className="text-sm text-slate-600">Kdo se podílí</legend>
            <div className="mt-2 flex max-h-48 flex-col gap-2 overflow-y-auto rounded-md border border-slate-200 bg-slate-50/50 p-3">
              {players.length === 0 && (
                <p className="text-sm text-slate-500">
                  Žádní hráči v tomto filtru — zvol „Všichni“ nebo přidej hráče.
                </p>
              )}
              {players.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="playerIds"
                    value={p.id}
                    className="rounded border-slate-300"
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="submit"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
          >
            Vytvořit a rozdělit částku
          </button>
        </form>
      </Panel>

      <div>
        <h2 className="mb-2 text-sm font-medium text-slate-700">Aktivní</h2>
        <Panel className="!p-0">
          <ul className="divide-y divide-slate-100">
            {payments.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                Žádné záznamy.
              </li>
            )}
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <div className="font-medium text-slate-800">{p.title}</div>
                  <div className="text-sm text-slate-600">
                    Celkem {formatCzkFromCents(p.totalAmountCents)}
                  </div>
                </div>
                <Link
                  href={`/skupinove-platby/${p.id}`}
                  className="text-sm text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                >
                  Detail
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-slate-700">Archiv (uhrazeno)</h2>
        <Panel className="!bg-slate-50/80 !p-0">
          <ul className="divide-y divide-slate-100">
            {archived.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-500">Prázdné.</li>
            )}
            {archived.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <div className="font-medium text-slate-800">{p.title}</div>
                  <div className="text-sm text-slate-600">
                    {formatCzkFromCents(p.totalAmountCents)}
                  </div>
                </div>
                <Link
                  href={`/skupinove-platby/${p.id}`}
                  className="text-sm text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
                >
                  Otevřít
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
