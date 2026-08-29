"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { parseCzkToCents } from "@/lib/money";
import { parseMinutes } from "@/lib/training-slots";
import { checkboxOn } from "@/lib/form-values";

function revalidateTrainings() {
  revalidatePath("/treninky");
  revalidatePath("/prehled");
}

/** Kč z formuláře na haléře. Null = nešlo přečíst. */
function priceFromForm(raw: unknown): number | null {
  const value = String(raw ?? "").trim();
  if (value === "") return null;
  return parseCzkToCents(value.replace(",", "."));
}

export async function createTrainingSlot(formData: FormData) {
  const userId = await requireUserId();

  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const startMinutes = parseMinutes(formData.get("startTime"));
  const endMinutes = parseMinutes(formData.get("endTime"));
  const priceCents = priceFromForm(formData.get("price"));

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return;
  if (startMinutes == null || endMinutes == null || priceCents == null) return;

  // Stejný den a začátek už v rozvrhu být nemůže — jinak by generování
  // dělalo dva tréninky na tentýž večer a hráči by platili dvakrát.
  const clash = await prisma.trainingSlot.findFirst({
    where: { userId, dayOfWeek, startMinutes },
    select: { id: true },
  });
  if (clash) return;

  await prisma.trainingSlot.create({
    data: {
      userId,
      dayOfWeek,
      startMinutes,
      endMinutes,
      priceCents,
      kind: formData.get("gym") === "on" ? "GYM" : "TRAINING",
    },
  });
  revalidateTrainings();
}

export async function updateTrainingSlot(slotId: string, formData: FormData) {
  const userId = await requireUserId();
  const current = await prisma.trainingSlot.findFirst({
    where: { id: slotId, userId },
  });
  if (!current) return;

  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const startMinutes = parseMinutes(formData.get("startTime"));
  const endMinutes = parseMinutes(formData.get("endTime"));
  const priceCents = priceFromForm(formData.get("price"));

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return;
  if (startMinutes == null || endMinutes == null || priceCents == null) return;

  const clash = await prisma.trainingSlot.findFirst({
    where: { userId, dayOfWeek, startMinutes, id: { not: slotId } },
    select: { id: true },
  });
  if (clash) return;

  await prisma.trainingSlot.update({
    where: { id: slotId },
    data: {
      dayOfWeek,
      startMinutes,
      endMinutes,
      priceCents,
      kind: formData.get("gym") === "on" ? "GYM" : "TRAINING",
      active: checkboxOn(formData.get("active")),
    },
  });
  revalidateTrainings();
}

/**
 * Smaže termín z rozvrhu. Už vytvořené tréninky zůstanou i s cenou —
 * ta se jim uložila při vzniku, takže minulé účtování se nezmění.
 */
export async function deleteTrainingSlot(slotId: string) {
  const userId = await requireUserId();
  await prisma.trainingSlot.deleteMany({ where: { id: slotId, userId } });
  revalidateTrainings();
}

export async function setTrainingSlotActive(slotId: string, active: boolean) {
  const userId = await requireUserId();
  await prisma.trainingSlot.updateMany({
    where: { id: slotId, userId },
    data: { active },
  });
  revalidateTrainings();
}
