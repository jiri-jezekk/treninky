import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { createPlayer, deletePlayer, togglePlayerActive } from "@/actions/players";

export default async function HraciPage() {
  const userId = await requireUserId();
  const players = await prisma.player.findMany({
    where: { userId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Hráči</h1>
        <p className="mt-1 text-slate-600">
          Přidávejte nebo odebírejte hráče. Neaktivní zůstanou v historii.
        </p>
      </div>

      <form
        action={createPlayer}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="min-w-[200px] flex-1">
          <label className="block text-sm font-medium text-slate-700">Nový hráč</label>
          <input
            name="name"
            required
            placeholder="Jméno"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Přidat
        </button>
      </form>

      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm">
        {players.length === 0 && (
          <li className="px-4 py-8 text-center text-slate-500">Zatím žádní hráči.</li>
        )}
        {players.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div>
              <span className="font-medium text-slate-900">{p.name}</span>
              {!p.active && (
                <span className="ml-2 text-xs font-medium text-amber-700">neaktivní</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={togglePlayerActive.bind(null, p.id)}>
                <button
                  type="submit"
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {p.active ? "Deaktivovat" : "Aktivovat"}
                </button>
              </form>
              <form action={deletePlayer.bind(null, p.id)}>
                <button
                  type="submit"
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                  title="Trvale smaže hráče a související záznamy"
                >
                  Smazat
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
