"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const schema = z.object({
  bankIban: z.string().optional(),
});

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
