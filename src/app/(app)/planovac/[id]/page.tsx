import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanEditor } from "@/components/PlanEditor";
import { listGroups } from "@/lib/groups";
import {
  formatDateDdMmYyyy,
  formatDateInputValue,
  formatTime24h,
} from "@/lib/date-display";
import { loadPlanEditor } from "@/lib/plan-editor-data";
import { DAY_NAMES } from "@/lib/training-slots";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { PlanHeader } from "./PlanHeader";

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();

  const plan = await prisma.trainingPlan.findFirst({
    where: { id, userId },
    include: { group: { select: { name: true, color: true } } },
  });
  if (!plan) notFound();

  // Týmy jdou dělit jen u tréninku z rozvrhu — tam je soupiska s docházkou.
  const players = plan.trainingId
    ? (
        await prisma.player.findMany({
          where: { userId, active: true },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            attendances: {
              where: { trainingId: plan.trainingId },
              select: { status: true },
            },
          },
        })
      ).map((p) => ({
        id: p.id,
        name: p.name,
        present: p.attendances[0]?.status === "PRESENT",
      }))
    : null;

  const [groups, editor] = await Promise.all([
    listGroups(userId),
    loadPlanEditor(
      userId,
      plan,
      players ? new Set(players.map((p) => String(p.id))) : undefined,
    ),
  ]);

  const endsAt =
    plan.durationMinutes == null
      ? null
      : new Date(plan.startsAt.getTime() + plan.durationMinutes * 60_000);

  return (
    <>
      <Link
        href="/planovac"
        className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800"
      >
        ← Všechny plány
      </Link>

      <div className="mt-4">
        <PlanHeader
          planId={plan.id}
          title={formatDateDdMmYyyy(plan.startsAt)}
          subtitle={`${DAY_NAMES[plan.startsAt.getDay()]} ${formatTime24h(plan.startsAt)}${
            endsAt ? `–${formatTime24h(endsAt)}` : ""
          }${plan.durationMinutes ? ` · ${plan.durationMinutes} min` : ""}`}
          group={plan.group}
          trainingHref={plan.trainingId ? `/treninky/${plan.trainingId}` : null}
          values={{
            date: formatDateInputValue(plan.startsAt),
            time: formatTime24h(plan.startsAt),
            durationMinutes: plan.durationMinutes,
            groupId: plan.groupId,
            topic: plan.topic,
          }}
          groups={groups}
        />
      </div>

      <PlanEditor planId={plan.id} {...editor} players={players} />
    </>
  );
}
