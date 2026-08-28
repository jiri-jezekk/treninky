"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import {
  parseDrillKind,
  parseTeams,
  splitIntoTeams,
  type TeamAssignment,
} from "@/lib/training-plan";

function revalidateTraining(trainingId: string) {
  revalidatePath(`/treninky/${trainingId}`);
  revalidatePath("/treninky");
}

/** Ověří, že trénink patří přihlášenému trenérovi. */
async function ownedTraining(trainingId: string, userId: string) {
  return prisma.training.findFirst({
    where: { id: trainingId, userId },
    select: { id: true, startsAt: true },
  });
}

function parseMinutes(raw: unknown, fallback = 10): number {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n <= 0 || n > 600) return fallback;
  return Math.round(n);
}

async function nextSortOrder(trainingId: string): Promise<number> {
  const last = await prisma.trainingBlock.findFirst({
    where: { trainingId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return (last?.sortOrder ?? -1) + 1;
}

/** Přidá bod plánu — buď cvičení z knihovny, nebo vlastní. */
export async function addPlanBlock(trainingId: string, formData: FormData) {
  const userId = await requireUserId();
  const training = await ownedTraining(trainingId, userId);
  if (!training) return;

  const drillIdRaw = String(formData.get("drillId") ?? "").trim();
  const drill =
    drillIdRaw === "" || drillIdRaw === "vlastni"
      ? null
      : await prisma.drill.findFirst({ where: { id: drillIdRaw, userId } });

  const title = String(formData.get("title") ?? "").trim() || drill?.name || "";
  if (!title) return;

  await prisma.trainingBlock.create({
    data: {
      trainingId,
      drillId: drill?.id ?? null,
      title,
      notes: String(formData.get("notes") ?? "").trim() || null,
      minutes: parseMinutes(formData.get("minutes"), drill?.defaultMinutes ?? 10),
      kind: drill ? drill.kind : parseDrillKind(formData.get("kind")),
      sortOrder: await nextSortOrder(trainingId),
    },
  });
  revalidateTraining(trainingId);
}

export async function updatePlanBlock(blockId: string, formData: FormData) {
  const userId = await requireUserId();
  const block = await prisma.trainingBlock.findFirst({
    where: { id: blockId, training: { userId } },
    select: { id: true, trainingId: true, minutes: true },
  });
  if (!block) return;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  await prisma.trainingBlock.update({
    where: { id: blockId },
    data: {
      title,
      notes: String(formData.get("notes") ?? "").trim() || null,
      minutes: parseMinutes(formData.get("minutes"), block.minutes),
      kind: parseDrillKind(formData.get("kind")),
    },
  });
  revalidateTraining(block.trainingId);
}

export async function deletePlanBlock(blockId: string) {
  const userId = await requireUserId();
  const block = await prisma.trainingBlock.findFirst({
    where: { id: blockId, training: { userId } },
    select: { id: true, trainingId: true },
  });
  if (!block) return;

  await prisma.trainingBlock.delete({ where: { id: blockId } });
  revalidateTraining(block.trainingId);
}

/**
 * Posune bod v plánu nahoru nebo dolů.
 *
 * Prohodí se pořadí se sousedem — jednodušší a spolehlivější než
 * přetahování myší, což se navíc v hale na telefonu ovládá špatně.
 */
export async function movePlanBlock(blockId: string, direction: "up" | "down") {
  const userId = await requireUserId();
  const block = await prisma.trainingBlock.findFirst({
    where: { id: blockId, training: { userId } },
    select: { id: true, trainingId: true, sortOrder: true },
  });
  if (!block) return;

  const neighbour = await prisma.trainingBlock.findFirst({
    where: {
      trainingId: block.trainingId,
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
  revalidateTraining(block.trainingId);
}

/**
 * Zkopíruje plán z jiného tréninku.
 *
 * Rozdělení do týmů se nepřenáší — to je věc jednoho konkrétního večera
 * a přítomných hráčů, ne přípravy.
 */
export async function copyPlanFrom(trainingId: string, formData: FormData) {
  const userId = await requireUserId();
  const target = await ownedTraining(trainingId, userId);
  if (!target) return;

  const sourceId = String(formData.get("sourceId") ?? "").trim();
  if (!sourceId || sourceId === trainingId) return;

  const source = await prisma.training.findFirst({
    where: { id: sourceId, userId },
    select: { id: true },
  });
  if (!source) return;

  const blocks = await prisma.trainingBlock.findMany({
    where: { trainingId: sourceId },
    orderBy: { sortOrder: "asc" },
  });
  if (blocks.length === 0) return;

  let order = await nextSortOrder(trainingId);
  for (const b of blocks) {
    await prisma.trainingBlock.create({
      data: {
        trainingId,
        drillId: b.drillId,
        title: b.title,
        notes: b.notes,
        minutes: b.minutes,
        kind: b.kind,
        sortOrder: order++,
      },
    });
  }
  revalidateTraining(trainingId);
}

export async function clearPlan(trainingId: string) {
  const userId = await requireUserId();
  const training = await ownedTraining(trainingId, userId);
  if (!training) return;

  await prisma.trainingBlock.deleteMany({ where: { trainingId } });
  revalidateTraining(trainingId);
}

/* --------------------------------------------------------------- týmy */

/**
 * Rozdělí do týmů náhodně. Bere hráče označené jako přítomné; dokud
 * není zapsaná docházka, vezme všechny aktivní — připravit se dá
 * i dopředu.
 */
export async function shuffleTeams(blockId: string, formData: FormData) {
  const userId = await requireUserId();
  const block = await prisma.trainingBlock.findFirst({
    where: { id: blockId, training: { userId } },
    select: { id: true, trainingId: true },
  });
  if (!block) return;

  const teamCount = Number(String(formData.get("teamCount") ?? "2")) || 2;

  const players = await prisma.player.findMany({
    where: { userId, active: true },
    select: {
      id: true,
      attendances: { where: { trainingId: block.trainingId } },
      groupMembers: {
        select: { group: { select: { name: true } } },
        orderBy: { group: { sortOrder: "asc" } },
        take: 1,
      },
    },
  });

  const present = players.filter((p) => p.attendances[0]?.status === "PRESENT");
  const pool = present.length > 0 ? present : players;

  const teams = splitIntoTeams(
    pool.map((p) => ({
      id: String(p.id),
      groupKey: p.groupMembers[0]?.group.name ?? "",
    })),
    teamCount,
  );

  await prisma.trainingBlock.update({
    where: { id: blockId },
    data: { teams },
  });
  revalidateTraining(block.trainingId);
}

/** Uloží rozdělení upravené ručně v prohlížeči. */
export async function saveTeams(blockId: string, teams: TeamAssignment[]) {
  const userId = await requireUserId();
  const block = await prisma.trainingBlock.findFirst({
    where: { id: blockId, training: { userId } },
    select: { id: true, trainingId: true },
  });
  if (!block) return;

  // Z prohlížeče přijde cokoli — projde jen to, co má správný tvar,
  // a jen hráči, kteří opravdu patří tomuhle trenérovi.
  const known = await prisma.player.findMany({
    where: { userId },
    select: { id: true },
  });
  const knownIds = new Set(known.map((p) => String(p.id)));
  const clean = parseTeams(teams, knownIds);

  await prisma.trainingBlock.update({
    where: { id: blockId },
    data: { teams: clean },
  });
  revalidateTraining(block.trainingId);
}

export async function clearTeams(blockId: string) {
  const userId = await requireUserId();
  const block = await prisma.trainingBlock.findFirst({
    where: { id: blockId, training: { userId } },
    select: { id: true, trainingId: true },
  });
  if (!block) return;

  // Prisma u nullable Json sloupce nebere obyčejné null — to by znamenalo
  // „nic neměň“. Prázdný sloupec se nastavuje přes Prisma.DbNull.
  await prisma.trainingBlock.update({
    where: { id: blockId },
    data: { teams: Prisma.DbNull },
  });
  revalidateTraining(block.trainingId);
}
