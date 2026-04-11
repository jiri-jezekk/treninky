"use server";

import { PlayerGroup } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const nameSchema = z.object({
  name: z.string().min(1, "Jméno je povinné").max(120),
});

const GROUP_SET = new Set<PlayerGroup>(["MEN", "WOMEN", "MIX", "JUNIORS"]);

function parseGroupsFromForm(formData: FormData): PlayerGroup[] {
  return formData
    .getAll("skupiny")
    .map(String)
    .filter((g): g is PlayerGroup => GROUP_SET.has(g as PlayerGroup));
}

export async function createPlayer(formData: FormData) {
  const userId = await requireUserId();
  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) throw new Error(parsed.error.flatten().formErrors.join(", "));
  const groups = parseGroupsFromForm(formData);
  const prepaidSeason = formData.get("prepaidSeason") === "on";
  await prisma.player.create({
    data: {
      userId,
      name: parsed.data.name.trim(),
      prepaidSeason,
      ...(groups.length > 0 && {
        groupMembers: { create: groups.map((group) => ({ group })) },
      }),
    },
  });
  revalidatePath("/hraci");
  revalidatePath("/skupinove-platby");
  revalidatePath("/platba");
}

async function applyPlayerGroupsAndPrepaid(
  userId: string,
  playerId: string,
  groups: PlayerGroup[],
  prepaidSeason: boolean,
) {
  await prisma.$transaction(async (tx) => {
    await tx.playerGroupMembership.deleteMany({ where: { playerId } });
    if (groups.length > 0) {
      await tx.playerGroupMembership.createMany({
        data: groups.map((group) => ({ playerId, group })),
      });
    }
    await tx.player.updateMany({
      where: { id: playerId, userId },
      data: { prepaidSeason },
    });
  });
}

function revalidatePlayerRelated() {
  revalidatePath("/hraci");
  revalidatePath("/treninky");
  revalidatePath("/statistiky");
  revalidatePath("/skupinove-platby");
  revalidatePath("/platba");
}

/** Jedna řádka — pole `skupiny_${id}` a `prepaid_${id}` (stejný form jako u hromadného uložení). */
export async function savePlayerRow(playerId: string, formData: FormData) {
  const userId = await requireUserId();
  const ok = await prisma.player.findFirst({
    where: { id: playerId, userId },
    select: { id: true },
  });
  if (!ok) return;
  const groups = formData
    .getAll(`skupiny_${playerId}`)
    .map(String)
    .filter((g): g is PlayerGroup => GROUP_SET.has(g as PlayerGroup));
  const prepaidSeason = formData.get(`prepaid_${playerId}`) === "on";
  await applyPlayerGroupsAndPrepaid(userId, playerId, groups, prepaidSeason);
  revalidatePlayerRelated();
}

/**
 * Hromadně: `allPlayerIds` (čárky), u každého `skupiny_${id}` a `prepaid_${id}`.
 */
export async function bulkSavePlayers(formData: FormData) {
  const userId = await requireUserId();
  const raw = formData.get("allPlayerIds");
  if (typeof raw !== "string" || !raw.trim()) return;
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  for (const playerId of ids) {
    const groups = formData
      .getAll(`skupiny_${playerId}`)
      .map(String)
      .filter((g): g is PlayerGroup => GROUP_SET.has(g as PlayerGroup));
    const prepaidSeason = formData.get(`prepaid_${playerId}`) === "on";
    const ok = await prisma.player.findFirst({
      where: { id: playerId, userId },
      select: { id: true },
    });
    if (!ok) continue;
    await applyPlayerGroupsAndPrepaid(userId, playerId, groups, prepaidSeason);
  }
  revalidatePlayerRelated();
}

export async function setPlayerActive(playerId: string, active: boolean) {
  const userId = await requireUserId();
  await prisma.player.updateMany({
    where: { id: playerId, userId },
    data: { active },
  });
  revalidatePath("/hraci");
  revalidatePath("/treninky");
}

export async function deletePlayer(playerId: string) {
  const userId = await requireUserId();
  await prisma.player.deleteMany({
    where: { id: playerId, userId },
  });
  revalidatePath("/hraci");
  revalidatePath("/treninky");
  revalidatePath("/statistiky");
  revalidatePath("/skupinove-platby");
}

export async function togglePlayerActive(playerId: string) {
  const userId = await requireUserId();
  const p = await prisma.player.findFirst({
    where: { id: playerId, userId },
    select: { active: true },
  });
  if (!p) return;
  await setPlayerActive(playerId, !p.active);
}
