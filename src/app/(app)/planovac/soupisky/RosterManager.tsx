"use client";

import { useState } from "react";
import {
  addRosterMembers,
  deleteRosterMember,
  importPlayersToRoster,
  renameRosterMember,
  setRosterActive,
  setRosterSkill,
} from "@/actions/roster";
import { SKILL_LABELS, SKILL_LEVELS } from "@/lib/team-balance";
import {
  btnOutline,
  btnPrimary,
  field,
  label,
  mini,
} from "../PlanFields";

type Member = { id: string; name: string; skill: number; active: boolean };

export function RosterManager({
  groupId,
  groupName,
  members,
  clubPlayerCount,
}: {
  groupId: string;
  groupName: string;
  members: Member[];
  clubPlayerCount: number;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const active = members.filter((m) => m.active);
  const inactive = members.filter((m) => !m.active);

  return (
    <>
      <form
        action={addRosterMembers.bind(null, groupId)}
        className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
      >
        <label className="block">
          <span className={label}>Přidat do {groupName} (jedno jméno na řádek)</span>
          <textarea
            name="names"
            rows={3}
            placeholder={"Jan Novák\nEva Svobodová"}
            className={field}
          />
        </label>
        <fieldset className="mt-3">
          <legend className={label}>Dovednost</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {SKILL_LEVELS.map((s) => (
              <label
                key={s}
                className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3.5 text-sm text-slate-700 has-[:checked]:border-club-line has-[:checked]:bg-club-soft has-[:checked]:text-slate-900"
              >
                <input
                  type="radio"
                  name="skill"
                  value={s}
                  defaultChecked={s === 2}
                  className="sr-only"
                />
                {s} · {SKILL_LABELS[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className={`${btnPrimary} flex-1 sm:flex-none`}>
            Přidat
          </button>
          {clubPlayerCount > 0 && (
            <button
              type="submit"
              formAction={importPlayersToRoster.bind(null, groupId)}
              className={`${btnOutline} flex-1 sm:flex-none`}
            >
              Převzít z Hráčů ({clubPlayerCount})
            </button>
          )}
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <h2 className={`${label} border-b border-slate-100 px-4 py-3 sm:px-5`}>
          Soupiska {groupName}{" "}
          <span className="tabular-nums text-slate-700">{active.length}</span>
        </h2>
        {active.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm italic text-slate-500">
            Zatím nikdo. Napiš jména nahoře.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {active.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                renaming={renaming === m.id}
                onRename={() => setRenaming(m.id)}
                onRenameDone={() => setRenaming(null)}
              />
            ))}
          </ul>
        )}
      </section>

      {inactive.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className={mini}
          >
            {showInactive ? "Skrýt nechodící" : `Už nechodí (${inactive.length})`}
          </button>
          {showInactive && (
            <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {inactive.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  renaming={renaming === m.id}
                  onRename={() => setRenaming(m.id)}
                  onRenameDone={() => setRenaming(null)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function MemberRow({
  member: m,
  renaming,
  onRename,
  onRenameDone,
}: {
  member: Member;
  renaming: boolean;
  onRename: () => void;
  onRenameDone: () => void;
}) {
  if (renaming) {
    return (
      <li className="px-4 py-3 sm:px-5">
        <form
          action={renameRosterMember.bind(null, m.id)}
          onSubmit={onRenameDone}
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <label className="block min-w-0 flex-1">
            <span className={label}>Jméno</span>
            <input name="name" defaultValue={m.name} required className={field} />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button type="submit" className={btnPrimary}>
              Uložit
            </button>
            <button type="button" onClick={onRenameDone} className={btnOutline}>
              Zrušit
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="submit"
              formAction={setRosterActive.bind(null, m.id, !m.active)}
              formNoValidate
              className={btnOutline}
            >
              {m.active ? "Už nechodí" : "Zase chodí"}
            </button>
            <button
              type="submit"
              formAction={deleteRosterMember.bind(null, m.id)}
              formNoValidate
              onClick={(e) => {
                if (!window.confirm(`Smazat ${m.name} ze soupisky?`)) e.preventDefault();
              }}
              className="inline-flex min-h-10 items-center justify-center rounded-full border-2 border-red-200 px-4 py-2 font-heading text-sm font-semibold text-red-800 transition hover:border-red-600 hover:bg-red-50"
            >
              Smazat
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-5">
      <button
        type="button"
        onClick={onRename}
        className={`min-h-10 min-w-0 flex-1 truncate text-left ${
          m.active ? "text-slate-800" : "text-slate-500"
        }`}
        aria-label={`Upravit ${m.name}`}
      >
        {m.name}
      </button>
      <span className="inline-flex shrink-0 gap-1" role="group" aria-label="Dovednost">
        {SKILL_LEVELS.map((s) => (
          <form key={s} action={setRosterSkill.bind(null, m.id, s)}>
            <button
              type="submit"
              aria-pressed={m.skill === s}
              title={SKILL_LABELS[s]}
              className={`grid h-10 w-10 place-items-center rounded-full border font-heading text-sm font-bold transition ${
                m.skill === s
                  ? "border-club bg-club text-onclub"
                  : "border-slate-200 text-slate-500 hover:border-club"
              }`}
            >
              {s}
            </button>
          </form>
        ))}
      </span>
    </li>
  );
}
