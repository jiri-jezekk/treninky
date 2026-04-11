import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import {
  bulkSavePlayers,
  createPlayer,
  deletePlayer,
  savePlayerRow,
  togglePlayerActive,
} from "@/actions/players";
import { GroupCheckboxes } from "@/components/GroupCheckboxes";
import { GroupFilterNav } from "@/components/GroupFilterNav";
import { Panel } from "@/components/ui";
import { PLAYER_GROUP_LABELS, parsePlayerGroupFilter } from "@/lib/player-groups";

const BULK_FORM_ID = "bulk-save-players-form";

export default async function HraciPage({
  searchParams,
}: {
  searchParams: Promise<{ skupina?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const skupina = parsePlayerGroupFilter(sp.skupina);

  const players = await prisma.player.findMany({
    where: {
      userId,
      ...(skupina && {
        groupMembers: { some: { group: skupina } },
      }),
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { groupMembers: true },
  });

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Hráči</h1>
        <p className="mt-1 text-sm text-slate-600">
          Skupiny můžete kombinovat. Předplaceno = hráč se v měsíční platbě vůbec nezobrazuje
          (předplacená sezóna). Filtrem zúžíte seznam.
        </p>
      </div>

      <Panel>
        <GroupFilterNav basePath="/hraci" current={skupina} />
      </Panel>

      <form id={BULK_FORM_ID} action={bulkSavePlayers} className="sr-only" aria-hidden>
        <input
          type="hidden"
          name="allPlayerIds"
          value={players.map((p) => p.id).join(",")}
        />
      </form>

      <Panel>
        <h2 className="text-sm font-medium text-slate-700">Nový hráč</h2>
        <form action={createPlayer} className="mt-4 space-y-4">
          <label className="block text-sm text-slate-600">
            Jméno
            <input
              name="name"
              required
              placeholder="Jméno"
              className="mt-1 w-full max-w-md rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </label>
          <div>
            <p className="text-xs text-slate-500">Skupiny (volitelné, více najednou)</p>
            <div className="mt-2">
              <GroupCheckboxes />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="prepaidSeason"
              className="rounded border-slate-300"
            />
            Předplaceno (nezobrazovat v měsíční platbě)
          </label>
          <button
            type="submit"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
          >
            Přidat hráče
          </button>
        </form>
      </Panel>

      <div className="space-y-3">
        {players.length === 0 && (
          <Panel>
            <p className="text-center text-sm text-slate-500">
              Žádní hráči pro tento filtr.
            </p>
          </Panel>
        )}
        {players.map((p) => (
          <Panel key={p.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="font-medium text-slate-800">{p.name}</span>
                {!p.active && (
                  <span className="ml-2 text-xs text-slate-500">neaktivní</span>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.groupMembers.length === 0 ? (
                    <span className="text-xs text-slate-400">bez skupiny</span>
                  ) : (
                    p.groupMembers.map((m) => (
                      <span
                        key={m.group}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
                      >
                        {PLAYER_GROUP_LABELS[m.group]}
                      </span>
                    ))
                  )}
                </div>
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
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-red-50 hover:text-red-800"
                    title="Smaže hráče a související záznamy"
                  >
                    Smazat
                  </button>
                </form>
              </div>
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">Skupiny a předplacení</p>
              <div className="mt-2">
                <GroupCheckboxes
                  form={BULK_FORM_ID}
                  name={`skupiny_${p.id}`}
                  defaultSelected={p.groupMembers.map((g) => g.group)}
                />
              </div>
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                <input
                  form={BULK_FORM_ID}
                  type="checkbox"
                  name={`prepaid_${p.id}`}
                  defaultChecked={p.prepaidSeason}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span>
                  Předplaceno — hráč se v měsíční platbě nezobrazuje
                </span>
              </label>
              <button
                type="submit"
                form={BULK_FORM_ID}
                formAction={savePlayerRow.bind(null, p.id)}
                className="mt-3 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Uložit
              </button>
            </div>
          </Panel>
        ))}
      </div>

      {players.length > 0 && (
        <Panel>
          <button
            type="submit"
            form={BULK_FORM_ID}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
          >
            Uložit vše
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Uloží skupiny i předplacení u všech hráčů ve výpisu (respektuje filtr skupiny —
            mimo filtr se nemění).
          </p>
        </Panel>
      )}
    </div>
  );
}
