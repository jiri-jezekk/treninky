"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const nameSchema = z.object({
  name: z.string().min(1, "Jméno je povinné").max(120),
});

export async function createPlayer(formData: FormData) {
  const userId = await requireUserId();
  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) throw new Error(parsed.error.flatten().formErrors.join(", "));
  await prisma.player.create({
    data: { userId, name: parsed.data.name.trim() },
  });
  revalidatePath("/hraci");
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
