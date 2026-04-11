"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

function parseYm(formData: FormData): { year: number; month: number } | null {
  const y = Number.parseInt(String(formData.get("year") ?? ""), 10);
  const m = Number.parseInt(String(formData.get("month") ?? ""), 10);
  if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) return null;
  return { year: y, month: m };
}

export async function setMonthlyPaymentMark(formData: FormData) {
  const userId = await requireUserId();
  const playerId = String(formData.get("playerId") ?? "");
  const ym = parseYm(formData);
  const marked = formData.get("marked") === "true";
  if (!playerId || !ym) return;

  const ok = await prisma.player.findFirst({
    where: { id: playerId, userId },
    select: { id: true },
  });
  if (!ok) return;

  if (marked) {
    await prisma.monthlyPaymentMark.upsert({
      where: {
        userId_playerId_year_month: {
          userId,
          playerId,
          year: ym.year,
          month: ym.month,
        },
      },
      create: {
        userId,
        playerId,
        year: ym.year,
        month: ym.month,
      },
      update: {},
    });
  } else {
    await prisma.monthlyPaymentMark.deleteMany({
      where: {
        userId,
        playerId,
        year: ym.year,
        month: ym.month,
      },
    });
  }

  revalidatePath("/platba");
  revalidatePath(`/platba/${ym.year}/${ym.month}`);
}
