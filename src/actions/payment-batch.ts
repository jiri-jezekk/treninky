"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getPlayerBalance, type BalanceItem } from "@/lib/player-balance";
import { hasPortalSession } from "@/lib/player-portal-session";
import { variableSymbolBatch } from "@/lib/variable-symbol";

/**
 * Otisk sady položek. Slouží k tomu, aby se při opakovaném kliknutí
 * nezakládala pořád nová souhrnná platba na tytéž věci.
 */
function signature(items: { key: string; amountCents: number }[]): string {
  return items
    .map((i) => `${i.key}:${i.amountCents}`)
    .sort()
    .join("|");
}

/** Musí vracet stejné klíče jako `BalanceItem.key`, jinak se otisk nesejde. */
function signatureOfStored(
  items: {
    year: number | null;
    month: number | null;
    sharedPaymentId: string | null;
    prepaymentId: string | null;
    amountCents: number;
  }[],
): string {
  return items
    .map((i) => {
      const key =
        i.prepaymentId != null
          ? `p-${i.prepaymentId}`
          : i.sharedPaymentId != null
            ? `e-${i.sharedPaymentId}`
            : `m-${i.year}-${i.month}`;
      return `${key}:${i.amountCents}`;
    })
    .sort()
    .join("|");
}

/** Nejnižší volné pořadí souhrnné platby pro hráče. */
async function nextSequence(playerId: string): Promise<number> {
  const count = await prisma.paymentBatch.count({ where: { playerId } });
  return Math.min(999, count + 1);
}

export type BatchResult =
  | { ok: true; variableSymbol: string; totalCents: number }
  | { ok: false; error: string };

/**
 * Připraví jednu platbu za všechno, co hráč dluží.
 *
 * Rozpad položek se ukládá — právě on dělá ze souhrnné částky doložitelný
 * účetní záznam. Bez něj by ve výpisu byla jedna částka, kterou by musel
 * někdo ručně rozdělit mezi členské příspěvky a ostatní příjmy.
 */
export async function ensurePaymentBatch(payToken: string): Promise<BatchResult> {
  if (!(await hasPortalSession(payToken))) {
    return { ok: false, error: "Přihlášení vypršelo, načtěte stránku znovu." };
  }

  const player = await prisma.player.findUnique({
    where: { payToken },
    select: { id: true, number: true, userId: true },
  });
  if (!player) return { ok: false, error: "Odkaz je neplatný." };

  const balance = await getPlayerBalance(player.userId, player.id);
  if (!balance || balance.unpaid.length === 0) {
    return { ok: false, error: "Není co platit." };
  }

  const sig = signature(balance.unpaid);

  const open = await prisma.paymentBatch.findMany({
    where: { playerId: player.id, paidAt: null },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  for (const batch of open) {
    if (signatureOfStored(batch.items) === sig) {
      return {
        ok: true,
        variableSymbol: batch.vs,
        totalCents: batch.totalCents,
      };
    }
  }

  const vs = variableSymbolBatch(player.number, await nextSequence(player.id));
  const created = await prisma.paymentBatch.create({
    data: {
      userId: player.userId,
      playerId: player.id,
      vs,
      totalCents: balance.totalCents,
      items: {
        create: balance.unpaid.map((i: BalanceItem) => ({
          kind: i.incomeKind,
          label: i.label,
          amountCents: i.amountCents,
          year: i.year ?? null,
          month: i.month ?? null,
          sharedPaymentId: i.sharedPaymentId ?? null,
          prepaymentId: i.prepaymentId ?? null,
        })),
      },
    },
    select: { vs: true, totalCents: true },
  });

  revalidatePath(`/p/${payToken}`);
  return { ok: true, variableSymbol: created.vs, totalCents: created.totalCents };
}
