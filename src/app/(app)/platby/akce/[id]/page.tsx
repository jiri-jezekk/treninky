import { notFound } from "next/navigation";
import { EventDetail } from "./EventDetail";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { variableSymbolEvent } from "@/lib/variable-symbol";
import type { IncomeKind } from "@/lib/player-balance";

export default async function AkceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();

  const sp = await prisma.sharedPayment.findFirst({
    where: { id, userId },
    include: {
      user: { select: { bankIban: true, clubName: true } },
      participants: {
        include: {
          player: { select: { id: true, name: true, number: true, payToken: true } },
        },
      },
    },
  });
  if (!sp) notFound();

  const participants = sp.participants
    .map((p) => ({
      id: p.id,
      playerName: p.player.name,
      playerNumber: p.player.number,
      payToken: p.player.payToken,
      amountCents: p.amountCents,
      paid: p.paidAt != null,
      variableSymbol: variableSymbolEvent(p.player.number, sp.number),
    }))
    .sort(
      (a, b) =>
        Number(a.paid) - Number(b.paid) ||
        a.playerName.localeCompare(b.playerName, "cs"),
    );

  return (
    <EventDetail
      id={sp.id}
      number={sp.number}
      title={sp.title}
      description={sp.description}
      archived={sp.archived}
      incomeKind={sp.incomeKind as IncomeKind}
      iban={sp.user.bankIban}
      clubName={sp.user.clubName?.trim() || "DC Liberec"}
      participants={participants}
    />
  );
}
