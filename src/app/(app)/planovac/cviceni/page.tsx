import { DrillLibrary, type DrillRow } from "./DrillLibrary";
import { listGroups } from "@/lib/groups";
import { loadDrillUsage } from "@/lib/plan-editor-data";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import type { DrillKind } from "@/lib/training-plan";

export default async function CviceniPage() {
  const userId = await requireUserId();

  const [drills, groups, usage] = await Promise.all([
    prisma.drill.findMany({
      where: { userId },
      orderBy: [{ archived: "asc" }, { kind: "asc" }, { name: "asc" }],
      include: { _count: { select: { blocks: true } } },
    }),
    listGroups(userId),
    loadDrillUsage(userId),
  ]);

  // Id smazané kategorie v cvičení zůstat může — tady se zahodí.
  const groupIds = new Set(groups.map((g) => g.id));

  const rows: DrillRow[] = drills.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    equipment: d.equipment,
    focus: d.focus,
    link: d.link,
    minPlayers: d.minPlayers,
    tags: d.tags,
    groupIds: d.groupIds.filter((id) => groupIds.has(id)),
    defaultMinutes: d.defaultMinutes,
    kind: d.kind as DrillKind,
    archived: d.archived,
    usedCount: d._count.blocks,
  }));

  return (
    <>
      <p className="mb-5 max-w-prose text-sm text-slate-600">
        Zásobník, ze kterého skládáš plány tréninků. Přidávej si ho postupně —
        co jednou zapíšeš, příště jen vybereš ze seznamu. Bod napsaný přímo
        v plánu sem dostaneš tlačítkem „Do knihovny“.
      </p>

      <DrillLibrary
        drills={rows}
        groups={groups}
        usageRows={usage.map((u) => ({ ...u, startsAt: u.startsAt.toISOString() }))}
        nowIso={new Date().toISOString()}
      />
    </>
  );
}
