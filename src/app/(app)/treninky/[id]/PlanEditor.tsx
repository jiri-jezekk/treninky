"use client";

import Link from "next/link";
import { useState } from "react";
import {
  addPlanBlock,
  clearPlan,
  copyPlanFrom,
  deletePlanBlock,
  movePlanBlock,
  updatePlanBlock,
} from "@/actions/training-plan";
import { TeamSplit, type SplitPlayerRow } from "./TeamSplit";
import {
  DRILL_KIND_LABELS,
  DRILL_KINDS,
  type DrillKind,
  type TeamAssignment,
} from "@/lib/training-plan";

export type PlanBlockRow = {
  id: string;
  title: string;
  notes: string | null;
  minutes: number;
  kind: DrillKind;
  startLabel: string;
  endLabel: string;
  teams: TeamAssignment[];
};

export type DrillOption = {
  id: string;
  name: string;
  kind: DrillKind;
  defaultMinutes: number | null;
};

export type CopySource = {
  id: string;
  label: string;
  blockCount: number;
};

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
const field =
  "mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-club";
const btnPrimary =
  "inline-flex items-center justify-center rounded-full border-2 border-club bg-club px-3 py-1.5 font-heading text-xs font-semibold text-onclub transition hover:bg-club-hover";
const btnOutline =
  "inline-flex items-center justify-center rounded-full border-2 border-slate-300 px-3 py-1.5 font-heading text-xs font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft";
const btnDanger =
  "inline-flex items-center justify-center rounded-full border-2 border-red-200 px-3 py-1.5 font-heading text-xs font-semibold text-red-800 transition hover:border-red-600 hover:bg-red-50";
const mini =
  "rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900";

const KIND_CLASS: Record<DrillKind, string> = {
  WARMUP: "bg-amber-50 text-amber-900",
  DRILL: "bg-club-soft text-club",
  GAME: "bg-emerald-50 text-emerald-800",
  COOLDOWN: "bg-slate-50 text-slate-500",
};

export function PlanEditor({
  trainingId,
  blocks,
  drills,
  players,
  sources,
  plannedMinutes,
  differenceMinutes,
}: {
  trainingId: string;
  blocks: PlanBlockRow[];
  drills: DrillOption[];
  players: SplitPlayerRow[];
  sources: CopySource[];
  plannedMinutes: number;
  differenceMinutes: number | null;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [pickedDrill, setPickedDrill] = useState("vlastni");

  const drill = drills.find((d) => d.id === pickedDrill);

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className={label}>Plán tréninku</h2>
          {blocks.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Naplánováno{" "}
              <span className="tabular-nums text-slate-700">{plannedMinutes} min</span>
              {differenceMinutes != null &&
                (differenceMinutes >= 0 ? (
                  <span className="text-slate-500">
                    {" "}
                    · zbývá {differenceMinutes} min
                  </span>
                ) : (
                  <span className="text-amber-900">
                    {" "}
                    · přesah o {Math.abs(differenceMinutes)} min
                  </span>
                ))}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/treninky/cviceni" className={mini}>
            Knihovna cvičení
          </Link>
          {!adding && (
            <button type="button" className={btnOutline} onClick={() => setAdding(true)}>
              + Přidat bod
            </button>
          )}
        </div>
      </div>

      {blocks.length === 0 && !adding && (
        <div className="px-5 py-10 text-center">
          <p className="text-sm italic text-slate-500">
            Plán je zatím prázdný.
          </p>
          {sources.length > 0 && (
            <form
              action={copyPlanFrom.bind(null, trainingId)}
              className="mt-4 flex flex-wrap items-center justify-center gap-2"
            >
              <select name="sourceId" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900">
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.blockCount})
                  </option>
                ))}
              </select>
              <button type="submit" className={mini}>
                Převzít plán
              </button>
            </form>
          )}
        </div>
      )}

      {blocks.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {blocks.map((b, i) => (
            <li key={b.id} className="px-4 py-3.5 sm:px-5">
              {editing === b.id ? (
                <form
                  action={updatePlanBlock.bind(null, b.id)}
                  onSubmit={() => setEditing(null)}
                >
                  <BlockFields block={b} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="submit" className={btnPrimary}>
                      Uložit
                    </button>
                    <button
                      type="button"
                      className={btnOutline}
                      onClick={() => setEditing(null)}
                    >
                      Zrušit
                    </button>
                    <button
                      type="submit"
                      formAction={deletePlanBlock.bind(null, b.id)}
                      className={btnDanger}
                    >
                      Smazat bod
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="w-24 shrink-0 font-heading text-sm font-bold tabular-nums text-slate-800">
                      {b.startLabel}
                      <span className="ml-1 text-xs font-semibold text-slate-500">
                        {b.minutes}′
                      </span>
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider ${KIND_CLASS[b.kind]}`}
                        >
                          {DRILL_KIND_LABELS[b.kind]}
                        </span>
                        <span className="font-medium text-slate-800">{b.title}</span>
                      </span>
                      {b.notes && (
                        <span className="mt-1 block text-sm text-slate-600">
                          {b.notes}
                        </span>
                      )}
                    </span>

                    <span className="flex shrink-0 gap-1.5">
                      {i > 0 && (
                        <form action={movePlanBlock.bind(null, b.id, "up")}>
                          <button type="submit" className={mini} aria-label="Nahoru">
                            ↑
                          </button>
                        </form>
                      )}
                      {i < blocks.length - 1 && (
                        <form action={movePlanBlock.bind(null, b.id, "down")}>
                          <button type="submit" className={mini} aria-label="Dolů">
                            ↓
                          </button>
                        </form>
                      )}
                      <button
                        type="button"
                        className={mini}
                        onClick={() => setEditing(b.id)}
                      >
                        Upravit
                      </button>
                    </span>
                  </div>

                  {b.kind === "GAME" && (
                    <TeamSplit
                      blockId={b.id}
                      players={players}
                      initialTeams={b.teams}
                    />
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <form
          action={addPlanBlock.bind(null, trainingId)}
          onSubmit={() => setAdding(false)}
          className="border-t border-slate-100 bg-slate-50 px-4 py-4 sm:px-5"
        >
          <label className="block">
            <span className={label}>Cvičení z knihovny</span>
            <select
              name="drillId"
              value={pickedDrill}
              onChange={(e) => setPickedDrill(e.target.value)}
              className={field}
            >
              <option value="vlastni">— vlastní bod —</option>
              {drills.map((d) => (
                <option key={d.id} value={d.id}>
                  {DRILL_KIND_LABELS[d.kind]}: {d.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3">
            <BlockFields
              key={pickedDrill}
              block={
                drill
                  ? {
                      title: drill.name,
                      minutes: drill.defaultMinutes ?? 10,
                      kind: drill.kind,
                      notes: null,
                    }
                  : undefined
              }
              hideKind={drill != null}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="submit" className={btnPrimary}>
              Přidat do plánu
            </button>
            <button
              type="button"
              className={btnOutline}
              onClick={() => setAdding(false)}
            >
              Zrušit
            </button>
          </div>
        </form>
      )}

      {blocks.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 sm:px-5">
          {sources.length > 0 ? (
            <form
              action={copyPlanFrom.bind(null, trainingId)}
              className="flex flex-wrap items-center gap-2"
            >
              <select
                name="sourceId"
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-900"
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.blockCount})
                  </option>
                ))}
              </select>
              <button type="submit" className={mini}>
                Připojit plán
              </button>
            </form>
          ) : (
            <span />
          )}
          <form action={clearPlan.bind(null, trainingId)}>
            <button type="submit" className={mini}>
              Vymazat plán
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

function BlockFields({
  block,
  hideKind,
}: {
  block?: { title: string; notes: string | null; minutes: number; kind: DrillKind };
  hideKind?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="block">
          <span className={label}>Název</span>
          <input
            name="title"
            required
            defaultValue={block?.title ?? ""}
            placeholder="Rozcvička"
            className={field}
          />
        </label>
        <label className="block">
          <span className={label}>Délka (min)</span>
          <input
            name="minutes"
            inputMode="numeric"
            defaultValue={block?.minutes ?? 10}
            className={`${field} tabular-nums`}
          />
        </label>
        {hideKind ? (
          <span />
        ) : (
          <label className="block">
            <span className={label}>Druh</span>
            <select
              name="kind"
              defaultValue={block?.kind ?? "DRILL"}
              className={field}
            >
              {DRILL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {DRILL_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className="block">
        <span className={label}>Poznámka k tomuhle tréninku</span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={block?.notes ?? ""}
          placeholder="Na co si dnes dát pozor…"
          className={field}
        />
      </label>
    </div>
  );
}
