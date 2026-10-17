"use client";

import { useState, useTransition } from "react";
import { clearTeams, saveTeams } from "@/actions/training-plan";
import { TeamBoard, type TeamMember } from "@/components/TeamBoard";
import { balanceTeams } from "@/lib/team-balance";
import { moveToNextTeam, teamName, type TeamAssignment } from "@/lib/training-plan";

const mini =
  "inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 px-3.5 py-1.5 text-sm text-slate-700 transition hover:border-club hover:bg-club-soft hover:text-slate-900";
const primary =
  "inline-flex min-h-10 items-center justify-center rounded-full border-2 border-club bg-club px-4 py-1.5 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover disabled:opacity-60";

/**
 * Rozdělení do týmů u herního bodu plánu. Bere přítomné ze soupisky
 * kategorie; vyrovnané rozdělení se spočítá rovnou v telefonu a uloží.
 */
export function TeamSplit({
  blockId,
  members,
  present,
  initialTeams,
}: {
  blockId: string;
  /** Celá soupiska kategorie — kvůli jménům v uložených týmech. */
  members: TeamMember[];
  /** Kdo dnes přišel. Prázdné = zatím nikdo neoznačen. */
  present: TeamMember[];
  initialTeams: TeamAssignment[];
}) {
  const [teams, setTeams] = useState<TeamAssignment[]>(initialTeams);
  const [teamCount, setTeamCount] = useState(Math.max(2, initialTeams.length || 2));
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);

  // Po uložení na serveru má přednost, co přišlo zpátky.
  const [lastServer, setLastServer] = useState(initialTeams);
  if (lastServer !== initialTeams) {
    setLastServer(initialTeams);
    setTeams(initialTeams);
    setDirty(false);
  }

  const byId = new Map(members.map((m) => [m.id, m]));
  const assigned = new Set(teams.flatMap((t) => t.playerIds));
  const pool = present.filter((m) => !assigned.has(m.id));

  function persist(next: TeamAssignment[]) {
    startTransition(async () => {
      await saveTeams(blockId, next);
      setDirty(false);
    });
  }

  function generate() {
    const next = balanceTeams(present, teamCount);
    setTeams(next);
    persist(next);
  }

  function cycle(id: string) {
    const base =
      teams.length > 0
        ? teams
        : Array.from({ length: teamCount }, (_, i) => ({
            name: teamName(i),
            playerIds: [] as string[],
          }));
    setTeams(moveToNextTeam(base, id));
    setDirty(true);
  }

  if (present.length === 0 && teams.length === 0) {
    return (
      <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-sm text-slate-500">
        Pro týmy označ nahoře, kdo dnes přišel.
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={teamCount}
          onChange={(e) => setTeamCount(Number(e.target.value))}
          className="min-h-10 rounded-lg border border-slate-200 px-2.5 py-1.5 text-base text-slate-900 sm:text-sm"
          aria-label="Počet týmů"
        >
          {[2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n} týmy
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={generate}
          disabled={pending || present.length < 2}
          className={primary}
        >
          {teams.length > 0 ? "Zamíchat znovu" : "Vyrovnané týmy"}
        </button>
        {dirty && (
          <button
            type="button"
            onClick={() => persist(teams)}
            disabled={pending}
            className={mini}
          >
            {pending ? "Ukládám…" : "Uložit úpravy"}
          </button>
        )}
        {teams.length > 0 && !dirty && (
          <form action={clearTeams.bind(null, blockId)}>
            <button type="submit" className={mini}>
              Zrušit týmy
            </button>
          </form>
        )}
      </div>

      <TeamBoard teams={teams} members={byId} pool={pool} onCycle={cycle} />

      <p className="mt-3 text-xs italic text-slate-500">
        Týmy se skládají tak, aby měly co nejpodobnější součet dovedností.
        Klepnutím na hráče ho přesuneš do dalšího týmu.
      </p>
    </div>
  );
}
