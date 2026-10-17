"use client";

import { czPlayers } from "@/lib/czech";
import { teamSkillSums } from "@/lib/team-balance";
import type { TeamAssignment } from "@/lib/training-plan";

export type TeamMember = {
  id: string;
  name: string;
  /** Dovednost 1–3. */
  skill: number;
};

/** Barva týmu — jen odlišení, nic víc. */
const TEAM_TONE = [
  "border-club-line bg-club-soft text-slate-800",
  "border-amber-300 bg-amber-50 text-amber-900",
  "border-emerald-200 bg-emerald-50 text-emerald-800",
  "border-red-200 bg-red-50 text-red-800",
];

/** Dovednost jako tečky — na první pohled vidět, kdo je kdo. */
export function SkillDots({ skill }: { skill: number }) {
  return (
    <span aria-label={`dovednost ${skill}`} className="inline-flex gap-0.5">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            n <= skill ? "bg-current opacity-80" : "bg-current opacity-20"
          }`}
        />
      ))}
    </span>
  );
}

/**
 * Týmy se součtem dovedností a nezařazení. Klepnutí na hráče ho přesune
 * do dalšího týmu, z posledního zpátky mezi nezařazené.
 */
export function TeamBoard({
  teams,
  members,
  pool,
  onCycle,
}: {
  teams: TeamAssignment[];
  members: Map<string, TeamMember>;
  /** Přítomní, kteří nejsou v žádném týmu. */
  pool: TeamMember[];
  onCycle: (id: string) => void;
}) {
  const skill = new Map([...members.values()].map((m) => [m.id, m.skill]));
  const sums = teamSkillSums(teams, skill);

  return (
    <>
      {teams.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {teams.map((t, i) => (
            <div
              key={t.name}
              className={`min-w-0 rounded-lg border p-2.5 ${TEAM_TONE[i] ?? TEAM_TONE[0]}`}
            >
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="font-heading text-[11px] font-bold uppercase tracking-wider">
                  {t.name}
                </span>
                <span className="text-xs tabular-nums opacity-80">
                  {czPlayers(t.playerIds.length)} · síla {sums[i]}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {t.playerIds.map((id) => {
                  const m = members.get(id);
                  return (
                    <PlayerChip
                      key={id}
                      name={m?.name ?? "?"}
                      skill={m?.skill ?? 0}
                      onClick={() => onCycle(id)}
                    />
                  );
                })}
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
            {pool.map((m) => (
              <PlayerChip
                key={m.id}
                name={m.name}
                skill={m.skill}
                onClick={() => onCycle(m.id)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function PlayerChip({
  name,
  skill,
  onClick,
}: {
  name: string;
  skill: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-800 transition hover:border-club"
    >
      {name}
      {skill > 0 && <SkillDots skill={skill} />}
    </button>
  );
}
