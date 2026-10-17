import Link from "next/link";
import { notFound } from "next/navigation";
import { DiarySummary } from "@/components/DiarySummary";
import { PlanEditor } from "@/components/PlanEditor";
import { PlanReflection, PreviousReflection } from "@/components/PlanReflection";
import { listGroups } from "@/lib/groups";
import {
  formatDateDdMmYyyy,
  formatDateInputValue,
  formatTime24h,
} from "@/lib/date-display";
import { loadPlanEditor, loadPlanRoster } from "@/lib/plan-editor-data";
import { diarySummary } from "@/lib/training-plan";
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

  const roster = await loadPlanRoster(userId, plan);
  const [groups, editor, previous] = await Promise.all([
    listGroups(userId),
    loadPlanEditor(
      userId,
      plan,
      roster ? new Set(roster.members.map((m) => m.id)) : undefined,
    ),
    // Poznámka z posledního dřívějšího tréninku stejné kategorie.
    plan.groupId
      ? prisma.trainingPlan.findFirst({
          where: {
            userId,
            groupId: plan.groupId,
            id: { not: plan.id },
            startsAt: { lt: plan.startsAt },
            reflection: { not: null },
          },
          orderBy: { startsAt: "desc" },
          select: { id: true, startsAt: true, reflection: true },
        })
      : null,
  ]);
  const afterTraining = plan.startsAt <= new Date();

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
          templateName={[plan.group?.name, plan.topic].filter(Boolean).join(" – ") || "Moje šablona"}
          canSaveTemplate={editor.blocks.length > 0}
        />
      </div>

      {previous?.reflection && (
        <PreviousReflection
          href={`/planovac/${previous.id}`}
          dateLabel={formatDateDdMmYyyy(previous.startsAt)}
          text={previous.reflection}
        />
      )}

      <PlanEditor
        planId={plan.id}
        {...editor}
        roster={roster}
        afterTraining={afterTraining}
      />

      {afterTraining && (
        <PlanReflection planId={plan.id} reflection={plan.reflection} />
      )}

      <DiarySummary summary={diarySummary(editor.blocks)} />
    </>
  );
}
