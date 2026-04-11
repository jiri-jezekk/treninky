import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedPaymentQrPanel } from "@/components/SharedPaymentQrPanel";
import { Panel } from "@/components/ui";
import { formatCzkFromCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import {
  deleteSharedPayment,
  setSharedPaymentArchived,
  toggleParticipantPaid,
} from "@/actions/shared-payments";

export default async function SharedPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();

  const sp = await prisma.sharedPayment.findFirst({
    where: { id, userId },
    include: {
      user: { select: { bankIban: true } },
      participants: {
        include: { player: { select: { name: true } } },
        orderBy: { player: { name: "asc" } },
      },
    },
  });

  if (!sp) notFound();

  const allPaid =
    sp.participants.length > 0 &&
    sp.participants.every((x) => x.paidAt != null);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/skupinove-platby"
          className="text-sm text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
        >
          ← Skupinové platby
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-800">{sp.title}</h1>
        {sp.description && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
            {sp.description}
          </p>
        )}
        <p className="mt-2 text-sm text-slate-600">
          Celkem:{" "}
          <span className="text-slate-800">{formatCzkFromCents(sp.totalAmountCents)}</span>
          {sp.archived && (
            <span className="ml-2 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
              Archiv
            </span>
          )}
        </p>
      </div>

      <Panel>
        <h2 className="text-sm font-medium text-slate-800">Účastníci</h2>
        <p className="mt-1 text-sm text-slate-600">
          Částka na osobu je dopočítaná tak, aby součet přesně odpovídal celku.
        </p>
        <ul className="mt-4 divide-y divide-slate-100">
          {sp.participants.map((part) => (
            <li
              key={part.id}
              className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div className="min-w-[120px]">
                <div className="font-medium text-slate-800">{part.player.name}</div>
                <div className="text-sm text-slate-600">
                  {formatCzkFromCents(part.amountCents)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <SharedPaymentQrPanel
                  iban={sp.user.bankIban}
                  title={sp.title}
                  playerName={part.player.name}
                  amountCents={part.amountCents}
                />
                <form action={toggleParticipantPaid.bind(null, part.id, !part.paidAt)}>
                  <button
                    type="submit"
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      part.paidAt
                        ? "border-slate-200 text-slate-700 hover:bg-slate-50"
                        : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    {part.paidAt ? "Zrušit zaplaceno" : "Označit zaplaceno"}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="flex flex-wrap gap-3">
        <form action={setSharedPaymentArchived.bind(null, id, !sp.archived)}>
          <button
            type="submit"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
          >
            {sp.archived ? "Vyjmout z archivu" : "Archivovat ručně"}
          </button>
        </form>
        {allPaid && (
          <p className="self-center text-sm text-slate-600">
            Všichni zaplatili — záznam je v archivu.
          </p>
        )}
        <form action={deleteSharedPayment.bind(null, id)}>
          <button
            type="submit"
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-red-50 hover:text-red-900"
          >
            Smazat událost
          </button>
        </form>
      </div>
    </div>
  );
}
