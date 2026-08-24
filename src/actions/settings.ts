"use server";

import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const schema = z.object({
  bankIban: z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Zadejte stávající heslo"),
    newPassword: z.string().min(8, "Nové heslo musí mít alespoň 8 znaků"),
    confirmPassword: z.string().min(1, "Potvrďte nové heslo"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Nová hesla se neshodují",
    path: ["confirmPassword"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "Nové heslo musí být jiné než stávající",
    path: ["newPassword"],
  });

export type PasswordActionState = { error?: string; ok?: boolean };

export async function updateSettings(formData: FormData) {
  const userId = await requireUserId();
  const raw = schema.parse({
    bankIban: formData.get("bankIban") ?? "",
  });
  const iban = String(raw.bankIban ?? "")
    .replace(/\s/g, "")
    .toUpperCase();
  await prisma.user.update({
    where: { id: userId },
    data: {
      bankIban: iban === "" ? null : iban,
    },
  });
  revalidatePath("/nastaveni");
  revalidatePath("/platba");
}

export async function changePassword(
  _prev: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const userId = await requireUserId();

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) return { error: "Účet nenalezen." };

  const ok = await compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return { error: "Stávající heslo není správné." };

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hash(parsed.data.newPassword, 12) },
  });

  revalidatePath("/nastaveni");
  return { ok: true };
}
