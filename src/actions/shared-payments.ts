"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { parseCzkToCents } from "@/lib/money";
import { splitTotalCents } from "@/lib/split";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  totalKc: z.string().min(1),
  playerIds: z.array(z.string()).min(1, "Vyberte alespoň jednoho hráče."),
});

export async function createSharedPayment(formData: FormData) {
  const userId = await requireUserId();
  const ids = formData.getAll("playerIds").map(String);
  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    totalKc: formData.get("totalKc"),
    playerIds: ids,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join(", ") || "Neplatný vstup.");
  }
  const totalCents = parseCzkToCents(parsed.data.totalKc.replace(",", "."));
  if (totalCents === null || totalCents <= 0) {
    throw new Error("Zadejte platnou celkovou částku.");
  }

  const players = await prisma.player.findMany({
    where: { userId, active: true, id: { in: parsed.data.playerIds } },
    select: { id: true },
  });
  if (players.length !== parsed.data.playerIds.length) {
    throw new Error("Někteří hráči nejsou platní.");
  }

  const amounts = splitTotalCents(totalCents, players.length);

  const sp = await prisma.sharedPayment.create({
    data: {
      userId,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      totalAmountCents: totalCents,
      participants: {
        create: players.map((p, i) => ({
          playerId: p.id,
          amountCents: amounts[i]!,
        })),
      },
    },
  });

  revalidatePath("/skupinove-platby");
  redirect(`/skupinove-platby/${sp.id}`);
}

export async function toggleParticipantPaid(participantId: string, paid: boolean) {
  const userId = await requireUserId();
  const part = await prisma.sharedPaymentParticipant.findFirst({
    where: { id: participantId, sharedPayment: { userId } },
    include: {
      sharedPayment: { include: { participants: true } },
    },
  });
  if (!part) throw new Error("Položka nenalezena.");

  await prisma.sharedPaymentParticipant.update({
    where: { id: participantId },
    data: { paidAt: paid ? new Date() : null },
  });

  const fresh = await prisma.sharedPaymentParticipant.findMany({
    where: { sharedPaymentId: part.sharedPaymentId },
  });
  const allPaid = fresh.length > 0 && fresh.every((x) => x.paidAt);

  await prisma.sharedPayment.update({
    where: { id: part.sharedPaymentId },
    data: { archived: allPaid },
  });

  revalidatePath("/skupinove-platby");
  revalidatePath(`/skupinove-platby/${part.sharedPaymentId}`);
}

export async function setSharedPaymentArchived(sharedPaymentId: string, archived: boolean) {
  const userId = await requireUserId();
  await prisma.sharedPayment.updateMany({
    where: { id: sharedPaymentId, userId },
    data: { archived },
  });
  revalidatePath("/skupinove-platby");
  revalidatePath(`/skupinove-platby/${sharedPaymentId}`);
}

export async function deleteSharedPayment(sharedPaymentId: string) {
  const userId = await requireUserId();
  await prisma.sharedPayment.deleteMany({
    where: { id: sharedPaymentId, userId },
  });
  revalidatePath("/skupinove-platby");
}
