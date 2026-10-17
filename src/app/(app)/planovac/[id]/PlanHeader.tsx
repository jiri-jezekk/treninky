"use client";

import Link from "next/link";
import { useState } from "react";
import { deletePlan, updatePlan } from "@/actions/training-plan";
import type { GroupOption } from "@/lib/groups";
import {
  PlanFields,
  btnOutline,
  btnPrimary,
  btnSm,
  label,
  mini,
  type PlanFieldValues,
} from "../PlanFields";

export function PlanHeader({
  planId,
  title,
  subtitle,
  group,
  trainingHref,
  values,
  groups,
}: {
  planId: string;
  /** „17/10/2026 · pátek 17:00–18:30“ */
  title: string;
  subtitle: string;
  group: { name: string; color: string } | null;
  trainingHref: string | null;
  values: PlanFieldValues;
  groups: GroupOption[];
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <form
        action={updatePlan.bind(null, planId)}
        onSubmit={() => setEditing(false)}
        className="mb-5 rounded-2xl border border-club-line bg-white p-5"
      >
        <h2 className={label}>Upravit plán</h2>
        <div className="mt-4">
          <PlanFields values={values} groups={groups} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className={`${btnPrimary} ${btnSm}`}>
            Uložit
          </button>
          <button
            type="button"
            className={`${btnOutline} ${btnSm}`}
            onClick={() => setEditing(false)}
          >
            Zrušit
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-xl font-extrabold tabular-nums text-slate-800">
            {title}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {group ? (
              <span className="inline-flex items-center gap-1.5 text-slate-700">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: group.color }}
                />
                {group.name}
              </span>
            ) : (
              <span className="italic text-slate-500">bez kategorie</span>
            )}
            {trainingHref && (
              <Link
                href={trainingHref}
                className="text-xs text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800"
              >
                trénink v rozvrhu
              </Link>
            )}
          </p>
          {values.topic && (
            <p className="mt-2 text-sm text-slate-800">
              <span className={label}>Téma</span>{" "}
              <span className="break-words">{values.topic}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={mini} onClick={() => setEditing(true)}>
            Upravit
          </button>
          <a href="#denik" className={mini}>
            Do deníku
          </a>
          <form
            action={deletePlan.bind(null, planId)}
            onSubmit={(e) => {
              if (!window.confirm("Smazat celý plán i s body?")) e.preventDefault();
            }}
          >
            <button
              type="submit"
              className="inline-flex min-h-10 items-center rounded-full border border-red-200 px-3.5 py-1.5 text-sm text-red-800 transition hover:border-red-600 hover:bg-red-50"
            >
              Smazat plán
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
