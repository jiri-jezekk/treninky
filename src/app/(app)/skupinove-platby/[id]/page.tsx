import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedPaymentQrPanel } from "@/components/SharedPaymentQrPanel";
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
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link
          href="/skupinove-platby"
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          ← Skupinové platby
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{sp.title}</h1>
        {sp.description && (
          <p className="mt-2 whitespace-pre-wrap text-slate-600">{sp.description}</p>
        )}
        <p className="mt-2 text-sm text-slate-600">
          Celkem:{" "}
          <strong>{formatCzkFromCents(sp.totalAmountCents)}</strong>
          {sp.archived && (
            <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-800">
              Archiv
            </span>
          )}
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Účastníci</h2>
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
                <div className="font-medium text-slate-900">{part.player.name}</div>
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
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                      part.paidAt
                        ? "border border-slate-300 text-slate-700 hover:bg-slate-50"
                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                    }`}
                  >
                    {part.paidAt ? "Zrušit zaplaceno" : "Označit zaplaceno"}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <form action={setSharedPaymentArchived.bind(null, id, !sp.archived)}>
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            {sp.archived ? "Vyjmout z archivu" : "Archivovat ručně"}
          </button>
        </form>
        {allPaid && (
          <p className="self-center text-sm text-emerald-800">
            Všichni zaplatili — záznam je v archivu.
          </p>
        )}
        <form action={deleteSharedPayment.bind(null, id)}>
          <button
            type="submit"
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50"
          >
            Smazat událost
          </button>
        </form>
      </div>
    </div>
  );
}
