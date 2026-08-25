"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { parseCzkToCentsCeilWholeKoruny } from "@/lib/money";
import { splitTotalCentsCeilWholeKc } from "@/lib/split";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  totalKc: z.string().min(1),
  playerIds: z.array(z.string()).min(1, "Vyberte alespoň jednoho hráče."),
});

/**
 * Nejnižší volné číslo akce v klubu — druhá část variabilního symbolu.
 * Čísla se po smazání akce recyklují, aby VS nerostly zbytečně.
 */
async function nextEventNumber(userId: string): Promise<number> {
  const taken = await prisma.sharedPayment.findMany({
    where: { userId },
    select: { number: true },
    orderBy: { number: "asc" },
  });
  let expected = 1;
  for (const { number } of taken) {
    if (number > expected) break;
    if (number === expected) expected++;
  }
  return expected;
}

type IncomeKindValue = "MEMBERSHIP" | "TRAINING" | "EVENT" | "GOODS" | "OTHER";

const INCOME_KIND_VALUES: IncomeKindValue[] = [
  "MEMBERSHIP",
  "TRAINING",
  "EVENT",
  "GOODS",
  "OTHER",
];

/** Druh příjmu z formuláře; neznámou hodnotu bere jako akci. */
function incomeKindFromForm(formData: FormData): IncomeKindValue {
  const raw = String(formData.get("incomeKind") ?? "");
  return INCOME_KIND_VALUES.includes(raw as IncomeKindValue)
    ? (raw as IncomeKindValue)
    : "EVENT";
}

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
  const totalCents = parseCzkToCentsCeilWholeKoruny(parsed.data.totalKc.replace(",", "."));
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

  const amounts = splitTotalCentsCeilWholeKc(totalCents, players.length);
  const splitTotal = amounts.reduce((a, b) => a + b, 0);

  const sp = await prisma.sharedPayment.create({
    data: {
      userId,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      totalAmountCents: splitTotal,
      number: await nextEventNumber(userId),
      incomeKind: incomeKindFromForm(formData),
      participants: {
        create: players.map((p, i) => ({
          playerId: p.id,
          amountCents: amounts[i]!,
        })),
      },
    },
  });

  revalidatePath("/platby");
  redirect(`/platby/akce/${sp.id}`);
}

/** Uloží částky všech účastníků a přepočítá celkový součet platby. */
export async function updateSharedPaymentAmounts(formData: FormData) {
  const userId = await requireUserId();
  const sharedPaymentId = String(formData.get("sharedPaymentId") ?? "").trim();
  if (!sharedPaymentId) throw new Error("Chybí platba.");

  const sp = await prisma.sharedPayment.findFirst({
    where: { id: sharedPaymentId, userId },
    include: { participants: true },
  });
  if (!sp) throw new Error("Záznam nenalezen.");

  const updates: { id: string; amountCents: number }[] = [];
  for (const p of sp.participants) {
    const raw = String(formData.get(`amount_${p.id}`) ?? "").trim();
    const cents = parseCzkToCentsCeilWholeKoruny(raw.replace(",", "."));
    if (cents === null || cents < 0) {
      throw new Error("Neplatná částka u jednoho z hráčů.");
    }
    updates.push({ id: p.id, amountCents: cents });
  }

  const sum = updates.reduce((s, u) => s + u.amountCents, 0);
  if (sum <= 0) throw new Error("Součet částek musí být větší než nula.");

  await prisma.$transaction([
    ...updates.map((u) =>
      prisma.sharedPaymentParticipant.update({
        where: { id: u.id },
        data: { amountCents: u.amountCents },
      }),
    ),
    prisma.sharedPayment.update({
      where: { id: sharedPaymentId },
      data: { totalAmountCents: sum },
    }),
  ]);

  revalidatePath("/platby");
  revalidatePath(`/platby/akce/${sharedPaymentId}`);
}

export async function redistributeSharedPaymentEvenly(sharedPaymentId: string) {
  const userId = await requireUserId();
  const sp = await prisma.sharedPayment.findFirst({
    where: { id: sharedPaymentId, userId },
    include: { participants: true },
  });
  if (!sp) throw new Error("Záznam nenalezen.");
  const n = sp.participants.length;
  if (n === 0) return;

  const amounts = splitTotalCentsCeilWholeKc(sp.totalAmountCents, n);
  const sorted = [...sp.participants].sort((a, b) => a.id.localeCompare(b.id));
  const newTotal = amounts.reduce((a, b) => a + b, 0);

  await prisma.$transaction([
    ...sorted.map((p, i) =>
      prisma.sharedPaymentParticipant.update({
        where: { id: p.id },
        data: { amountCents: amounts[i]! },
      }),
    ),
    prisma.sharedPayment.update({
      where: { id: sharedPaymentId },
      data: { totalAmountCents: newTotal },
    }),
  ]);

  revalidatePath("/platby");
  revalidatePath(`/platby/akce/${sharedPaymentId}`);
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

  revalidatePath("/platby");
  revalidatePath(`/platby/akce/${part.sharedPaymentId}`);
}

export async function setSharedPaymentArchived(sharedPaymentId: string, archived: boolean) {
  const userId = await requireUserId();
  await prisma.sharedPayment.updateMany({
    where: { id: sharedPaymentId, userId },
    data: { archived },
  });
  revalidatePath("/platby");
  revalidatePath(`/platby/akce/${sharedPaymentId}`);
}

export async function deleteSharedPayment(sharedPaymentId: string) {
  const userId = await requireUserId();
  await prisma.sharedPayment.deleteMany({
    where: { id: sharedPaymentId, userId },
  });
  revalidatePath("/platby");
}

/**
 * Účetní druh příjmu akce. Rozhoduje, kam částka spadne v sestavě pro
 * účetní — členské příspěvky mají jiný daňový režim než dresy.
 */
export async function setSharedPaymentIncomeKind(
  sharedPaymentId: string,
  formData: FormData,
) {
  const userId = await requireUserId();
  const raw = String(formData.get("incomeKind") ?? "");
  if (!INCOME_KIND_VALUES.includes(raw as IncomeKindValue)) return;

  await prisma.sharedPayment.updateMany({
    where: { id: sharedPaymentId, userId },
    data: { incomeKind: raw as IncomeKindValue },
  });
  revalidatePath("/platby");
  revalidatePath(`/platby/akce/${sharedPaymentId}`);
}
