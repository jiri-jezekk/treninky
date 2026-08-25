"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { getPlayerBalance } from "@/lib/player-balance";

function revalidatePayments() {
  revalidatePath("/platby");
  revalidatePath("/prehled");
}

/** Označí měsíc jako zaplacený nebo označení zruší. */
export async function setMonthPaid(formData: FormData) {
  const userId = await requireUserId();
  const playerId = String(formData.get("playerId") ?? "");
  const year = Number.parseInt(String(formData.get("year") ?? ""), 10);
  const month = Number.parseInt(String(formData.get("month") ?? ""), 10);
  const paid = String(formData.get("paid") ?? "") === "true";

  if (!playerId || !Number.isInteger(year) || !Number.isInteger(month)) return;
  if (month < 1 || month > 12) return;

  const owned = await prisma.player.findFirst({
    where: { id: playerId, userId },
    select: { id: true },
  });
  if (!owned) return;

  if (paid) {
    await prisma.monthlyPaymentMark.upsert({
      where: { userId_playerId_year_month: { userId, playerId, year, month } },
      create: { userId, playerId, year, month },
      update: {},
    });
  } else {
    await prisma.monthlyPaymentMark.deleteMany({
      where: { userId, playerId, year, month },
    });
  }
  revalidatePayments();
}

/**
 * Označí vše, co hráč dluží, jako zaplacené — měsíce i akce najednou.
 * Používá stejný výpočet jako přehled dlužníků, aby se označilo přesně to,
 * co je tam vidět.
 */
export async function markPlayerAllPaid(playerId: string) {
  const userId = await requireUserId();
  const balance = await getPlayerBalance(userId, playerId);
  if (!balance) return;

  const months = balance.unpaid.filter((i) => i.kind === "monthly");
  const events = balance.unpaid.filter((i) => i.kind === "event");

  await prisma.$transaction(async (tx) => {
    for (const m of months) {
      if (m.year == null || m.month == null) continue;
      await tx.monthlyPaymentMark.upsert({
        where: {
          userId_playerId_year_month: {
            userId,
            playerId,
            year: m.year,
            month: m.month,
          },
        },
        create: { userId, playerId, year: m.year, month: m.month },
        update: {},
      });
    }
    for (const e of events) {
      if (!e.sharedPaymentId) continue;
      await tx.sharedPaymentParticipant.updateMany({
        where: { sharedPaymentId: e.sharedPaymentId, playerId },
        data: { paidAt: new Date() },
      });
    }
  });

  revalidatePayments();
  revalidatePath("/skupinove-platby");
}
