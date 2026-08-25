"use server";

import { prisma } from "@/lib/prisma";
import {
  grantPortalSession,
  hasPortalSession,
} from "@/lib/player-portal-session";

/**
 * Prodloužení platnosti přihlášení k platebnímu odkazu.
 * Prodlouží se jen platné přihlášení — vypršelé se takhle neobnoví.
 */
export async function touchPortalSession(payToken: string): Promise<void> {
  if (!(await hasPortalSession(payToken))) return;

  const exists = await prisma.player.findUnique({
    where: { payToken },
    select: { id: true },
  });
  if (!exists) return;

  await grantPortalSession(payToken);
}
