import Link from "next/link";
import { notFound } from "next/navigation";
import { DuelDetail } from "@/components/DuelDetail";
import { getDuelDetail } from "@/lib/rating";
import { formatDateDdMmYyyy } from "@/lib/date-display";
import { requireUserId } from "@/lib/session";

/** Detail duelu pro trenéra — proklik z profilu hráče. */
export default async function DuelDetailPage({
  params,
}: {
  params: Promise<{ duelId: string }>;
}) {
  const { duelId } = await params;
  const userId = await requireUserId();

  const duel = await getDuelDetail(userId, duelId);
  if (!duel) notFound();

  return (
    <>
      <Link
        href="/rating"
        className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4"
      >
        ← Rating
      </Link>
      <div className="mt-4">
        <DuelDetail
          duel={{
            ...duel,
            when: formatDateDdMmYyyy(duel.createdAt),
            confirmedWhen:
              duel.confirmedAt == null
                ? null
                : formatDateDdMmYyyy(duel.confirmedAt),
          }}
        />
      </div>
    </>
  );
}
