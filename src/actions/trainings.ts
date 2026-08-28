"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AttendanceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  combineDdMmYyyyAndTime24h,
  parseDdMmYyyyAtNoon,
} from "@/lib/date-display";
import { requireUserId } from "@/lib/session";
import { parseCzkToCents } from "@/lib/money";
import {
  occurrenceKey,
  planTrainings,
  splitExisting,
  type Slot,
} from "@/lib/training-slots";

/** Nový trénink dostane všechny aktivní hráče jako nepřítomné. */
async function seedAttendance(trainingId: string, playerIds: string[]) {
  if (playerIds.length === 0) return;
  await prisma.attendance.createMany({
    data: playerIds.map((playerId) => ({
      trainingId,
      playerId,
      status: AttendanceStatus.ABSENT,
    })),
  });
}

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

  const endRaw = String(formData.get("endTime") ?? "").trim();
  let endsAt: Date | null = null;
  if (endRaw !== "") {
    try {
      endsAt = combineDdMmYyyyAndTime24h(dateStr, endRaw);
      // Konec po půlnoci patří na další den, jinak by vyšel před začátkem.
      if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);
    } catch {
      throw new Error("Neplatný čas konce. Použijte HH:mm (24 h).");
    }
  }

  // Dva tréninky na tentýž okamžik by hráči zdvojily platbu.
  const dayStart = new Date(startsAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const sameDay = await prisma.training.findMany({
    where: { userId, startsAt: { gte: dayStart, lt: dayEnd } },
    select: { startsAt: true },
  });
  if (sameDay.some((t) => occurrenceKey(t.startsAt) === occurrenceKey(startsAt))) {
    throw new Error("Trénink v tenhle termín už existuje.");
  }

  const training = await prisma.training.create({
    data: {
      userId,
      startsAt,
      endsAt,
      notes,
      defaultPriceCents,
      kind: formData.get("gym") === "on" ? "GYM" : "TRAINING",
    },
  });

  const players = await prisma.player.findMany({
    where: { userId, active: true },
    select: { id: true },
  });
  await seedAttendance(
    training.id,
    players.map((p) => p.id),
  );

  revalidatePath("/treninky");
  const y = training.startsAt.getFullYear();
  const m = training.startsAt.getMonth() + 1;
  redirect(`/treninky?mesic=${y}-${String(m).padStart(2, "0")}`);
}

/**
 * Vygeneruje tréninky z rozvrhu za zadané období.
 *
 * Dřív byly úterý a čtvrtek napevno v kódu a formulář měl jediné pole
 * na čas, takže rozvrh s různým časem pro každý den jím nešel zadat.
 * Teď se termíny berou z rozvrhu — i s cenou, která se do tréninku uloží,
 * aby pozdější změna ceny v rozvrhu nepřepsala už naúčtované měsíce.
 *
 * Termín, který v databázi už je, se přeskočí. Generovat se dá klidně
 * opakovaně, třeba po přidání dalšího termínu do rozvrhu.
 */
export async function generateTrainingsFromSchedule(formData: FormData) {
  const userId = await requireUserId();

  const start = parseDdMmYyyyAtNoon(String(formData.get("startDate") ?? "").trim());
  const end = parseDdMmYyyyAtNoon(String(formData.get("endDate") ?? "").trim());
  if (!start || !end) {
    throw new Error("Neplatné datum Od nebo Do. Použijte DD/MM/YYYY.");
  }
  if (end < start) throw new Error("Konec období musí být po začátku.");

  const notes = String(formData.get("notes") ?? "").trim() || null;

  // Bez zaškrtnutí se berou všechny zapnuté termíny rozvrhu.
  const chosen = formData.getAll("slotIds").map(String).filter(Boolean);
  const slots = await prisma.trainingSlot.findMany({
    where: {
      userId,
      active: true,
      ...(chosen.length > 0 && { id: { in: chosen } }),
    },
    orderBy: [{ dayOfWeek: "asc" }, { startMinutes: "asc" }],
  });
  if (slots.length === 0) {
    throw new Error("V rozvrhu není žádný zapnutý termín, ze kterého generovat.");
  }

  const planned = planTrainings(slots as Slot[], start, end);
  if (planned.length === 0) {
    throw new Error("V zadaném období nevychází podle rozvrhu žádný trénink.");
  }

  const rangeStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const rangeEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
  const existing = await prisma.training.findMany({
    where: { userId, startsAt: { gte: rangeStart, lt: rangeEnd } },
    select: { startsAt: true },
  });

  const { toCreate } = splitExisting(planned, existing);

  const players = await prisma.player.findMany({
    where: { userId, active: true },
    select: { id: true },
  });
  const playerIds = players.map((p) => p.id);

  for (const item of toCreate) {
    const training = await prisma.training.create({
      data: {
        userId,
        slotId: item.slotId,
        kind: item.kind,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        notes,
        defaultPriceCents: item.priceCents,
      },
    });
    await seedAttendance(training.id, playerIds);
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
  revalidatePath("/platby");
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
  revalidatePath("/platby");
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
  revalidatePath("/platby");
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
  revalidatePath("/platby");
}
