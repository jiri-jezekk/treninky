import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export default async function StatistikyPage() {
  const userId = await requireUserId();

  const trainings = await prisma.training.findMany({
    where: { userId, cancelled: false },
    select: { id: true },
  });
  const trainingIds = trainings.map((t) => t.id);
  const totalTrainings = trainingIds.length;

  const players = await prisma.player.findMany({
    where: { userId, active: true },
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Statistiky docházky</h1>
        <p className="mt-1 text-slate-600">
          Podíl přítomností u nezrušených tréninků (všechna období).
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Počet započítaných tréninků celkem:{" "}
          <strong>{totalTrainings}</strong>
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-2 font-medium">Hráč</th>
              <th className="px-4 py-2 font-medium">Přítomen</th>
              <th className="px-4 py-2 font-medium">Účast</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                  Žádní aktivní hráči nebo žádné tréninky.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-medium text-slate-900">{r.name}</td>
                <td className="px-4 py-2 text-slate-700">
                  {r.present} / {totalTrainings}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
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
      </div>
    </div>
  );
}
