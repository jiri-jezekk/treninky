import { prisma } from "@/lib/prisma";
import { formatDateTimeDdMmYyyy24h } from "@/lib/date-display";
import type {
  CopySource,
  DrillOption,
  PlanBlockRow,
  PlanRoster,
} from "@/components/PlanEditor";
import {
  parseTeams,
  sortDrillsForGroup,
  summarizePlan,
  withTimes,
  type DrillKind,
} from "@/lib/training-plan";

export type PlanForEditor = {
  id: string;
  startsAt: Date;
  durationMinutes: number | null;
  groupId: string | null;
};

/**
 * Všechno, co potřebuje editor plánu — body s časy, nabídka knihovny
 * a plány, odkud jde převzít. Stejné pro plánovač i detail tréninku.
 *
 * `knownPlayerIds` je soupiska pro týmy; hráči, kteří v ní nejsou,
 * se z uloženého rozdělení vynechají.
 */
export async function loadPlanEditor(
  userId: string,
  plan: PlanForEditor,
  knownPlayerIds?: Set<string>,
) {
  const [blocks, drills, sources] = await Promise.all([
    prisma.trainingBlock.findMany({
      where: { planId: plan.id },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.drill.findMany({
      where: { userId, archived: false },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        kind: true,
        defaultMinutes: true,
        focus: true,
        description: true,
        groupIds: true,
      },
    }),
    // Odkud se dá převzít plán — poslední plány, které nějaké body mají.
    prisma.trainingPlan.findMany({
      where: { userId, id: { not: plan.id }, blocks: { some: {} } },
      orderBy: { startsAt: "desc" },
      take: 12,
      select: {
        id: true,
        startsAt: true,
        topic: true,
        group: { select: { name: true } },
        _count: { select: { blocks: true } },
      },
    }),
  ]);

  const timed = withTimes(
    blocks.map((b) => ({
      id: String(b.id),
      minutes: b.minutes,
      title: b.title,
      focus: b.focus,
      drillId: b.drillId,
      notes: b.notes,
      kind: b.kind as DrillKind,
      teams: parseTeams(b.teams, knownPlayerIds),
    })),
    plan.startsAt,
  );
  const planBlocks: PlanBlockRow[] = timed.map((b) => ({
    id: b.id,
    title: b.title,
    focus: b.focus,
    drillId: b.drillId,
    notes: b.notes,
    minutes: b.minutes,
    kind: b.kind,
    startLabel: b.startLabel,
    endLabel: b.endLabel,
    teams: b.teams,
  }));

  const endsAt =
    plan.durationMinutes == null
      ? null
      : new Date(plan.startsAt.getTime() + plan.durationMinutes * 60_000);
  const summary = summarizePlan(planBlocks, plan.startsAt, endsAt);

  const drillOptions: DrillOption[] = sortDrillsForGroup(drills, plan.groupId).map(
    (d) => ({
      id: d.id,
      name: d.name,
      kind: d.kind as DrillKind,
      defaultMinutes: d.defaultMinutes,
      focus: d.focus,
      description: d.description,
      forPlanGroup: plan.groupId != null && d.groupIds.includes(plan.groupId),
    }),
  );

  const copySources: CopySource[] = sources.map((p) => ({
    id: p.id,
    label: [
      formatDateTimeDdMmYyyy24h(p.startsAt),
      p.group?.name,
      p.topic,
    ]
      .filter(Boolean)
      .join(" · "),
    blockCount: p._count.blocks,
  }));

  return {
    blocks: planBlocks,
    drills: drillOptions,
    sources: copySources,
    plannedMinutes: summary.plannedMinutes,
    differenceMinutes: summary.differenceMinutes,
  };
}

/**
 * Soupiska kategorie plánu pro dělení do týmů. Null, když plán
 * kategorii nemá — pak se týmy nenabízí.
 */
export async function loadPlanRoster(
  userId: string,
  plan: { groupId: string | null; attendeeIds: string[] },
): Promise<PlanRoster | null> {
  if (!plan.groupId) return null;

  const members = await prisma.rosterMember.findMany({
    where: { userId, groupId: plan.groupId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, skill: true, active: true },
  });
  const known = new Set(members.map((m) => m.id));

  return {
    groupId: plan.groupId,
    members: members.map((m) => ({ id: m.id, name: m.name, skill: m.skill })),
    activeIds: members.filter((m) => m.active).map((m) => m.id),
    // Smazaní ze soupisky se přeskočí.
    attendeeIds: plan.attendeeIds.filter((id) => known.has(id)),
  };
}
