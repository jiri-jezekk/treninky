import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

/** Ověří session a že uživatel v aktuální DB existuje (jinak redirect na route handler, který cookie smaže). */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/prihlaseni");

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) {
    redirect("/api/auth/clear-stale-session");
  }
  return id;
}
