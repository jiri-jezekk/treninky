import Link from "next/link";
import { GroupFilterNav } from "@/components/GroupFilterNav";
import { listGroups, parseGroupFilter } from "@/lib/groups";
import { czPlural } from "@/lib/czech";
import {
  formatDateDdMmYyyy,
  formatDateInputValue,
  formatDateTimeDdMmYyyy24h,
  formatTime24h,
} from "@/lib/date-display";
import { DAY_NAMES } from "@/lib/training-slots";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { NewPlanForm } from "./NewPlanForm";

/** Kolik proběhlých plánů ukázat, než je potřeba „Zobrazit všechny“. */
const PAST_LIMIT = 20;

type PlanListRow = {
  id: string;
  startsAt: Date;
  topic: string | null;
  trainingId: string | null;
  group: { name: string; color: string } | null;
  blocks: { minutes: number }[];
};

export default async function PlanovacPage({
  searchParams,
}: {
  searchParams: Promise<{ skupina?: string; vse?: string; sablona?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const groups = await listGroups(userId);
  const skupina = parseGroupFilter(sp.skupina, groups);
  const showAllPast = sp.vse === "1";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const where = { userId, ...(skupina && { groupId: skupina }) };
  const select = {
    id: true,
    startsAt: true,
    topic: true,
    trainingId: true,
    group: { select: { name: true, color: true } },
    blocks: { select: { minutes: true } },
  };

  const [upcoming, past, pastCount, sources, templates] = await Promise.all([
    prisma.trainingPlan.findMany({
      where: { ...where, startsAt: { gte: today } },
      orderBy: { startsAt: "asc" },
      select,
    }),
    prisma.trainingPlan.findMany({
      where: { ...where, startsAt: { lt: today } },
      orderBy: { startsAt: "desc" },
      take: showAllPast ? undefined : PAST_LIMIT,
      select,
    }),
    prisma.trainingPlan.count({ where: { ...where, startsAt: { lt: today } } }),
    prisma.trainingPlan.findMany({
      where: { userId, blocks: { some: {} } },
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
    prisma.planTemplate.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        groupId: true,
        durationMinutes: true,
        group: { select: { name: true } },
      },
    }),
  ]);
  const initialTemplateId = templates.some((t) => t.id === sp.sablona)
    ? sp.sablona!
    : null;

  return (
    <>
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <p className="min-w-0 max-w-prose text-sm text-slate-600">
            Plány tréninků pro všechny kategorie. Skládáš je z knihovny cvičení;
            u dospělých jde plán založit i přímo z tréninku v rozvrhu.
          </p>
          <NewPlanForm
            groups={groups}
            defaults={{
              date: formatDateInputValue(new Date()),
              time: "17:00",
              durationMinutes: 90,
              groupId: skupina,
              topic: null,
            }}
            sources={sources.map((p) => ({
              id: p.id,
              label: [formatDateTimeDdMmYyyy24h(p.startsAt), p.group?.name, p.topic]
                .filter(Boolean)
                .join(" · "),
              blockCount: p._count.blocks,
            }))}
            templates={templates.map((t) => ({
              id: t.id,
              label: t.group && !t.name.includes(t.group.name) ? `${t.name} (${t.group.name})` : t.name,
              groupId: t.groupId,
              durationMinutes: t.durationMinutes,
            }))}
            initialTemplateId={initialTemplateId}
          />
        </div>
        <GroupFilterNav groups={groups} basePath="/planovac" current={skupina} />
      </div>

      <PlanSection title="Nadcházející" plans={upcoming} empty="Nic naplánovaného." />

      <PlanSection title="Proběhlé" plans={past} empty="Zatím žádné." />
      {!showAllPast && pastCount > past.length && (
        <p className="mt-3 text-center">
          <Link
            href={`/planovac?${new URLSearchParams({
              ...(skupina && { skupina }),
              vse: "1",
            }).toString()}`}
            className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800"
          >
            Zobrazit všech {pastCount}
          </Link>
        </p>
      )}
    </>
  );
}

function PlanSection({
  title,
  plans,
  empty,
}: {
  title: string;
  plans: PlanListRow[];
  empty: string;
}) {
  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <h2 className="border-b border-slate-100 px-4 py-3 font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 sm:px-5">
        {title}
      </h2>
      {plans.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm italic text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {plans.map((p) => {
            const minutes = p.blocks.reduce((s, b) => s + b.minutes, 0);
            return (
              <li key={p.id}>
                <Link
                  href={`/planovac/${p.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition hover:bg-slate-50 sm:px-5"
                >
                  <span className="w-32 shrink-0 font-heading text-sm font-bold tabular-nums text-slate-800">
                    {formatDateDdMmYyyy(p.startsAt)}
                    <span className="block text-xs font-semibold text-slate-500">
                      {DAY_NAMES[p.startsAt.getDay()]} {formatTime24h(p.startsAt)}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      {p.group && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                          <span
                            aria-hidden
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: p.group.color }}
                          />
                          {p.group.name}
                        </span>
                      )}
                      {p.trainingId && (
                        <span className="text-xs text-slate-500">· z rozvrhu</span>
                      )}
                    </span>
                    <span className="block truncate text-sm text-slate-800">
                      {p.topic ?? <span className="italic text-slate-500">bez tématu</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">
                    {p.blocks.length === 0
                      ? "prázdný"
                      : `${p.blocks.length} ${czPlural(p.blocks.length, "bod", "body", "bodů")} · ${minutes} min`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
