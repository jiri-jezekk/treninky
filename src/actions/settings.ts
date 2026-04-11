"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { parseCzkToCents } from "@/lib/money";

const schema = z.object({
  defaultPrice: z.string().optional(),
  bankIban: z.string().optional(),
  bankMessagePrefix: z.string().max(40).optional(),
});

export async function updateSettings(formData: FormData) {
  const userId = await requireUserId();
  const raw = schema.parse({
    defaultPrice: formData.get("defaultPrice") ?? "",
    bankIban: formData.get("bankIban") ?? "",
    bankMessagePrefix: formData.get("bankMessagePrefix") ?? "",
  });
  const priceInput = String(raw.defaultPrice ?? "").trim();
  const defaultTrainingPriceCents =
    priceInput === "" ? null : parseCzkToCents(priceInput.replace(",", "."));
  if (defaultTrainingPriceCents === null && priceInput !== "") {
    throw new Error("Neplatná výchozí cena tréninku.");
  }
  const iban = String(raw.bankIban ?? "")
    .replace(/\s/g, "")
    .toUpperCase();
  await prisma.user.update({
    where: { id: userId },
    data: {
      defaultTrainingPriceCents,
      bankIban: iban === "" ? null : iban,
      bankMessagePrefix:
        String(raw.bankMessagePrefix ?? "").trim() || null,
    },
  });
  revalidatePath("/nastaveni");
  revalidatePath("/treninky");
}
