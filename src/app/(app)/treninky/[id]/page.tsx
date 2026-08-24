import Link from "next/link";
import { notFound } from "next/navigation";
import { AttendanceStatus } from "@prisma/client";
import { AttendanceCheckbox } from "@/components/AttendanceCheckbox";
import { GroupFilterNav } from "@/components/GroupFilterNav";
import { Panel } from "@/components/ui";
import { listGroups, parseGroupFilter } from "@/lib/groups";
import { formatDateTimeDdMmYyyy24h } from "@/lib/date-display";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import {
  setAttendanceBulkForTraining,
  setTrainingCancelled,
} from "@/actions/trainings";

export default async function TrainingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ skupina?: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  const sp = await searchParams;
  const groups = await listGroups(userId);
  const skupina = parseGroupFilter(sp.skupina, groups);

  const training = await prisma.training.findFirst({
    where: { id, userId },
  });

  if (!training) notFound();

  const [players, totalActivePlayers, presentCount] = await Promise.all([
    prisma.player.findMany({
    where: {
      userId,
      active: true,
      ...(skupina && {
        groupMembers: { some: { groupId: skupina } },
      }),
    },
    orderBy: { name: "asc" },
    include: {
      attendances: { where: { trainingId: id } },
      groupMembers: { include: { group: true } },
    },
  }),
    prisma.player.count({ where: { userId, active: true } }),
    prisma.attendance.count({
      where: { trainingId: id, status: AttendanceStatus.PRESENT },
    }),
  ]);

  const customNote =
    training.defaultPriceCents != null
      ? `Vlastní cena tohoto tréninku: ${(training.defaultPriceCents / 100).toFixed(0)} Kč (junioři 60 Kč).`
      : null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href="/treninky"
            className="text-sm text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
          >
            ← Tréninky
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-slate-800">
            {formatDateTimeDdMmYyyy24h(training.startsAt)}
          </h1>
          {training.notes && (
            <p className="mt-2 text-sm text-slate-600">{training.notes}</p>
          )}
          {customNote && (
            <p className="mt-2 text-xs text-slate-500">{customNote}</p>
          )}
        </div>
        <form
          action={setTrainingCancelled.bind(null, id, !training.cancelled)}
          className="w-full shrink-0 sm:w-auto"
        >
          <button
            type="submit"
            className={`w-full rounded-md border px-3 py-2 text-sm sm:w-auto ${
              training.cancelled
                ? "border-slate-300 text-slate-800 hover:bg-slate-50"
                : "border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {training.cancelled ? "Označit jako konaný" : "Označit jako zrušený"}
          </button>
        </form>
      </div>

      <Panel>
        <GroupFilterNav groups={groups} basePath={`/treninky/${id}`} current={skupina} />
        <p className="mt-2 text-xs text-slate-500">
          Zaškrtni „Přítomen“, pokud hráč byl na tréninku. Platba se počítá v měsíčním
          přehledu <Link href="/platba" className="underline">Platba za tréninky</Link>.
        </p>
      </Panel>

      <Panel className="!p-0 sm:!p-0">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium text-slate-800">Docházka</h2>
            <p className="text-sm text-slate-600">
              Přítomno:{" "}
              <span className="font-semibold tabular-nums text-slate-800">
                {presentCount}
              </span>
              <span className="text-slate-400"> / </span>
              <span className="tabular-nums text-slate-700">{totalActivePlayers}</span>
            </p>
          </div>
        </div>
        {players.length > 0 && (
          <div className="space-y-1.5 border-b border-slate-100 px-4 py-2 sm:px-5">
            <form action={setAttendanceBulkForTraining} className="flex flex-wrap gap-2">
              <input type="hidden" name="trainingId" value={id} />
              {players.map((p) => (
                <input key={p.id} type="hidden" name="playerIds" value={p.id} />
              ))}
              <button
                type="submit"
                name="bulkPresent"
                value="true"
                className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-900 hover:bg-emerald-100"
              >
                Označit vše přítomen
              </button>
              <button
                type="submit"
                name="bulkPresent"
                value="false"
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                Odznačit vše (nepřítomen)
              </button>
            </form>
            {skupina && (
              <p className="text-xs text-slate-500">
                Hromadná úprava platí jen pro zobrazené hráče (filtr skupiny).
              </p>
            )}
          </div>
        )}
        <div className="table-scroll-wrapper px-4 pb-4 sm:px-5">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2 pr-4 font-medium">Hráč</th>
                <th className="py-2 pr-4 font-medium">Účast</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {players.map((p) => {
                const att = p.attendances[0];
                const present = att?.status === AttendanceStatus.PRESENT;
                // Zvýhodněné kategorie hráče — dřív natvrdo „Junioři“.
                const zvyhodnene = p.groupMembers
                  .map((m) => m.group)
                  .filter((g) => g.discountPriceCents != null);
                return (
                  <tr key={p.id}>
                    <td className="py-2 pr-4">
                      <span className="font-medium text-slate-800">{p.name}</span>
                      {zvyhodnene.length > 0 && (
                        <span className="ml-2 text-xs text-slate-500">
                          ({zvyhodnene.map((g) => g.name).join(", ")})
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <AttendanceCheckbox
                        trainingId={id}
                        playerId={p.id}
                        present={present}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {players.length === 0 && (
          <p className="px-4 pb-4 text-sm text-slate-500 sm:px-5">
            Žádní hráči v tomto filtru — změň filtr nebo přidej hráče v sekci Hráči.
          </p>
        )}
      </Panel>
    </div>
  );
}
