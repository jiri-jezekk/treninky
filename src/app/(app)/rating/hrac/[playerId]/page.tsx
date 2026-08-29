import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerProfile } from "@/components/PlayerProfile";
import { getActiveSeason, getPlayerActivity } from "@/lib/rating";
import { formatDateDdMmYyyy } from "@/lib/date-display";
import { requireUserId } from "@/lib/session";

/**
 * Profil hráče pro trenéra — co za sezónu udělal a jak se mu hnul rating.
 * Otevírá se kliknutím na jméno v žebříčku.
 */
export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const userId = await requireUserId();

  const season = await getActiveSeason(userId);
  const profile = await getPlayerActivity(userId, season, playerId);
  if (!profile) notFound();

  return (
    <>
      <Link
        href="/rating"
        className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4"
      >
        ← Rating
      </Link>
      <div className="mt-4">
        <PlayerProfile
          profile={{
            ...profile,
            entries: profile.entries.map((e) => ({
              ...e,
              when: formatDateDdMmYyyy(e.createdAt).slice(0, 5),
              duelHref: e.duelId ? `/rating/duel/${e.duelId}` : null,
            })),
            solos: profile.solos.map((s) => ({
              id: s.id,
              name: s.name,
              when: formatDateDdMmYyyy(s.performedOn).slice(0, 5),
            })),
          }}
        />
      </div>
    </>
  );
}
