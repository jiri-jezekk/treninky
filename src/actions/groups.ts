"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { DEFAULT_GROUP_COLOR, GROUP_COLORS } from "@/lib/groups";
import { parseCzkToCents } from "@/lib/money";

export type GroupActionState = { error?: string; ok?: boolean };

const nameSchema = z
  .string()
  .trim()
  .min(1, "Název kategorie nesmí být prázdný")
  .max(40, "Název kategorie je moc dlouhý");

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function revalidateGroupRelated() {
  revalidatePath("/hraci");
  revalidatePath("/treninky");
  revalidatePath("/statistiky");
  revalidatePath("/platby");
}

async function ownsGroup(userId: string, groupId: string): Promise<boolean> {
  const g = await prisma.group.findFirst({
    where: { id: groupId, userId },
    select: { id: true },
  });
  return g != null;
}

export async function createGroup(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const userId = await requireUserId();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný název" };
  }
  const name = parsed.data;

  const clash = await prisma.group.findFirst({
    where: { userId, name },
    select: { id: true },
  });
  if (clash) return { error: `Kategorie „${name}“ už existuje.` };

  const count = await prisma.group.count({ where: { userId } });
  await prisma.group.create({
    data: {
      userId,
      name,
      color: GROUP_COLORS[count % GROUP_COLORS.length] ?? DEFAULT_GROUP_COLOR,
      sortOrder: count,
    },
  });
  revalidateGroupRelated();
  return { ok: true };
}

export async function renameGroup(groupId: string, formData: FormData) {
  const userId = await requireUserId();
  if (!(await ownsGroup(userId, groupId))) return;

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return;

  const clash = await prisma.group.findFirst({
    where: { userId, name: parsed.data, id: { not: groupId } },
    select: { id: true },
  });
  if (clash) return;

  await prisma.group.updateMany({
    where: { id: groupId, userId },
    data: { name: parsed.data },
  });
  revalidateGroupRelated();
}

export async function setGroupColor(groupId: string, color: string) {
  const userId = await requireUserId();
  if (!HEX_COLOR.test(color)) return;
  await prisma.group.updateMany({ where: { id: groupId, userId }, data: { color } });
  revalidateGroupRelated();
}

/**
 * Zvýhodněná cena za trénink. Prázdný vstup = kategorie platí běžnou sazbu.
 * Sem se přestěhovalo dřívější pevné pravidlo „junioři 60 Kč“.
 */
export async function setGroupDiscount(groupId: string, formData: FormData) {
  const userId = await requireUserId();
  if (!(await ownsGroup(userId, groupId))) return;

  const raw = String(formData.get("discount") ?? "").trim();
  if (raw === "") {
    await prisma.group.updateMany({
      where: { id: groupId, userId },
      data: { discountPriceCents: null },
    });
  } else {
    const cents = parseCzkToCents(raw);
    if (cents == null) return;
    await prisma.group.updateMany({
      where: { id: groupId, userId },
      data: { discountPriceCents: cents },
    });
  }
  revalidateGroupRelated();
}

/**
 * Smaže kategorii. Když v ní ještě někdo je, odmítne to — mlčky odpárat
 * hráče od kategorie by bylo horší než tohle nechat rozhodnout trenéra.
 */
export async function deleteGroup(groupId: string): Promise<GroupActionState> {
  const userId = await requireUserId();
  if (!(await ownsGroup(userId, groupId))) return { error: "Kategorie nenalezena." };

  const used = await prisma.playerGroupMembership.count({ where: { groupId } });
  if (used > 0) {
    return {
      error: `Kategorie má ${used} ${used === 1 ? "hráče" : used < 5 ? "hráče" : "hráčů"} — nejdřív je přeřaďte.`,
    };
  }
  await prisma.group.deleteMany({ where: { id: groupId, userId } });
  revalidateGroupRelated();
  return { ok: true };
}
