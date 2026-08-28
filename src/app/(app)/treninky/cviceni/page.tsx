import Link from "next/link";
import { DrillLibrary, type DrillRow } from "./DrillLibrary";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import type { DrillKind } from "@/lib/training-plan";

export default async function CviceniPage() {
  const userId = await requireUserId();

  const drills = await prisma.drill.findMany({
    where: { userId },
    orderBy: [{ archived: "asc" }, { kind: "asc" }, { name: "asc" }],
    include: { _count: { select: { blocks: true } } },
  });

  const rows: DrillRow[] = drills.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    equipment: d.equipment,
    defaultMinutes: d.defaultMinutes,
    kind: d.kind as DrillKind,
    archived: d.archived,
    usedCount: d._count.blocks,
  }));

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <Link
        href="/treninky"
        className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800"
      >
        ← Zpět na Tréninky
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="font-heading text-2xl font-extrabold uppercase tracking-wide text-slate-800 sm:text-3xl">
          Cvičení
        </h1>
        <div className="mt-3 h-1 w-14 rounded bg-club" />
        <p className="mt-3 max-w-prose text-sm text-slate-600">
          Zásobník, ze kterého skládáš plány tréninků. Přidávej si ho postupně —
          co jednou zapíšeš, příště jen vybereš ze seznamu.
        </p>
      </div>

      <DrillLibrary drills={rows} />
    </div>
  );
}
