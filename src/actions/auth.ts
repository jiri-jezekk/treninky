"use server";

import { hash } from "bcryptjs";
import { z } from "zod";
import { signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Heslo alespoň 8 znaků"),
});

export type AuthActionState = { error?: string; ok?: boolean };

export async function registerAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors.join(", ") || "Neplatný vstup" };
  }
  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Účet s tímto e-mailem už existuje." };
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hash(parsed.data.password, 12),
    },
  });
  return { ok: true };
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
