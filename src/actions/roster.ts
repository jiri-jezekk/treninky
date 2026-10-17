"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { parseSkill } from "@/lib/team-balance";

function revalidateRoster() {
  revalidatePath("/planovac", "layout");
  revalidatePath("/treninky/[id]", "page");
}

async function ownedGroup(groupId: string, userId: string) {
  return prisma.group.findFirst({
    where: { id: groupId, userId },
    select: { id: true },
  });
}

async function ownedMember(memberId: string, userId: string) {
  return prisma.rosterMember.findFirst({
    where: { id: memberId, userId },
    select: { id: true, groupId: true },
  });
}

/** Jména z textového pole — jedno na řádek, prázdné a duplicity pryč. */
function parseNames(raw: unknown): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of String(raw ?? "").split(/\r?\n/)) {
    const name = line.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!name) continue;
    const key = name.toLocaleLowerCase("cs");
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

/** Přidá do soupisky víc lidí najednou; kdo už tam je, toho přeskočí. */
async function addNames(userId: string, groupId: string, names: string[], skill: number) {
  const existing = await prisma.rosterMember.findMany({
    where: { groupId },
    select: { name: true },
  });
  const taken = new Set(existing.map((m) => m.name.toLocaleLowerCase("cs")));
  for (const name of names) {
    if (taken.has(name.toLocaleLowerCase("cs"))) continue;
    taken.add(name.toLocaleLowerCase("cs"));
    await prisma.rosterMember.create({
      data: { userId, groupId, name, skill },
    });
  }
}

export async function addRosterMembers(groupId: string, formData: FormData) {
  const userId = await requireUserId();
  if (!(await ownedGroup(groupId, userId))) return;

  const names = parseNames(formData.get("names"));
  if (names.length === 0) return;

  await addNames(userId, groupId, names, parseSkill(formData.get("skill")));
  revalidateRoster();
}

/**
 * Převezme do soupisky hráče klubu z téže kategorie (typicky A-tým).
 * Jen jména — soupiska s hráči ani platbami dál nesouvisí.
 */
export async function importPlayersToRoster(groupId: string) {
  const userId = await requireUserId();
  if (!(await ownedGroup(groupId, userId))) return;

  const players = await prisma.player.findMany({
    where: { userId, active: true, groupMembers: { some: { groupId } } },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  await addNames(
    userId,
    groupId,
    players.map((p) => p.name),
    2,
  );
  revalidateRoster();
}

export async function setRosterSkill(memberId: string, skill: number) {
  const userId = await requireUserId();
  if (!(await ownedMember(memberId, userId))) return;

  await prisma.rosterMember.update({
    where: { id: memberId },
    data: { skill: parseSkill(skill) },
  });
  revalidateRoster();
}

export async function renameRosterMember(memberId: string, formData: FormData) {
  const userId = await requireUserId();
  const member = await ownedMember(memberId, userId);
  if (!member) return;

  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (!name) return;
  const clash = await prisma.rosterMember.findFirst({
    where: { groupId: member.groupId, name, id: { not: memberId } },
    select: { id: true },
  });
  if (clash) return;

  await prisma.rosterMember.update({
    where: { id: memberId },
    data: { name },
  });
  revalidateRoster();
}

export async function setRosterActive(memberId: string, active: boolean) {
  const userId = await requireUserId();
  if (!(await ownedMember(memberId, userId))) return;

  await prisma.rosterMember.update({
    where: { id: memberId },
    data: { active },
  });
  revalidateRoster();
}

export async function deleteRosterMember(memberId: string) {
  const userId = await requireUserId();
  await prisma.rosterMember.deleteMany({ where: { id: memberId, userId } });
  revalidateRoster();
}

/**
 * Kdo z soupisky na trénink přišel. Z prohlížeče přijde cokoli —
 * projdou jen členové soupisky kategorie tohoto plánu.
 */
export async function setPlanAttendees(planId: string, memberIds: string[]) {
  const userId = await requireUserId();
  const plan = await prisma.trainingPlan.findFirst({
    where: { id: planId, userId },
    select: { id: true, groupId: true, trainingId: true },
  });
  if (!plan?.groupId) return;

  const wanted = [...new Set(memberIds.map(String))];
  const valid = await prisma.rosterMember.findMany({
    where: { userId, groupId: plan.groupId, id: { in: wanted } },
    select: { id: true },
  });

  await prisma.trainingPlan.update({
    where: { id: planId },
    data: { attendeeIds: valid.map((m) => m.id) },
  });
  revalidatePath(`/planovac/${planId}`);
  if (plan.trainingId) revalidatePath(`/treninky/${plan.trainingId}`);
}
