import Link from "next/link";
import { Panel } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export default async function PrehledPage() {
  const userId = await requireUserId();
  const now = new Date();

  const [players, upcoming, totalTrainings] = await Promise.all([
    prisma.player.count({ where: { userId, active: true } }),
    prisma.training.count({
      where: {
        userId,
        cancelled: false,
        startsAt: { gte: now },
      },
    }),
    prisma.training.count({ where: { userId, cancelled: false } }),
  ]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Přehled</h1>
        <p className="mt-1 text-sm text-slate-600">
          Rychlý přehled stavu týmu a nadcházejících tréninků.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel className="!py-4">
          <div className="text-xs text-slate-500">Aktivní hráči</div>
          <div className="mt-1 text-xl font-medium text-slate-800">{players}</div>
        </Panel>
        <Panel className="!py-4">
          <div className="text-xs text-slate-500">Nadcházející tréninky</div>
          <div className="mt-1 text-xl font-medium text-slate-800">{upcoming}</div>
        </Panel>
        <Panel className="!py-4">
          <div className="text-xs text-slate-500">Tréninky celkem</div>
          <div className="mt-1 text-xl font-medium text-slate-800">{totalTrainings}</div>
        </Panel>
      </div>

      <Panel>
        <p className="mb-3 text-xs text-slate-500">Rychlé odkazy</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/hraci"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
          >
            Hráči
          </Link>
          <Link
            href="/treninky"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
          >
            Tréninky
          </Link>
          <Link
            href="/platba"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
          >
            Měsíční platba
          </Link>
          <Link
            href="/nastaveni"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
          >
            Nastavení
          </Link>
        </div>
      </Panel>
    </div>
  );
}
