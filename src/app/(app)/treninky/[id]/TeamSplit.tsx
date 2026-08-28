"use client";

import { useState, useTransition } from "react";
import { clearTeams, saveTeams, shuffleTeams } from "@/actions/training-plan";
import { initials } from "@/lib/czech";
import { moveToNextTeam, teamName, type TeamAssignment } from "@/lib/training-plan";

export type SplitPlayerRow = {
  id: string;
  name: string;
  present: boolean;
};

const mini =
  "rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900";

/** Barva týmu — jen odlišení, nic víc. */
const TEAM_TONE = [
  "border-club-line bg-club-soft text-slate-800",
  "border-amber-300 bg-amber-50 text-amber-900",
  "border-emerald-200 bg-emerald-50 text-emerald-800",
  "border-red-200 bg-red-50 text-red-800",
];

export function TeamSplit({
  blockId,
  players,
  initialTeams,
}: {
  blockId: string;
  players: SplitPlayerRow[];
  initialTeams: TeamAssignment[];
}) {
  const [teams, setTeams] = useState<TeamAssignment[]>(initialTeams);
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);

  // Po uložení na serveru má přednost, co přišlo zpátky.
  const [lastServer, setLastServer] = useState(initialTeams);
  if (lastServer !== initialTeams) {
    setLastServer(initialTeams);
    setTeams(initialTeams);
    setDirty(false);
  }

  const byId = new Map(players.map((p) => [p.id, p]));
  const assigned = new Set(teams.flatMap((t) => t.playerIds));
  const pool = players.filter((p) => !assigned.has(p.id));

  function cycle(playerId: string) {
    const base =
      teams.length > 0
        ? teams
        : [
            { name: teamName(0), playerIds: [] },
            { name: teamName(1), playerIds: [] },
          ];
    setTeams(moveToNextTeam(base, playerId));
    setDirty(true);
  }

  function persist() {
    startTransition(async () => {
      await saveTeams(blockId, teams);
      setDirty(false);
    });
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <form action={shuffleTeams.bind(null, blockId)} className="flex gap-2">
          <select
            name="teamCount"
            defaultValue={String(Math.max(2, teams.length || 2))}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-900"
            aria-label="Počet týmů"
          >
            {[2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} týmy
              </option>
            ))}
          </select>
          <button type="submit" className={mini}>
            Rozdělit náhodně
          </button>
        </form>

        {teams.length > 0 && (
          <form action={clearTeams.bind(null, blockId)}>
            <button type="submit" className={mini}>
              Vymazat
            </button>
          </form>
        )}

        {dirty && (
          <button
            type="button"
            onClick={persist}
            disabled={pending}
            className="rounded-full border-2 border-club bg-club px-3 py-1 font-heading text-xs font-semibold text-onclub transition hover:bg-club-hover disabled:opacity-60"
          >
            {pending ? "Ukládám…" : "Uložit rozdělení"}
          </button>
        )}
      </div>

      {teams.length === 0 ? (
        <p className="mt-3 text-xs italic text-slate-500">
          Rozděl náhodně, nebo klepni na hráče níž a rozřaď je sám.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {teams.map((t, i) => (
            <div
              key={t.name}
              className={`rounded-lg border p-2.5 ${TEAM_TONE[i] ?? TEAM_TONE[0]}`}
            >
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-heading text-[11px] font-bold uppercase tracking-wider">
                  {t.name}
                </span>
                <span className="text-xs tabular-nums opacity-70">
                  {t.playerIds.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {t.playerIds.map((id) => (
                  <PlayerChip
                    key={id}
                    name={byId.get(id)?.name ?? "?"}
                    onClick={() => cycle(id)}
                  />
                ))}
                {t.playerIds.length === 0 && (
                  <span className="text-xs opacity-70">prázdný</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pool.length > 0 && (
        <div className="mt-3">
          <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Nezařazení
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {pool.map((p) => (
              <PlayerChip
                key={p.id}
                name={p.name}
                muted={!p.present}
                onClick={() => cycle(p.id)}
              />
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs italic text-slate-500">
        Klepnutím na hráče ho přesuneš do dalšího týmu, z posledního zase mezi
        nezařazené. Náhodné rozdělení bere přítomné — dokud není zapsaná
        docházka, počítá se všemi.
      </p>
    </div>
  );
}

function PlayerChip({
  name,
  muted,
  onClick,
}: {
  name: string;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs transition hover:border-club ${
        muted ? "text-slate-500" : "text-slate-800"
      }`}
    >
      <span className="font-heading text-[9px] font-extrabold opacity-60">
        {initials(name)}
      </span>
      {name}
    </button>
  );
}
