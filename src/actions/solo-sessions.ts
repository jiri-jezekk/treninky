"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { hasPortalSession } from "@/lib/player-portal-session";
import { parseDateInput } from "@/lib/prepaid";
import { MAX_SOLO_PER_DAY } from "@/lib/rating-limits";

function revalidateSolo(payToken?: string) {
  revalidatePath("/rating");
  if (payToken) revalidatePath(`/p/${payToken}/rating`);
}

/**
 * Hráč si zapíše individuální trénink — házení, posilovna, běh.
 * Počítá se stejně jako účast na klubovém tréninku.
 */
export async function logSoloSession(formData: FormData) {
  const payToken = String(formData.get("payToken") ?? "").trim();
  if (!payToken) return;
  if (!(await hasPortalSession(payToken))) return;

  const player = await prisma.player.findUnique({
    where: { payToken },
    select: { id: true, userId: true, inRating: true, active: true },
  });
  if (!player || !player.active) return;
  // Kdo není v ratingu, nemá si co zapisovat — nikde by se to neprojevilo.
  if (!player.inRating) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const performedOn = parseDateInput(formData.get("performedOn"));
  if (!performedOn) return;

  // Do budoucna se zapisovat nedá — jinak by si šlo nabrat rating dopředu.
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  if (performedOn.toISOString().slice(0, 10) > todayKey) return;

  // Za den se dá zapsat víc tréninků — dopoledne házení, večer fitko —
  // a počítají se všechny. Dřív tu byl upsert a druhý zápis ten první
  // přepsal, takže hráč o bod přišel.
  const dnes = await prisma.soloSession.count({
    where: { playerId: String(player.id), performedOn },
  });
  if (dnes >= MAX_SOLO_PER_DAY) return;

  await prisma.soloSession.create({
    data: {
      userId: String(player.userId),
      playerId: String(player.id),
      performedOn,
      name,
      note: String(formData.get("note") ?? "").trim() || null,
    },
  });
  revalidateSolo(payToken);
}

/** Smazání vlastního zápisu. Trenér smaže kterýkoli. */
export async function deleteSoloSession(sessionId: string, payToken?: string) {
  if (payToken) {
    if (!(await hasPortalSession(payToken))) return;
    const player = await prisma.player.findUnique({
      where: { payToken },
      select: { id: true },
    });
    if (!player) return;
    await prisma.soloSession.deleteMany({
      where: { id: sessionId, playerId: String(player.id) },
    });
    revalidateSolo(payToken);
    return;
  }

  const userId = await requireUserId();
  await prisma.soloSession.deleteMany({ where: { id: sessionId, userId } });
  revalidateSolo();
}
