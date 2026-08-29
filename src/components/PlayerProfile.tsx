import { czPlural, initials } from "@/lib/czech";

/**
 * Profil hráče — co za sezónu udělal a jak se mu hnul rating.
 *
 * Dřív visel pod žebříčkem jeden dlouhý výpis změn celého týmu.
 * Nedalo se v něm nic najít a stránka kvůli němu neměla konce.
 * Tohle je totéž po jednom hráči, dostupné kliknutím na jméno.
 *
 * Bez „use client“: nic se tu nekliká, jen se vypisuje. Používá to
 * aplikace trenéra i odkaz hráče, proto to sedí v components.
 */

export type ProfileRow = {
  playerName: string;
  inRating: boolean;
  seasonName: string | null;
  rating: number;
  rank: number | null;
  band: string;
  fromEvents: number;
  fromAttendance: number;
  attendanceCount: number;
  gymCount: number;
  soloCount: number;
  duelsWon: number;
  duelsLost: number;
  entries: {
    id: string;
    source: string;
    delta: number;
    ratingAfter: number;
    label: string;
    when: string;
  }[];
  solos: { id: string; name: string; when: string }[];
};

const SOURCE_LABEL: Record<string, string> = {
  DUEL: "Duel",
  MATCH: "Zápas",
  CHALLENGE: "Výzva",
  COACH: "Trenér",
};

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
const card = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";

function znamenko(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function tonDelta(n: number): string {
  return n > 0 ? "text-emerald-800" : n < 0 ? "text-red-800" : "text-slate-500";
}

export function PlayerProfile({ profile }: { profile: ProfileRow }) {
  const zapasu = profile.duelsWon + profile.duelsLost;

  return (
    <>
      <section className={card}>
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-club-line bg-club-soft font-heading text-sm font-extrabold text-club">
            {initials(profile.playerName)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-lg font-extrabold text-slate-900">
              {profile.playerName}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {profile.seasonName ?? "Bez sezóny"}
              {profile.rank != null && ` · ${profile.rank}. v žebříčku`}
              {` · ${profile.band}`}
            </p>
          </div>
          <span className="shrink-0 text-right">
            <span className="block font-heading text-2xl font-extrabold tabular-nums text-slate-900">
              {profile.rating}
            </span>
            <span className={`${label} block`}>rating</span>
          </span>
        </div>

        {!profile.inRating && (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Tenhle hráč je z ratingu vyřazený, takže v žebříčku není.
          </p>
        )}

        {/* Odkud se rating vzal. Bez rozpadu je to jen číslo,
            o kterém se dá leda hádat. */}
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Box
            title="Z duelů a zápasů"
            value={znamenko(profile.fromEvents)}
            tone={tonDelta(profile.fromEvents)}
          />
          <Box
            title="Z docházky"
            value={znamenko(profile.fromAttendance)}
            note={`${profile.attendanceCount}× účast`}
            tone={tonDelta(profile.fromAttendance)}
          />
          <Box
            title="Posilovna"
            value={String(profile.gymCount)}
            note="v klubu"
          />
          <Box
            title="Sám"
            value={String(profile.soloCount)}
            note="individuálně"
          />
        </dl>

        {zapasu > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Duely: {profile.duelsWon}{" "}
            {czPlural(profile.duelsWon, "výhra", "výhry", "výher")},{" "}
            {profile.duelsLost}{" "}
            {czPlural(profile.duelsLost, "prohra", "prohry", "proher")}.
          </p>
        )}
      </section>

      <section className={`${card} mt-4`}>
        <h2 className={label}>Změny ratingu</h2>
        {profile.entries.length === 0 ? (
          <p className="mt-3 text-sm italic text-slate-500">
            Zatím žádná změna. Rating se hne po prvním potvrzeném duelu,
            zápase nebo uzavřené výzvě.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {profile.entries.map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-2">
                <span className="w-16 shrink-0 text-xs tabular-nums text-slate-500">
                  {e.when}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-800">
                    {e.label}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {SOURCE_LABEL[e.source] ?? e.source} · nový rating{" "}
                    {e.ratingAfter}
                  </span>
                </span>
                <span
                  className={`shrink-0 font-heading text-sm font-bold tabular-nums ${tonDelta(e.delta)}`}
                >
                  {znamenko(e.delta)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs italic text-slate-500">
          Body za docházku se sem nepíšou — dopočítávají se, aby se samy
          srovnaly, když trenér účast dodatečně opraví.
        </p>
      </section>

      {profile.solos.length > 0 && (
        <section className={`${card} mt-4`}>
          <h2 className={label}>Individuální tréninky</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {profile.solos.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-16 shrink-0 text-xs tabular-nums text-slate-500">
                  {s.when}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-800">
                  {s.name}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Box({
  title,
  value,
  note,
  tone,
}: {
  title: string;
  value: string;
  note?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 px-3 py-2">
      <dt className={label}>{title}</dt>
      <dd
        className={`mt-1 font-heading text-lg font-extrabold tabular-nums ${tone ?? "text-slate-900"}`}
      >
        {value}
      </dd>
      {note && <p className="text-xs text-slate-500">{note}</p>}
    </div>
  );
}
