"use client";

import { useState } from "react";
import { SkillDots, TeamBoard, type TeamMember } from "@/components/TeamBoard";
import { balanceTeams } from "@/lib/team-balance";
import { moveToNextTeam, type TeamAssignment } from "@/lib/training-plan";
import { btnPrimary, label, mini } from "../PlanFields";

type Member = TeamMember & { groupId: string };

export function QuickTeams({
  groups,
  members,
}: {
  groups: { id: string; name: string; color: string }[];
  members: Member[];
}) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<TeamAssignment[]>([]);

  const roster = members.filter((m) => m.groupId === groupId);
  const presentMembers = roster.filter((m) => present.has(m.id));
  const byId = new Map(roster.map((m) => [m.id, m]));
  const assigned = new Set(teams.flatMap((t) => t.playerIds));

  function pickGroup(id: string) {
    setGroupId(id);
    setPresent(new Set());
    setTeams([]);
  }

  function toggle(id: string) {
    const next = new Set(present);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPresent(next);
    setTeams([]);
  }

  return (
    <>
      {groups.length > 1 && (
        <nav className="mb-4 flex flex-wrap gap-2" aria-label="Kategorie">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => pickGroup(g.id)}
              aria-pressed={g.id === groupId}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition ${
                g.id === groupId
                  ? "border-club-line bg-club-soft text-slate-900"
                  : "border-slate-200 text-slate-600 hover:border-club"
              }`}
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: g.color }}
              />
              {g.name}
            </button>
          ))}
        </nav>
      )}

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={label}>
            Kdo je tu{" "}
            <span className="tabular-nums text-slate-700">
              {present.size}/{roster.length}
            </span>
          </h2>
          <span className="flex gap-2">
            <button
              type="button"
              className={mini}
              onClick={() => {
                setPresent(new Set(roster.map((m) => m.id)));
                setTeams([]);
              }}
            >
              Všichni
            </button>
            <button
              type="button"
              className={mini}
              onClick={() => {
                setPresent(new Set());
                setTeams([]);
              }}
            >
              Nikdo
            </button>
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {roster.map((m) => {
            const on = present.has(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                aria-pressed={on}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition ${
                  on
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 text-slate-500 hover:border-club"
                }`}
              >
                {on ? "✓ " : ""}
                {m.name}
                <SkillDots skill={m.skill} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
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
            disabled={presentMembers.length < 2}
            onClick={() => setTeams(balanceTeams(presentMembers, teamCount))}
            className={`${btnPrimary} disabled:opacity-50`}
          >
            {teams.length > 0 ? "Zamíchat znovu" : "Vyrovnané týmy"}
          </button>
        </div>
        {presentMembers.length < 2 && (
          <p className="mt-3 text-sm text-slate-500">Označ aspoň dva lidi.</p>
        )}
        <TeamBoard
          teams={teams}
          members={byId}
          pool={teams.length > 0 ? presentMembers.filter((m) => !assigned.has(m.id)) : []}
          onCycle={(id) => setTeams(moveToNextTeam(teams, id))}
        />
      </section>
    </>
  );
}
