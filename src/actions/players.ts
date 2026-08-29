"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { sanitizeGroupIds } from "@/lib/groups";
import { newPayToken } from "@/lib/pay-token";

const nameSchema = z.object({
  name: z.string().min(1, "Jméno je povinné").max(120),
});

function groupIdsFromForm(formData: FormData, field: string): string[] {
  return formData.getAll(field).map(String);
}

/** Nejnižší volné číslo hráče v klubu — ať se po smazání čísla recyklují. */
async function nextPlayerNumber(userId: string): Promise<number> {
  const taken = await prisma.player.findMany({
    where: { userId },
    select: { number: true },
    orderBy: { number: "asc" },
  });
  let expected = 1;
  for (const { number } of taken) {
    if (number > expected) break;
    if (number === expected) expected++;
  }
  return expected;
}

function revalidatePlayerRelated() {
  revalidatePath("/hraci");
  revalidatePath("/treninky");
  revalidatePath("/statistiky");
  revalidatePath("/platby");
}

export async function createPlayer(formData: FormData) {
  const userId = await requireUserId();
  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) throw new Error(parsed.error.flatten().formErrors.join(", "));

  const groupIds = await sanitizeGroupIds(userId, groupIdsFromForm(formData, "skupiny"));

  await prisma.player.create({
    data: {
      userId,
      name: parsed.data.name.trim(),
      number: await nextPlayerNumber(userId),
      payToken: newPayToken(),
      ...(groupIds.length > 0 && {
        groupMembers: { create: groupIds.map((groupId) => ({ groupId })) },
      }),
    },
  });
  revalidatePlayerRelated();
}

async function applyPlayerGroups(playerId: string, groupIds: string[]) {
  await prisma.$transaction(async (tx) => {
    await tx.playerGroupMembership.deleteMany({ where: { playerId } });
    if (groupIds.length > 0) {
      await tx.playerGroupMembership.createMany({
        data: groupIds.map((groupId) => ({ playerId, groupId })),
      });
    }
  });
}

/**
 * Uloží jméno, kategorie a aktivitu jednoho hráče (panel detailu).
 * Předplatné se sem nevešlo — má vlastní období a spravuje se
 * v Platby → Předplatné.
 */
export async function savePlayer(playerId: string, formData: FormData) {
  const userId = await requireUserId();
  const owned = await prisma.player.findFirst({
    where: { id: playerId, userId },
    select: { id: true },
  });
  if (!owned) return;

  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (parsed.success) {
    await prisma.player.updateMany({
      where: { id: playerId, userId },
      data: { name: parsed.data.name.trim() },
    });
  }

  const groupIds = await sanitizeGroupIds(userId, groupIdsFromForm(formData, "skupiny"));
  await applyPlayerGroups(playerId, groupIds);

  await prisma.player.updateMany({
    where: { id: playerId, userId },
    data: {
      active: formData.get("active") === "on",
      inRating: formData.get("inRating") === "on",
      seesReviews: formData.get("seesReviews") === "on",
    },
  });

  revalidatePlayerRelated();
}

export async function setPlayerActive(playerId: string, active: boolean) {
  const userId = await requireUserId();
  await prisma.player.updateMany({ where: { id: playerId, userId }, data: { active } });
  revalidatePlayerRelated();
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

export async function deletePlayer(playerId: string) {
  const userId = await requireUserId();
  await prisma.player.deleteMany({ where: { id: playerId, userId } });
  revalidatePlayerRelated();
}

/** Hromadná akce nad vybranými hráči ze seznamu. */
export async function bulkPlayerAction(formData: FormData) {
  const userId = await requireUserId();
  const action = String(formData.get("action") ?? "");
  const ids = formData.getAll("playerIds").map(String).filter(Boolean);
  if (ids.length === 0) return;

  const owned = await prisma.player.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true },
  });
  const ownedIds = owned.map((p) => p.id);
  if (ownedIds.length === 0) return;

  if (action === "activate" || action === "deactivate") {
    await prisma.player.updateMany({
      where: { id: { in: ownedIds }, userId },
      data: { active: action === "activate" },
    });
  } else if (action === "rating-on" || action === "rating-off") {
    await prisma.player.updateMany({
      where: { id: { in: ownedIds }, userId },
      data: { inRating: action === "rating-on" },
    });
  } else if (action === "rozbory-on" || action === "rozbory-off") {
    await prisma.player.updateMany({
      where: { id: { in: ownedIds }, userId },
      data: { seesReviews: action === "rozbory-on" },
    });
  } else if (action === "delete") {
    await prisma.player.deleteMany({ where: { id: { in: ownedIds }, userId } });
  }
  revalidatePlayerRelated();
}

/** Zruší heslo k platebnímu odkazu — hráč si při dalším otevření nastaví nové. */
export async function resetPlayerPassword(playerId: string) {
  const userId = await requireUserId();
  await prisma.player.updateMany({
    where: { id: playerId, userId },
    data: { passwordHash: null, passwordSetAt: null },
  });
  revalidatePath("/hraci");
}

/** Vygeneruje nový platební odkaz. Starý tím okamžitě přestane fungovat. */
export async function regeneratePayToken(playerId: string) {
  const userId = await requireUserId();
  await prisma.player.updateMany({
    where: { id: playerId, userId },
    data: { payToken: newPayToken(), passwordHash: null, passwordSetAt: null },
  });
  revalidatePath("/hraci");
}
