"use server";

import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { grantPortalSession } from "@/lib/player-portal-session";

export type PortalActionState = { error?: string };

const passwordSchema = z
  .string()
  .min(6, "Heslo musí mít alespoň 6 znaků")
  .max(200);

/**
 * Hráč si při prvním otevření odkazu nastaví heslo.
 * Když už nastavené je, nic se nepřepíše — jinak by si ho mohl přepsat
 * kdokoli, kdo odkaz získá.
 */
export async function setPortalPassword(
  _prev: PortalActionState,
  formData: FormData,
): Promise<PortalActionState> {
  const payToken = String(formData.get("payToken") ?? "");
  const player = await prisma.player.findUnique({
    where: { payToken },
    select: { id: true, passwordHash: true },
  });
  if (!player) return { error: "Odkaz je neplatný." };
  if (player.passwordHash) {
    return { error: "Heslo už je nastavené. Zadejte ho, nebo požádejte trenéra o reset." };
  }

  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatné heslo" };
  }
  if (String(formData.get("passwordAgain") ?? "") !== parsed.data) {
    return { error: "Hesla se neshodují." };
  }

  await prisma.player.update({
    where: { id: player.id },
    data: { passwordHash: await hash(parsed.data, 12), passwordSetAt: new Date() },
  });

  await grantPortalSession(payToken);
  revalidatePath(`/p/${payToken}`);
  return {};
}

export async function verifyPortalPassword(
  _prev: PortalActionState,
  formData: FormData,
): Promise<PortalActionState> {
  const payToken = String(formData.get("payToken") ?? "");
  const player = await prisma.player.findUnique({
    where: { payToken },
    select: { passwordHash: true },
  });
  if (!player?.passwordHash) return { error: "Odkaz je neplatný." };

  const password = String(formData.get("password") ?? "");
  if (!password || !(await compare(password, player.passwordHash))) {
    return { error: "Nesprávné heslo." };
  }

  await grantPortalSession(payToken);
  revalidatePath(`/p/${payToken}`);
  return {};
}
