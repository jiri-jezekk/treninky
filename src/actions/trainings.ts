"use server";

import { revalidatePath } from "next/cache";
import { AttendanceStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { parseCzkToCents } from "@/lib/money";

function parseLocalDateTime(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Neplatné datum a čas.");
  return d;
}

export async function createTraining(formData: FormData) {
  const userId = await requireUserId();
  const startsAtRaw = String(formData.get("startsAt") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const priceRaw = String(formData.get("defaultPrice") ?? "").trim();
  const defaultPriceCents =
    priceRaw === "" ? null : parseCzkToCents(priceRaw.replace(",", "."));
  if (defaultPriceCents === null && priceRaw !== "") {
    throw new Error("Neplatná cena tréninku.");
  }
  const training = await prisma.training.create({
    data: {
      userId,
      startsAt: parseLocalDateTime(startsAtRaw),
      notes,
      defaultPriceCents,
    },
  });
  const players = await prisma.player.findMany({
    where: { userId, active: true },
    select: { id: true },
  });
  if (players.length > 0) {
    await prisma.attendance.createMany({
      data: players.map((p) => ({
        trainingId: training.id,
        playerId: p.id,
        status: AttendanceStatus.ABSENT,
      })),
    });
  }
  revalidatePath("/treninky");
}

const rangeSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  time: z.string().min(1),
  defaultPrice: z.string().optional(),
  notes: z.string().optional(),
});

/** Vygeneruje tréninky na úterý a čtvrtek v rozmezí dat (včetně). */
export async function generateTuesdayThursdayTrainings(formData: FormData) {
  const userId = await requireUserId();
  const parsed = rangeSchema.safeParse({
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    time: formData.get("time"),
    defaultPrice: formData.get("defaultPrice"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) throw new Error("Vyplňte období a čas.");

  const priceRaw = String(parsed.data.defaultPrice ?? "").trim();
  const defaultPriceCents =
    priceRaw === "" ? null : parseCzkToCents(priceRaw.replace(",", "."));
  if (defaultPriceCents === null && priceRaw !== "") {
    throw new Error("Neplatná výchozí cena.");
  }
  const notes = String(parsed.data.notes ?? "").trim() || null;

  const start = new Date(parsed.data.startDate + "T12:00:00");
  const end = new Date(parsed.data.endDate + "T12:00:00");
  if (end < start) throw new Error("Konec období musí být po začátku.");

  const [th, tm] = parsed.data.time.split(":").map((x) => Number.parseInt(x, 10));
  if (Number.isNaN(th) || Number.isNaN(tm)) throw new Error("Neplatný čas.");

  const dates: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow === 2 || dow === 4) {
      const slot = new Date(cur);
      slot.setHours(th, tm, 0, 0);
      dates.push(slot);
    }
    cur.setDate(cur.getDate() + 1);
  }

  const players = await prisma.player.findMany({
    where: { userId, active: true },
    select: { id: true },
  });

  for (const startsAt of dates) {
    const training = await prisma.training.create({
      data: {
        userId,
        startsAt,
        notes,
        defaultPriceCents,
      },
    });
    if (players.length > 0) {
      await prisma.attendance.createMany({
        data: players.map((p) => ({
          trainingId: training.id,
          playerId: p.id,
          status: AttendanceStatus.ABSENT,
        })),
      });
    }
  }

  revalidatePath("/treninky");
}

export async function setTrainingCancelled(trainingId: string, cancelled: boolean) {
  const userId = await requireUserId();
  await prisma.training.updateMany({
    where: { id: trainingId, userId },
    data: { cancelled },
  });
  revalidatePath("/treninky");
  revalidatePath(`/treninky/${trainingId}`);
}

export async function setAttendance(
  trainingId: string,
  playerId: string,
  status: AttendanceStatus,
) {
  const userId = await requireUserId();
  const t = await prisma.training.findFirst({
    where: { id: trainingId, userId },
    select: { id: true },
  });
  if (!t) throw new Error("Trénink nenalezen.");
  const p = await prisma.player.findFirst({
    where: { id: playerId, userId },
    select: { id: true },
  });
  if (!p) throw new Error("Hráč nenalezen.");

  await prisma.attendance.upsert({
    where: {
      trainingId_playerId: { trainingId, playerId },
    },
    create: { trainingId, playerId, status },
    update: { status },
  });
  revalidatePath(`/treninky/${trainingId}`);
  revalidatePath("/statistiky");
}

export async function upsertTrainingBilling(
  trainingId: string,
  playerId: string,
  formData: FormData,
) {
  const userId = await requireUserId();
  const t = await prisma.training.findFirst({
    where: { id: trainingId, userId },
    select: { id: true },
  });
  if (!t) throw new Error("Trénink nenalezen.");
  const playerOk = await prisma.player.findFirst({
    where: { id: playerId, userId },
    select: { id: true },
  });
  if (!playerOk) throw new Error("Hráč nenalezen.");

  const prepaid = formData.get("prepaid") === "on";
  const priceRaw = String(formData.get("price") ?? "").trim();
  const priceCents =
    priceRaw === "" ? null : parseCzkToCents(priceRaw.replace(",", "."));

  if (priceCents === null && priceRaw !== "") {
    throw new Error("Neplatná cena u hráče.");
  }

  await prisma.trainingPlayerBilling.upsert({
    where: {
      trainingId_playerId: { trainingId, playerId },
    },
    create: {
      trainingId,
      playerId,
      prepaid,
      priceCents: prepaid ? null : priceCents,
    },
    update: {
      prepaid,
      priceCents: prepaid ? null : priceCents,
    },
  });
  revalidatePath(`/treninky/${trainingId}`);
}
