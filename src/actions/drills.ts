"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { parseDrillKind } from "@/lib/training-plan";

function revalidateDrills() {
  revalidatePath("/treninky/cviceni");
  revalidatePath("/treninky");
}

/** Minuty z formuláře. Prázdné pole i nesmysl znamenají „neurčeno“. */
function parseMinutes(raw: unknown): number | null {
  const value = String(raw ?? "").trim();
  if (value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 600) return null;
  return Math.round(n);
}

export async function createDrill(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  // Stejný název dvakrát by v nabídce nešel rozlišit.
  const clash = await prisma.drill.findFirst({
    where: { userId, name },
    select: { id: true },
  });
  if (clash) return;

  await prisma.drill.create({
    data: {
      userId,
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      equipment: String(formData.get("equipment") ?? "").trim() || null,
      defaultMinutes: parseMinutes(formData.get("defaultMinutes")),
      kind: parseDrillKind(formData.get("kind")),
    },
  });
  revalidateDrills();
}

export async function updateDrill(drillId: string, formData: FormData) {
  const userId = await requireUserId();
  const owned = await prisma.drill.findFirst({
    where: { id: drillId, userId },
    select: { id: true },
  });
  if (!owned) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const clash = await prisma.drill.findFirst({
    where: { userId, name, id: { not: drillId } },
    select: { id: true },
  });
  if (clash) return;

  await prisma.drill.update({
    where: { id: drillId },
    data: {
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      equipment: String(formData.get("equipment") ?? "").trim() || null,
      defaultMinutes: parseMinutes(formData.get("defaultMinutes")),
      kind: parseDrillKind(formData.get("kind")),
    },
  });
  revalidateDrills();
}

/**
 * Archivace místo mazání — cvičení se přestane nabízet, ale zůstane
 * čitelné v plánech, kde už bylo použité.
 */
export async function setDrillArchived(drillId: string, archived: boolean) {
  const userId = await requireUserId();
  await prisma.drill.updateMany({
    where: { id: drillId, userId },
    data: { archived },
  });
  revalidateDrills();
}

export async function deleteDrill(drillId: string) {
  const userId = await requireUserId();
  await prisma.drill.deleteMany({ where: { id: drillId, userId } });
  revalidateDrills();
}
