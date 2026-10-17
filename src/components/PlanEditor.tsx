"use client";

import Link from "next/link";
import { useState } from "react";
import {
  addPlanBlock,
  clearPlan,
  copyPlanFrom,
  deletePlanBlock,
  movePlanBlock,
  nudgeBlockMinutes,
  saveBlockToLibrary,
  setBlockRating,
  updatePlanBlock,
} from "@/actions/training-plan";
import { DRILL_KIND_CLASS } from "@/components/drill-kind-styles";
import { PlanAttendees } from "@/components/PlanAttendees";
import type { TeamMember } from "@/components/TeamBoard";
import { TeamSplit } from "@/components/TeamSplit";
import {
  DEFAULT_DRILL_KIND,
  DRILL_KIND_LABELS,
  DRILL_KINDS,
  isTeamKind,
  type DrillKind,
  type TeamAssignment,
} from "@/lib/training-plan";

export type PlanBlockRow = {
  id: string;
  title: string;
  focus: string | null;
  /** Null = bod napsaný přímo v plánu, jde uložit do knihovny. */
  drillId: string | null;
  notes: string | null;
  minutes: number;
  kind: DrillKind;
  startLabel: string;
  endLabel: string;
  teams: TeamAssignment[];
  /** Po tréninku: 1 = fungovalo, -1 = nefungovalo. */
  rating: number | null;
};

export type DrillOption = {
  id: string;
  name: string;
  kind: DrillKind;
  defaultMinutes: number | null;
  focus: string | null;
  description: string | null;
  /** „před 7 dny“, „ještě ne“ — pro kategorii plánu. */
  lastUsedLabel: string;
  up: number;
  down: number;
  /** Je určené přímo pro kategorii plánu — v nabídce se zvýrazní. */
  forPlanGroup: boolean;
};

/** Soupiska kategorie plánu — pro dělení do týmů. */
export type PlanRoster = {
  groupId: string;
  /** Celá soupiska včetně neaktivních (jména v uložených týmech). */
  members: TeamMember[];
  /** Aktivní — ti se nabízí k označení. */
  activeIds: string[];
  attendeeIds: string[];
};

export type CopySource = {
  id: string;
  label: string;
  blockCount: number;
};

/*
 * Editor se ovládá hlavně na telefonu v hale: tlačítka mají aspoň
 * 40 px, formuláře jdou přes celou šířku a nic se neschovává do
 * najetí myší.
 */
const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
const field =
  "mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base text-slate-900 outline-none focus:border-club sm:text-sm";
const btnPrimary =
  "inline-flex min-h-10 items-center justify-center rounded-full border-2 border-club bg-club px-4 py-2 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover";
const btnOutline =
  "inline-flex min-h-10 items-center justify-center rounded-full border-2 border-slate-300 px-4 py-2 font-heading text-sm font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft";
const btnDanger =
  "inline-flex min-h-10 items-center justify-center rounded-full border-2 border-red-200 px-4 py-2 font-heading text-sm font-semibold text-red-800 transition hover:border-red-600 hover:bg-red-50";
const iconBtn =
  "grid h-10 min-w-10 place-items-center rounded-full border border-slate-200 px-2 text-sm text-slate-700 transition hover:border-club hover:bg-club-soft disabled:opacity-30";

export function PlanEditor({
  planId,
  blocks,
  drills,
  roster,
  afterTraining = false,
  sources,
  plannedMinutes,
  differenceMinutes,
}: {
  planId: string;
  blocks: PlanBlockRow[];
  drills: DrillOption[];
  /** Soupiska kategorie plánu. Null = plán nemá kategorii, týmy se nenabízí. */
  roster: PlanRoster | null;
  /** Trénink už proběhl — u bodů se nabízí hodnocení. */
  afterTraining?: boolean;
  sources: CopySource[];
  plannedMinutes: number;
  differenceMinutes: number | null;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const available =
    differenceMinutes == null ? null : plannedMinutes + differenceMinutes;
  const hasTeamBlock = blocks.some((b) => isTeamKind(b.kind));

  return (
    <>
    {roster && hasTeamBlock && (
      <PlanAttendees
        planId={planId}
        groupId={roster.groupId}
        members={roster.members.filter((m) => roster.activeIds.includes(m.id))}
        initialIds={roster.attendeeIds}
      />
    )}
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={label}>Plán tréninku</h2>
          <Link
            href="/planovac/cviceni"
            className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800"
          >
            Knihovna cvičení
          </Link>
        </div>
        {blocks.length > 0 && (
          <PlanProgress
            planned={plannedMinutes}
            available={available}
            difference={differenceMinutes}
          />
        )}
      </div>

      {blocks.length === 0 && !adding && (
        <p className="px-5 pt-8 pb-2 text-center text-sm italic text-slate-500">
          Plán je zatím prázdný.
        </p>
      )}

      {blocks.length > 0 && (
        <ol className="divide-y divide-slate-100">
          {blocks.map((b, i) => (
            <li key={b.id} className="px-4 py-3.5 sm:px-5">
              {editing === b.id ? (
                <EditBlockForm block={b} onDone={() => setEditing(null)} />
              ) : (
                <BlockCard
                  block={b}
                  isFirst={i === 0}
                  isLast={i === blocks.length - 1}
                  roster={roster}
                  afterTraining={afterTraining}
                  onEdit={() => {
                    setAdding(false);
                    setEditing(b.id);
                  }}
                />
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
        {adding ? (
          <AddBlockForm
            planId={planId}
            drills={drills}
            onDone={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            className={`${btnPrimary} w-full sm:w-auto`}
            onClick={() => {
              setEditing(null);
              setAdding(true);
            }}
          >
            + Přidat bod
          </button>
        )}
      </div>

      {(sources.length > 0 || blocks.length > 0) && (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
          {sources.length > 0 && (
            <form
              action={copyPlanFrom.bind(null, planId)}
              className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end"
            >
              <label className="block min-w-0 flex-1">
                <span className={label}>
                  {blocks.length === 0 ? "Převzít body z plánu" : "Připojit body z plánu"}
                </span>
                <select name="sourceId" className={field}>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} ({s.blockCount})
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={btnOutline}>
                {blocks.length === 0 ? "Převzít" : "Připojit"}
              </button>
            </form>
          )}
          {blocks.length > 0 && (
            <form
              action={clearPlan.bind(null, planId)}
              onSubmit={(e) => {
                if (!window.confirm("Vymazat všechny body plánu?")) e.preventDefault();
              }}
            >
              <button type="submit" className={`${btnDanger} w-full sm:w-auto`}>
                Vymazat plán
              </button>
            </form>
          )}
        </div>
      )}
    </section>
    </>
  );
}

/** Text položky v nabídce — jméno, kdy naposledy a jak dopadlo. */
function drillOptionLabel(d: DrillOption): string {
  return [
    `${d.forPlanGroup ? "★ " : ""}${d.name}`,
    `naposledy ${d.lastUsedLabel}`,
    d.up > 0 ? `👍${d.up}` : "",
    d.down > 0 ? `👎${d.down}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Kolik je naplánováno z délky tréninku — číslem i proužkem. */
function PlanProgress({
  planned,
  available,
  difference,
}: {
  planned: number;
  available: number | null;
  difference: number | null;
}) {
  const over = difference != null && difference < 0;
  const ratio = available ? Math.min(1, planned / available) : null;

  return (
    <div className="mt-2">
      <p className="text-sm text-slate-600">
        <span className="tabular-nums text-slate-800">{planned}</span>
        {available != null && (
          <span className="tabular-nums"> / {available}</span>
        )}{" "}
        min
        {difference != null &&
          (over ? (
            <span className="text-amber-900"> · přesah {Math.abs(difference)} min</span>
          ) : (
            <span className="text-slate-500"> · zbývá {difference} min</span>
          ))}
      </p>
      {ratio != null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${over ? "bg-amber-600" : "bg-club"}`}
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function KindBadge({ kind }: { kind: DrillKind }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider ${DRILL_KIND_CLASS[kind]}`}
    >
      {DRILL_KIND_LABELS[kind]}
    </span>
  );
}

function BlockCard({
  block: b,
  isFirst,
  isLast,
  roster,
  afterTraining,
  onEdit,
}: {
  block: PlanBlockRow;
  isFirst: boolean;
  isLast: boolean;
  roster: PlanRoster | null;
  afterTraining: boolean;
  onEdit: () => void;
}) {
  return (
    <>
      {/* Klepnutí na bod ho otevře k úpravě. */}
      <button
        type="button"
        onClick={onEdit}
        className="block w-full min-w-0 text-left"
        aria-label={`Upravit bod ${b.title}`}
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-heading text-sm font-bold tabular-nums text-slate-800">
            {b.startLabel}
          </span>
          <KindBadge kind={b.kind} />
        </span>
        <span className="mt-1 block min-w-0 break-words font-medium text-slate-800">
          {b.title}
          {b.focus && <span className="font-normal text-slate-500"> – {b.focus}</span>}
        </span>
        {b.notes && (
          <span className="mt-1 block break-words text-sm text-slate-600">{b.notes}</span>
        )}
      </button>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1">
          <form action={nudgeBlockMinutes.bind(null, b.id, -5)}>
            <button
              type="submit"
              className={iconBtn}
              disabled={b.minutes <= 1}
              aria-label="Zkrátit o 5 minut"
            >
              −
            </button>
          </form>
          <span className="min-w-14 text-center font-heading text-sm font-bold tabular-nums text-slate-800">
            {b.minutes} min
          </span>
          <form action={nudgeBlockMinutes.bind(null, b.id, 5)}>
            <button type="submit" className={iconBtn} aria-label="Prodloužit o 5 minut">
              +
            </button>
          </form>
        </span>

        <span className="ml-auto inline-flex items-center gap-1">
          <form action={movePlanBlock.bind(null, b.id, "up")}>
            <button type="submit" className={iconBtn} disabled={isFirst} aria-label="Posunout nahoru">
              ↑
            </button>
          </form>
          <form action={movePlanBlock.bind(null, b.id, "down")}>
            <button type="submit" className={iconBtn} disabled={isLast} aria-label="Posunout dolů">
              ↓
            </button>
          </form>
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {afterTraining && <RatingButtons blockId={b.id} rating={b.rating} />}
        <button type="button" className={`${btnOutline} flex-1 sm:flex-none`} onClick={onEdit}>
          Upravit
        </button>
        {b.drillId == null && (
          <form action={saveBlockToLibrary.bind(null, b.id)} className="flex flex-1 sm:flex-none">
            <button
              type="submit"
              className={`${btnOutline} w-full`}
              title="Uložit bod jako cvičení do knihovny"
            >
              Do knihovny
            </button>
          </form>
        )}
        <form
          action={deletePlanBlock.bind(null, b.id)}
          onSubmit={(e) => confirmDelete(e, b.title)}
          className="flex flex-1 sm:flex-none"
        >
          <button type="submit" className={`${btnDanger} w-full`}>
            Smazat
          </button>
        </form>
      </div>

      {isTeamKind(b.kind) && roster && (
        <TeamSplit
          blockId={b.id}
          members={roster.members}
          present={roster.members.filter((m) => roster.attendeeIds.includes(m.id))}
          initialTeams={b.teams}
        />
      )}
    </>
  );
}

/** Po tréninku: fungovalo / nefungovalo. Druhé klepnutí hodnocení zruší. */
function RatingButtons({ blockId, rating }: { blockId: string; rating: number | null }) {
  return (
    <span className="inline-flex gap-1" role="group" aria-label="Jak to fungovalo">
      {([1, -1] as const).map((r) => (
        <form key={r} action={setBlockRating.bind(null, blockId, r)}>
          <button
            type="submit"
            aria-pressed={rating === r}
            aria-label={r === 1 ? "Fungovalo" : "Nefungovalo"}
            className={`grid h-10 w-10 place-items-center rounded-full border text-base transition ${
              rating === r
                ? r === 1
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-red-200 bg-red-50"
                : "border-slate-200 opacity-60 hover:opacity-100"
            }`}
          >
            {r === 1 ? "👍" : "👎"}
          </button>
        </form>
      ))}
    </span>
  );
}

/** Smazání bodu se potvrzuje — na telefonu se snadno ťukne vedle. */
function confirmDelete(e: { preventDefault(): void }, title: string) {
  if (!window.confirm(`Smazat bod „${title}“?`)) e.preventDefault();
}

function EditBlockForm({
  block,
  onDone,
}: {
  block: PlanBlockRow;
  onDone: () => void;
}) {
  return (
    <form action={updatePlanBlock.bind(null, block.id)} onSubmit={onDone}>
      <h3 className={`${label} mb-3`}>Upravit bod</h3>
      <BlockFields block={block} />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button type="submit" className={`${btnPrimary} col-span-2`}>
          Uložit
        </button>
        <button type="button" className={btnOutline} onClick={onDone}>
          Zrušit
        </button>
        <button
          type="submit"
          formAction={deletePlanBlock.bind(null, block.id)}
          formNoValidate
          onClick={(e) => confirmDelete(e, block.title)}
          className={btnDanger}
        >
          Smazat bod
        </button>
      </div>
    </form>
  );
}

function AddBlockForm({
  planId,
  drills,
  onDone,
}: {
  planId: string;
  drills: DrillOption[];
  onDone: () => void;
}) {
  const [pickedDrill, setPickedDrill] = useState("vlastni");
  const drill = drills.find((d) => d.id === pickedDrill);

  return (
    <form action={addPlanBlock.bind(null, planId)} onSubmit={onDone}>
      <label className="block">
        <span className={label}>Z knihovny</span>
        <select
          name="drillId"
          value={pickedDrill}
          onChange={(e) => setPickedDrill(e.target.value)}
          className={field}
        >
          <option value="vlastni">— napsat vlastní bod —</option>
          {DRILL_KINDS.map((k) => {
            const ofKind = drills.filter((d) => d.kind === k);
            if (ofKind.length === 0) return null;
            return (
              <optgroup key={k} label={DRILL_KIND_LABELS[k]}>
                {ofKind.map((d) => (
                  <option key={d.id} value={d.id}>
                    {drillOptionLabel(d)}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        {drills.some((d) => d.forPlanGroup) && (
          <span className="mt-1 block text-xs text-slate-500">
            ★ = určené pro kategorii tohoto plánu
          </span>
        )}
      </label>

      <div className="mt-3">
        <BlockFields
          key={pickedDrill}
          block={
            drill
              ? {
                  title: drill.name,
                  focus: drill.focus,
                  minutes: drill.defaultMinutes ?? 10,
                  kind: drill.kind,
                  notes: drill.description,
                }
              : undefined
          }
        />
      </div>

      {!drill && (
        <label className="mt-3 flex min-h-10 cursor-pointer items-center gap-3 text-sm text-slate-700">
          <input type="checkbox" name="saveToLibrary" className="h-5 w-5" />
          Uložit i do knihovny cvičení
        </label>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button type="submit" className={btnPrimary}>
          Přidat
        </button>
        <button type="button" className={btnOutline} onClick={onDone}>
          Zrušit
        </button>
      </div>
    </form>
  );
}

function BlockFields({
  block,
}: {
  block?: {
    title: string;
    focus: string | null;
    notes: string | null;
    minutes: number;
    kind: DrillKind;
  };
}) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className={label}>Název</span>
        <input
          name="title"
          required
          defaultValue={block?.title ?? ""}
          placeholder="Rozcvička a rozházení"
          className={field}
        />
      </label>
      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <label className="block min-w-0">
          <span className={label}>Druh</span>
          <select
            name="kind"
            defaultValue={block?.kind ?? DEFAULT_DRILL_KIND}
            className={field}
          >
            {DRILL_KINDS.map((k) => (
              <option key={k} value={k}>
                {DRILL_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className={label}>Minut</span>
          <input
            name="minutes"
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            defaultValue={block?.minutes ?? 10}
            className={`${field} tabular-nums`}
          />
        </label>
      </div>
      <label className="block">
        <span className={label}>Zaměření (nepovinné)</span>
        <input
          name="focus"
          defaultValue={block?.focus ?? ""}
          placeholder="rychlost obratnost"
          className={field}
        />
      </label>
      <label className="block">
        <span className={label}>Popis / poznámka (nepovinné)</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={block?.notes ?? ""}
          placeholder="Jak cvičení probíhá, na co si dát pozor…"
          className={field}
        />
      </label>
    </div>
  );
}
