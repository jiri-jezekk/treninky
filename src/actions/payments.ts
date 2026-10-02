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

/** Rozloží `BalanceItem.key` zpět na zdroj položky. */
function parseItemKey(
  key: string,
):
  | { kind: "monthly"; year: number; month: number }
  | { kind: "event"; sharedPaymentId: string }
  | { kind: "prepaid"; prepaymentId: string }
  | null {
  const m = /^m-(\d{4})-(\d{1,2})$/.exec(key);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    return month >= 1 && month <= 12 ? { kind: "monthly", year, month } : null;
  }
  if (key.startsWith("e-") && key.length > 2) {
    return { kind: "event", sharedPaymentId: key.slice(2) };
  }
  if (key.startsWith("p-") && key.length > 2) {
    return { kind: "prepaid", prepaymentId: key.slice(2) };
  }
  return null;
}

/**
 * Označí jednu položku dluhu jako zaplacenou, nebo označení zruší.
 * Na rozdíl od „vše zaplaceno“ jde o jedinou věc — hráč poslal
 * za ubytování, tréninky ještě dluží.
 */
export async function setPaymentItemPaid(
  playerId: string,
  key: string,
  paid: boolean,
) {
  const userId = await requireUserId();
  const item = parseItemKey(key);
  if (!item) return;

  const owned = await prisma.player.findFirst({
    where: { id: playerId, userId },
    select: { id: true },
  });
  if (!owned) return;

  if (item.kind === "monthly") {
    const { year, month } = item;
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
  } else if (item.kind === "event") {
    const { sharedPaymentId } = item;
    const updated = await prisma.sharedPaymentParticipant.updateMany({
      where: { sharedPaymentId, playerId, sharedPayment: { userId } },
      data: { paidAt: paid ? new Date() : null },
    });
    if (updated.count > 0) {
      // Stejně jako v detailu akce: když zaplatili všichni, akce se archivuje.
      const parts = await prisma.sharedPaymentParticipant.findMany({
        where: { sharedPaymentId },
        select: { paidAt: true },
      });
      await prisma.sharedPayment.updateMany({
        where: { id: sharedPaymentId, userId },
        data: { archived: parts.length > 0 && parts.every((p) => p.paidAt) },
      });
      revalidatePath(`/platby/akce/${sharedPaymentId}`);
    }
  } else {
    await prisma.prepayment.updateMany({
      where: { id: item.prepaymentId, playerId, userId },
      data: { paidAt: paid ? new Date() : null },
    });
    revalidatePath("/platby/predplatne");
  }

  revalidatePayments();
}

/**
 * Skryje položku hráči, nebo ji zase ukáže. Dluhem zůstává — jen ji
 * hráč nevidí v odkazu a nezaplatí ji souhrnnou platbou.
 */
export async function setPaymentItemHidden(
  playerId: string,
  key: string,
  hidden: boolean,
) {
  const userId = await requireUserId();
  if (!parseItemKey(key)) return;

  const player = await prisma.player.findFirst({
    where: { id: playerId, userId },
    select: { id: true, payToken: true },
  });
  if (!player) return;

  if (hidden) {
    await prisma.hiddenPaymentItem.upsert({
      where: { playerId_key: { playerId, key } },
      create: { userId, playerId, key },
      update: {},
    });
  } else {
    await prisma.hiddenPaymentItem.deleteMany({
      where: { userId, playerId, key },
    });
  }

  revalidatePayments();
  revalidatePath(`/p/${player.payToken}`);
}

/**
 * Nastaví dohodnutou splatnost položky („RRRR-MM-DD“), prázdná hodnota
 * ji zruší. Do toho dne hráč položku vidí jako „později“.
 */
export async function setPaymentItemDue(
  playerId: string,
  key: string,
  dueOn: string,
) {
  const userId = await requireUserId();
  if (!parseItemKey(key)) return;

  const player = await prisma.player.findFirst({
    where: { id: playerId, userId },
    select: { id: true, payToken: true },
  });
  if (!player) return;

  if (dueOn === "") {
    await prisma.paymentItemDue.deleteMany({ where: { userId, playerId, key } });
  } else {
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(dueOn)) return;
    const date = new Date(`${dueOn}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dueOn) {
      return;
    }
    await prisma.paymentItemDue.upsert({
      where: { playerId_key: { playerId, key } },
      create: { userId, playerId, key, dueOn: date },
      update: { dueOn: date },
    });
  }

  revalidatePayments();
  revalidatePath(`/p/${player.payToken}`);
}

/**
 * Označí vše, co hráč dluží, jako zaplacené — měsíce i akce najednou.
 * Používá stejný výpočet jako přehled dlužníků, aby se označilo přesně to,
 * co je tam vidět.
 */
export async function markPlayerAllPaid(playerId: string) {
  const userId = await requireUserId();
  // Bez oříznutí na sezónu — trenér označuje i starší dluhy, které
  // hráč ve svém odkazu nevidí.
  const balance = await getPlayerBalance(userId, playerId);
  if (!balance) return;

  // Jen splatné. Položka s pozdější splatností zůstává otevřená —
  // hráč zaplatil to, co po něm teď chceme, a zbytek se zaškrtne sám.
  const months = balance.unpaid.filter((i) => i.kind === "monthly");
  const events = balance.unpaid.filter((i) => i.kind === "event");
  const prepaid = balance.unpaid.filter((i) => i.kind === "prepaid");

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
    // Předplatné patří do „vše zaplaceno“ stejně jako měsíce a akce —
    // jinak by zůstalo viset nezaplacené, ačkoli přehled hlásí vyrovnáno.
    for (const p of prepaid) {
      if (!p.prepaymentId) continue;
      await tx.prepayment.updateMany({
        where: { id: p.prepaymentId, userId },
        data: { paidAt: new Date() },
      });
    }
  });

  revalidatePayments();
}
