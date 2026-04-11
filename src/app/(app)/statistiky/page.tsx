import { GroupFilterNav } from "@/components/GroupFilterNav";
import { StatisticsPeriodControls } from "@/components/StatisticsPeriodControls";
import { Panel } from "@/components/ui";
import { formatDateDdMmYyyy } from "@/lib/date-display";
import { parsePlayerGroupFilter } from "@/lib/player-groups";
import { parseStatisticsPeriod } from "@/lib/statistics-period";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export default async function StatistikyPage({
  searchParams,
}: {
  searchParams: Promise<{ skupina?: string; od?: string; do?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const skupina = parsePlayerGroupFilter(sp.skupina);
  const period = parseStatisticsPeriod({ od: sp.od, do: sp.do });

  const trainings = await prisma.training.findMany({
    where: {
      userId,
      cancelled: false,
      startsAt: { gte: period.start, lte: period.end },
    },
    select: { id: true },
  });
  const trainingIds = trainings.map((t) => t.id);
  const totalTrainings = trainingIds.length;

  const players = await prisma.player.findMany({
    where: {
      userId,
      active: true,
      ...(skupina && {
        groupMembers: { some: { group: skupina } },
      }),
    },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    players.map(async (p) => {
      const present = await prisma.attendance.count({
        where: {
          playerId: p.id,
          trainingId: { in: trainingIds },
          status: "PRESENT",
        },
      });
      const pct =
        totalTrainings > 0 ? Math.round((present / totalTrainings) * 100) : 0;
      return { id: p.id, name: p.name, present, pct };
    }),
  );

  const periodLabel = `${formatDateDdMmYyyy(period.start)} – ${formatDateDdMmYyyy(
    new Date(period.end.getFullYear(), period.end.getMonth(), period.end.getDate()),
  )}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Statistiky docházky</h1>
        <p className="mt-1 text-sm text-slate-600">
          Podíl přítomností u nezrušených tréninků v zvoleném období (datum = den konání tréninku).
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Období: <span className="font-medium tabular-nums">{periodLabel}</span>
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Počet započítaných tréninků v období:{" "}
          <span className="text-slate-700">{totalTrainings}</span>
        </p>
      </div>

      <Panel className="space-y-5">
        <StatisticsPeriodControls odIso={period.odIso} doIso={period.doIso} skupina={skupina} />
        <div className="border-t border-slate-100 pt-4">
          <GroupFilterNav
            basePath="/statistiky"
            current={skupina}
            extraQuery={{ od: period.odIso, do: period.doIso }}
          />
        </div>
      </Panel>

      <Panel className="overflow-x-auto !p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
            <tr>
              <th className="px-4 py-2.5 font-medium">Hráč</th>
              <th className="px-4 py-2.5 font-medium">Přítomen</th>
              <th className="px-4 py-2.5 font-medium">Účast</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                  Žádní hráči pro tento filtr nebo žádné tréninky v období.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 font-medium text-slate-800">{r.name}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {r.present} / {totalTrainings}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-slate-500"
                        style={{ width: `${r.pct}%` }}
                      />
                    </div>
                    <span className="text-slate-600">{r.pct} %</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
