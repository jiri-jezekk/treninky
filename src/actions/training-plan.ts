"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { combineDateInputAndTime } from "@/lib/date-display";
import { checkboxOn } from "@/lib/form-values";
import {
  parseDrillKind,
  parseRating,
  parseTeams,
  parseTemplateBlocks,
  type DrillKind,
  type TemplateBlock,
  type TeamAssignment,
} from "@/lib/training-plan";

/** Plán se ukazuje v plánovači i u tréninku, ke kterému patří. */
function revalidatePlan(plan: { id: string; trainingId: string | null }) {
  revalidatePath(`/planovac/${plan.id}`);
  revalidatePath("/planovac");
  if (plan.trainingId) revalidatePath(`/treninky/${plan.trainingId}`);
}

/** Ověří, že plán patří přihlášenému trenérovi. */
async function ownedPlan(planId: string, userId: string) {
  return prisma.trainingPlan.findFirst({
    where: { id: planId, userId },
    select: { id: true, trainingId: true, groupId: true },
  });
}

type LibraryDraft = {
  title: string;
  focus: string | null;
  notes: string | null;
  minutes: number;
  kind: DrillKind;
};

/**
 * Cvičení v knihovně pro bod napsaný přímo v plánu. Když už cvičení
 * stejného jména v knihovně je, vrátí to — dvě stejně pojmenovaná by
 * v nabídce nešla rozlišit. Nové se založí pro kategorii plánu.
 */
async function libraryDrillFor(
  userId: string,
  draft: LibraryDraft,
  groupId: string | null,
): Promise<string> {
  const existing = await prisma.drill.findFirst({
    where: { userId, name: draft.title },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.drill.create({
    data: {
      userId,
      name: draft.title,
      description: draft.notes,
      focus: draft.focus,
      defaultMinutes: draft.minutes,
      kind: draft.kind,
      groupIds: groupId ? [groupId] : [],
    },
    select: { id: true },
  });
  revalidatePath("/planovac/cviceni");
  return created.id;
}

/** Bod plánu přihlášeného trenéra i s tím, k čemu patří. */
async function ownedBlock(blockId: string, userId: string) {
  return prisma.trainingBlock.findFirst({
    where: { id: blockId, plan: { userId } },
    select: {
      id: true,
      planId: true,
      minutes: true,
      sortOrder: true,
      plan: { select: { id: true, trainingId: true } },
    },
  });
}

function parseMinutes(raw: unknown, fallback = 10): number {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n <= 0 || n > 600) return fallback;
  return Math.round(n);
}

/** Délka plánu. Prázdné pole i nesmysl znamenají „neurčeno“. */
function parseDuration(raw: unknown): number | null {
  const value = String(raw ?? "").trim();
  if (value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 600) return null;
  return Math.round(n);
}

function text(raw: unknown): string | null {
  return String(raw ?? "").trim() || null;
}

/** Kategorie z formuláře — jen ta, která patří tomuhle trenérovi. */
async function ownedGroupId(userId: string, raw: unknown): Promise<string | null> {
  const id = String(raw ?? "").trim();
  if (!id) return null;
  const group = await prisma.group.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  return group?.id ?? null;
}

async function nextSortOrder(planId: string): Promise<number> {
  const last = await prisma.trainingBlock.findFirst({
    where: { planId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return (last?.sortOrder ?? -1) + 1;
}

/**
 * Připojí body jiného plánu na konec.
 *
 * Rozdělení do týmů se nepřenáší — to je věc jednoho konkrétního večera
 * a přítomných hráčů, ne přípravy.
 */
async function appendBlocksFrom(sourceId: string, targetId: string) {
  const blocks = await prisma.trainingBlock.findMany({
    where: { planId: sourceId },
    orderBy: { sortOrder: "asc" },
  });
  let order = await nextSortOrder(targetId);
  for (const b of blocks) {
    await prisma.trainingBlock.create({
      data: {
        planId: targetId,
        drillId: b.drillId,
        title: b.title,
        focus: b.focus,
        notes: b.notes,
        minutes: b.minutes,
        kind: b.kind,
        sortOrder: order++,
      },
    });
  }
}

/**
 * Připojí body šablony. Odkaz na cvičení se zachová jen tehdy, když
 * cvičení v knihovně pořád je — jinak zůstane bod s názvem bez odkazu.
 */
async function appendTemplateBlocks(userId: string, templateId: string, planId: string) {
  const template = await prisma.planTemplate.findFirst({
    where: { id: templateId, userId },
    select: { blocks: true },
  });
  if (!template) return;

  const blocks = parseTemplateBlocks(template.blocks);
  const drillIds = blocks.map((b) => b.drillId).filter((id): id is string => id != null);
  const existing = new Set(
    (
      await prisma.drill.findMany({
        where: { userId, id: { in: drillIds } },
        select: { id: true },
      })
    ).map((d) => d.id),
  );

  let order = await nextSortOrder(planId);
  for (const b of blocks) {
    await prisma.trainingBlock.create({
      data: {
        planId,
        drillId: b.drillId && existing.has(b.drillId) ? b.drillId : null,
        title: b.title,
        focus: b.focus,
        notes: b.notes,
        minutes: b.minutes,
        kind: b.kind,
        sortOrder: order++,
      },
    });
  }
}

/* --------------------------------------------------------------- plán */

/** Založí plán a otevře ho. Volitelně rovnou s body jiného plánu. */
export async function createPlan(formData: FormData) {
  const userId = await requireUserId();

  const startsAt = combineDateInputAndTime(
    String(formData.get("date") ?? ""),
    String(formData.get("time") ?? ""),
  );

  const plan = await prisma.trainingPlan.create({
    data: {
      userId,
      startsAt,
      durationMinutes: parseDuration(formData.get("durationMinutes")),
      groupId: await ownedGroupId(userId, formData.get("groupId")),
      topic: text(formData.get("topic")),
    },
    select: { id: true },
  });

  const templateId = String(formData.get("templateId") ?? "").trim();
  if (templateId) await appendTemplateBlocks(userId, templateId, plan.id);

  const sourceId = String(formData.get("sourceId") ?? "").trim();
  if (sourceId) {
    const source = await ownedPlan(sourceId, userId);
    if (source) await appendBlocksFrom(source.id, plan.id);
  }

  revalidatePath("/planovac");
  redirect(`/planovac/${plan.id}`);
}

/** Datum, délka, kategorie a téma plánu. */
export async function updatePlan(planId: string, formData: FormData) {
  const userId = await requireUserId();
  const plan = await ownedPlan(planId, userId);
  if (!plan) return;

  const startsAt = combineDateInputAndTime(
    String(formData.get("date") ?? ""),
    String(formData.get("time") ?? ""),
  );

  await prisma.trainingPlan.update({
    where: { id: planId },
    data: {
      startsAt,
      durationMinutes: parseDuration(formData.get("durationMinutes")),
      groupId: await ownedGroupId(userId, formData.get("groupId")),
      topic: text(formData.get("topic")),
    },
  });
  revalidatePlan(plan);
}

export async function deletePlan(planId: string) {
  const userId = await requireUserId();
  const plan = await ownedPlan(planId, userId);
  if (!plan) return;

  await prisma.trainingPlan.delete({ where: { id: planId } });
  revalidatePlan(plan);
  redirect("/planovac");
}

/**
 * Založí plán k tréninku z rozvrhu. Čas a délku převezme z tréninku,
 * aby plán seděl na termín bez přepisování.
 */
export async function createPlanForTraining(trainingId: string) {
  const userId = await requireUserId();
  const training = await prisma.training.findFirst({
    where: { id: trainingId, userId },
    select: { id: true, startsAt: true, endsAt: true, plan: { select: { id: true } } },
  });
  if (!training || training.plan) return;

  // Rozvrh je pro dospělé — kategorie A-tým, pokud ji trenér má
  // (stejně jako u plánů převedených migrací).
  const groups = await prisma.group.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
  const adults = groups.find((g) =>
    ["a-tým", "a-tym"].includes(g.name.toLowerCase().replace(/\s+/g, "-")),
  );

  await prisma.trainingPlan.create({
    data: {
      userId,
      trainingId,
      groupId: adults?.id ?? null,
      startsAt: training.startsAt,
      durationMinutes: training.endsAt
        ? Math.round((training.endsAt.getTime() - training.startsAt.getTime()) / 60_000)
        : null,
    },
  });
  revalidatePath(`/treninky/${trainingId}`);
  revalidatePath("/planovac");
}

/* --------------------------------------------------------- body plánu */

/** Přidá bod plánu — buď cvičení z knihovny, nebo vlastní. */
export async function addPlanBlock(planId: string, formData: FormData) {
  const userId = await requireUserId();
  const plan = await ownedPlan(planId, userId);
  if (!plan) return;

  const drillIdRaw = String(formData.get("drillId") ?? "").trim();
  const drill =
    drillIdRaw === "" || drillIdRaw === "vlastni"
      ? null
      : await prisma.drill.findFirst({ where: { id: drillIdRaw, userId } });

  const title = String(formData.get("title") ?? "").trim() || drill?.name || "";
  if (!title) return;

  const draft: LibraryDraft = {
    title,
    focus: formData.has("focus") ? text(formData.get("focus")) : (drill?.focus ?? null),
    notes: text(formData.get("notes")),
    minutes: parseMinutes(formData.get("minutes"), drill?.defaultMinutes ?? 10),
    kind: formData.has("kind")
      ? parseDrillKind(formData.get("kind"))
      : ((drill?.kind as DrillKind | undefined) ?? parseDrillKind(null)),
  };

  // Vlastní bod jde rovnou uložit i do knihovny zaškrtnutím ve formuláři.
  const drillId =
    drill?.id ??
    (checkboxOn(formData.get("saveToLibrary"))
      ? await libraryDrillFor(userId, draft, plan.groupId)
      : null);

  await prisma.trainingBlock.create({
    data: {
      planId,
      drillId,
      title: draft.title,
      focus: draft.focus,
      notes: draft.notes,
      minutes: draft.minutes,
      kind: draft.kind,
      sortOrder: await nextSortOrder(planId),
    },
  });
  revalidatePlan(plan);
}

export async function updatePlanBlock(blockId: string, formData: FormData) {
  const userId = await requireUserId();
  const block = await ownedBlock(blockId, userId);
  if (!block) return;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  await prisma.trainingBlock.update({
    where: { id: blockId },
    data: {
      title,
      focus: text(formData.get("focus")),
      notes: text(formData.get("notes")),
      minutes: parseMinutes(formData.get("minutes"), block.minutes),
      kind: parseDrillKind(formData.get("kind")),
    },
  });
  revalidatePlan(block.plan);
}

/** Rychlá úprava délky bodu o pár minut — bez otevírání formuláře. */
export async function nudgeBlockMinutes(blockId: string, delta: number) {
  const userId = await requireUserId();
  const block = await ownedBlock(blockId, userId);
  if (!block) return;

  const minutes = Math.min(600, Math.max(1, block.minutes + Math.round(delta)));
  if (minutes === block.minutes) return;

  await prisma.trainingBlock.update({
    where: { id: blockId },
    data: { minutes },
  });
  revalidatePlan(block.plan);
}

export async function deletePlanBlock(blockId: string) {
  const userId = await requireUserId();
  const block = await ownedBlock(blockId, userId);
  if (!block) return;

  await prisma.trainingBlock.delete({ where: { id: blockId } });
  revalidatePlan(block.plan);
}

/**
 * Posune bod v plánu nahoru nebo dolů.
 *
 * Prohodí se pořadí se sousedem — jednodušší a spolehlivější než
 * přetahování myší, což se navíc v hale na telefonu ovládá špatně.
 */
export async function movePlanBlock(blockId: string, direction: "up" | "down") {
  const userId = await requireUserId();
  const block = await ownedBlock(blockId, userId);
  if (!block) return;

  const neighbour = await prisma.trainingBlock.findFirst({
    where: {
      planId: block.planId,
      sortOrder:
        direction === "up" ? { lt: block.sortOrder } : { gt: block.sortOrder },
    },
    orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
    select: { id: true, sortOrder: true },
  });
  if (!neighbour) return;

  await prisma.$transaction(async (tx) => {
    await tx.trainingBlock.update({
      where: { id: block.id },
      data: { sortOrder: neighbour.sortOrder },
    });
    await tx.trainingBlock.update({
      where: { id: neighbour.id },
      data: { sortOrder: block.sortOrder },
    });
  });
  revalidatePlan(block.plan);
}

/** Připojí na konec body jiného plánu. */
export async function copyPlanFrom(planId: string, formData: FormData) {
  const userId = await requireUserId();
  const target = await ownedPlan(planId, userId);
  if (!target) return;

  const sourceId = String(formData.get("sourceId") ?? "").trim();
  if (!sourceId || sourceId === planId) return;
  const source = await ownedPlan(sourceId, userId);
  if (!source) return;

  await appendBlocksFrom(source.id, planId);
  revalidatePlan(target);
}

export async function clearPlan(planId: string) {
  const userId = await requireUserId();
  const plan = await ownedPlan(planId, userId);
  if (!plan) return;

  await prisma.trainingBlock.deleteMany({ where: { planId } });
  revalidatePlan(plan);
}

/** Uloží bod napsaný přímo v plánu do knihovny a napojí ho na něj. */
export async function saveBlockToLibrary(blockId: string) {
  const userId = await requireUserId();
  const block = await prisma.trainingBlock.findFirst({
    where: { id: blockId, plan: { userId } },
    include: { plan: { select: { id: true, trainingId: true, groupId: true } } },
  });
  if (!block || block.drillId) return;

  const drillId = await libraryDrillFor(
    userId,
    {
      title: block.title,
      focus: block.focus,
      notes: block.notes,
      minutes: block.minutes,
      kind: block.kind as DrillKind,
    },
    block.plan.groupId,
  );

  await prisma.trainingBlock.update({
    where: { id: blockId },
    data: { drillId },
  });
  revalidatePlan(block.plan);
}

/* --------------------------------------------------------------- týmy */

/*
 * Týmy se dělí v prohlížeči (vyrovnaně podle dovednosti nebo ručně)
 * a sem se jen ukládají. Rozdělení je momentka jednoho tréninku.
 */

/** Uloží rozdělení do týmů u bodu plánu. */
export async function saveTeams(blockId: string, teams: TeamAssignment[]) {
  const userId = await requireUserId();
  const block = await ownedBlock(blockId, userId);
  if (!block) return;

  // Z prohlížeče přijde cokoli — projde jen to, co má správný tvar,
  // a jen lidé ze soupisek tohoto trenéra.
  const known = await prisma.rosterMember.findMany({
    where: { userId },
    select: { id: true },
  });
  const clean = parseTeams(teams, new Set(known.map((m) => m.id)));

  await prisma.trainingBlock.update({
    where: { id: blockId },
    data: { teams: clean },
  });
  revalidatePlan(block.plan);
}

export async function clearTeams(blockId: string) {
  const userId = await requireUserId();
  const block = await ownedBlock(blockId, userId);
  if (!block) return;

  // Prisma u nullable Json sloupce nebere obyčejné null — to by znamenalo
  // „nic neměň“. Prázdný sloupec se nastavuje přes Prisma.DbNull.
  await prisma.trainingBlock.update({
    where: { id: blockId },
    data: { teams: Prisma.DbNull },
  });
  revalidatePlan(block.plan);
}

/* ------------------------------------------------- po tréninku */

/** Palec nahoru / dolů u bodu. Stejné klepnutí znovu hodnocení zruší. */
export async function setBlockRating(blockId: string, rating: number) {
  const userId = await requireUserId();
  const block = await prisma.trainingBlock.findFirst({
    where: { id: blockId, plan: { userId } },
    select: { id: true, rating: true, drillId: true, plan: { select: { id: true, trainingId: true } } },
  });
  if (!block) return;

  const wanted = parseRating(rating);
  await prisma.trainingBlock.update({
    where: { id: blockId },
    data: { rating: block.rating === wanted ? null : wanted },
  });
  revalidatePlan(block.plan);
  if (block.drillId) revalidatePath("/planovac/cviceni");
}

/** Poznámka po tréninku — co fungovalo, co ne. */
export async function saveReflection(planId: string, formData: FormData) {
  const userId = await requireUserId();
  const plan = await ownedPlan(planId, userId);
  if (!plan) return;

  await prisma.trainingPlan.update({
    where: { id: planId },
    data: { reflection: text(formData.get("reflection")) },
  });
  revalidatePlan(plan);
}

/* --------------------------------------------------------- šablony */

/**
 * Uloží stavbu plánu jako šablonu. Stejný název přepíše starou
 * šablonu — trenér si tak „Standardní U12“ jen aktualizuje.
 */
export async function savePlanAsTemplate(planId: string, formData: FormData) {
  const userId = await requireUserId();
  const plan = await prisma.trainingPlan.findFirst({
    where: { id: planId, userId },
    select: {
      groupId: true,
      durationMinutes: true,
      blocks: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!plan || plan.blocks.length === 0) return;

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) return;

  const blocks: TemplateBlock[] = plan.blocks.map((b) => ({
    title: b.title,
    focus: b.focus,
    notes: b.notes,
    minutes: b.minutes,
    kind: b.kind as DrillKind,
    drillId: b.drillId,
  }));

  await prisma.planTemplate.upsert({
    where: { userId_name: { userId, name } },
    create: {
      userId,
      name,
      groupId: plan.groupId,
      durationMinutes: plan.durationMinutes,
      blocks,
    },
    update: {
      groupId: plan.groupId,
      durationMinutes: plan.durationMinutes,
      blocks,
    },
  });
  revalidatePath("/planovac", "layout");
}

export async function deleteTemplate(templateId: string) {
  const userId = await requireUserId();
  await prisma.planTemplate.deleteMany({ where: { id: templateId, userId } });
  revalidatePath("/planovac", "layout");
}
