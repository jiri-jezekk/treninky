import Link from "next/link";
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
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Přehled</h1>
        <p className="mt-1 text-slate-600">
          Rychlý přehled stavu týmu a nadcházejících tréninků.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Aktivní hráči</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{players}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Nadcházející tréninky</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{upcoming}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Tréninky celkem</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{totalTrainings}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/hraci"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Spravovat hráče
        </Link>
        <Link
          href="/treninky"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Tréninky
        </Link>
        <Link
          href="/nastaveni"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Bankovní údaje a ceny
        </Link>
      </div>
    </div>
  );
}
