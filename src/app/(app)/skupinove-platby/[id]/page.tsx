import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedPaymentParticipantsEditor } from "@/components/SharedPaymentParticipantsEditor";
import { SharedPaymentUniversalQrPanel } from "@/components/SharedPaymentUniversalQrPanel";
import { Panel } from "@/components/ui";
import { formatCzkFromCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { splitTotalCentsCeilWholeKc } from "@/lib/split";
import {
  deleteSharedPayment,
  redistributeSharedPaymentEvenly,
  setSharedPaymentArchived,
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
      },
    },
  });

  if (!sp) notFound();

  const paidCount = sp.participants.filter((x) => x.paidAt != null).length;
  const totalPeople = sp.participants.length;

  const allPaid =
    sp.participants.length > 0 &&
    sp.participants.every((x) => x.paidAt != null);

  const sortedById = [...sp.participants].sort((a, b) => a.id.localeCompare(b.id));
  const evenSplit = splitTotalCentsCeilWholeKc(sp.totalAmountCents, sortedById.length);
  const universalDefaultCents = evenSplit[0] ?? 0;

  const participantRows = sp.participants.map((p) => ({
    id: p.id,
    amountCents: p.amountCents,
    paidAt: p.paidAt,
    player: p.player,
  }));

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
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
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <p className="text-slate-600">
            Celkem po účastnících:{" "}
            <span className="font-medium text-slate-800">
              {formatCzkFromCents(sp.totalAmountCents)}
            </span>
          </p>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums ${
              paidCount === totalPeople && totalPeople > 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            Zaplaceno {paidCount} / {totalPeople}
          </span>
          {sp.archived && (
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
              Archiv
            </span>
          )}
        </div>
      </div>

      <Panel>
        <h2 className="text-sm font-medium text-slate-800">Sdílené QR (hromadná platba)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Jedno QR bez jména hráče v poznámce — vhodné k rozeslání skupině. Výchozí částka odpovídá
          rovnoměrnému rozdělení celku; můžete ji upravit, QR se přepočítá.
        </p>
        <div className="mt-4">
          <SharedPaymentUniversalQrPanel
            iban={sp.user.bankIban}
            title={sp.title}
            defaultAmountCents={universalDefaultCents}
          />
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium text-slate-800">Účastníci</h2>
            <p className="mt-1 text-sm text-slate-600">
              Stejně jako u měsíční platby: nahoře „K úhradě“ s QR u každého, dole přehled „Zaplaceno“
              bez QR. Částky se po úpravě po krátké pauze uloží samy.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <SharedPaymentParticipantsEditor
            sharedPaymentId={sp.id}
            iban={sp.user.bankIban}
            title={sp.title}
            participants={participantRows}
            belowList={
              <form action={redistributeSharedPaymentEvenly.bind(null, sp.id)}>
                <button
                  type="submit"
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Rozdělit rovnoměrně podle celku
                </button>
              </form>
            }
          />
        </div>
      </Panel>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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
