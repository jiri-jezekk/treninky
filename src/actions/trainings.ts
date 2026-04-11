"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AttendanceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  combineDdMmYyyyAndTime24h,
  parseDdMmYyyyAtNoon,
  parseTime24h,
} from "@/lib/date-display";
import { requireUserId } from "@/lib/session";
import { parseCzkToCents } from "@/lib/money";

export async function createTraining(formData: FormData) {
  const userId = await requireUserId();
  const dateStr = String(formData.get("startDate") ?? "").trim();
  const timeStr = String(formData.get("time") ?? "").trim();
  let startsAt: Date;
  try {
    startsAt = combineDdMmYyyyAndTime24h(dateStr, timeStr);
  } catch {
    throw new Error("Neplatné datum nebo čas. Použijte DD/MM/YYYY a HH:mm (24 h).");
  }
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const priceRaw = String(formData.get("customPrice") ?? "").trim();
  const defaultPriceCents =
    priceRaw === "" ? null : parseCzkToCents(priceRaw.replace(",", "."));
  if (defaultPriceCents === null && priceRaw !== "") {
    throw new Error("Neplatná cena tréninku.");
  }
  const training = await prisma.training.create({
    data: {
      userId,
      startsAt,
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
  const y = training.startsAt.getFullYear();
  const m = training.startsAt.getMonth() + 1;
  redirect(`/treninky?mesic=${y}-${String(m).padStart(2, "0")}`);
}

/** Vygeneruje tréninky na úterý a čtvrtek — ceny automaticky (110 / 100 Kč, junioři 60 Kč). */
export async function generateTuesdayThursdayTrainings(formData: FormData) {
  const userId = await requireUserId();
  const startDateRaw = String(formData.get("startDate") ?? "").trim();
  const endDateRaw = String(formData.get("endDate") ?? "").trim();
  const timeRaw = String(formData.get("time") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const start = parseDdMmYyyyAtNoon(startDateRaw);
  const end = parseDdMmYyyyAtNoon(endDateRaw);
  if (!start || !end) {
    throw new Error("Neplatné datum Od nebo Do. Použijte DD/MM/YYYY.");
  }
  if (end < start) throw new Error("Konec období musí být po začátku.");

  const tm = parseTime24h(timeRaw);
  if (!tm) throw new Error("Neplatný čas. Použijte HH:mm (24 h).");
  const th = tm.hour;
  const tmin = tm.minute;

  const dates: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow === 2 || dow === 4) {
      const slot = new Date(cur);
      slot.setHours(th, tmin, 0, 0);
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
        defaultPriceCents: null,
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
  const rm = String(formData.get("redirectMesic") ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(rm)) {
    redirect(`/treninky?mesic=${rm}`);
  }
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

export async function deleteTraining(trainingId: string) {
  const userId = await requireUserId();
  await prisma.training.deleteMany({
    where: { id: trainingId, userId },
  });
  revalidatePath("/treninky");
  revalidatePath("/statistiky");
  revalidatePath("/platba");
}

/** Zaškrtnuté řádky: `trainingIds` (více stejného jména). */
export async function bulkDeleteTrainings(formData: FormData) {
  const userId = await requireUserId();
  const ids = formData
    .getAll("trainingIds")
    .map(String)
    .filter((id) => id.length > 0);
  if (ids.length === 0) return;
  await prisma.training.deleteMany({
    where: { userId, id: { in: ids } },
  });
  revalidatePath("/treninky");
  revalidatePath("/statistiky");
  revalidatePath("/platba");
}

/** Hromadně přítomen / nepřítomen pro hráče v `playerIds` (formulář z detailu tréninku). */
export async function setAttendanceBulkForTraining(formData: FormData) {
  const userId = await requireUserId();
  const trainingId = String(formData.get("trainingId") ?? "").trim();
  const bulk = formData.get("bulkPresent");
  if (bulk !== "true" && bulk !== "false") return;
  const present = bulk === "true";
  const ids = formData.getAll("playerIds").map(String).filter(Boolean);
  if (!trainingId || ids.length === 0) return;

  const t = await prisma.training.findFirst({
    where: { id: trainingId, userId },
    select: { id: true },
  });
  if (!t) throw new Error("Trénink nenalezen.");

  const status = present ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT;

  const validPlayers = await prisma.player.findMany({
    where: { userId, active: true, id: { in: ids } },
    select: { id: true },
  });
  const validIds = new Set(validPlayers.map((p) => p.id));

  await prisma.$transaction(
    ids
      .filter((id) => validIds.has(id))
      .map((playerId) =>
        prisma.attendance.upsert({
          where: {
            trainingId_playerId: { trainingId, playerId },
          },
          create: { trainingId, playerId, status },
          update: { status },
        }),
      ),
  );

  revalidatePath(`/treninky/${trainingId}`);
  revalidatePath("/treninky");
  revalidatePath("/statistiky");
  revalidatePath("/platba");
}

export async function setAttendancePresent(
  trainingId: string,
  playerId: string,
  present: boolean,
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

  const status = present ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT;

  await prisma.attendance.upsert({
    where: {
      trainingId_playerId: { trainingId, playerId },
    },
    create: { trainingId, playerId, status },
    update: { status },
  });
  revalidatePath(`/treninky/${trainingId}`);
  revalidatePath("/treninky");
  revalidatePath("/statistiky");
  revalidatePath("/platba");
}
