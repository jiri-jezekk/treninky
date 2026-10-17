"use client";

import { useState } from "react";
import { createPlan } from "@/actions/training-plan";
import type { GroupOption } from "@/lib/groups";
import type { CopySource } from "@/components/PlanEditor";
import {
  PlanFields,
  btnOutline,
  btnPrimary,
  btnSm,
  field,
  label,
  type PlanFieldValues,
} from "./PlanFields";

export function NewPlanForm({
  groups,
  defaults,
  sources,
}: {
  groups: GroupOption[];
  defaults: PlanFieldValues;
  sources: CopySource[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className={`${btnPrimary} ${btnSm}`}
        onClick={() => setOpen(true)}
      >
        + Nový plán
      </button>
    );
  }

  return (
    <form
      action={createPlan}
      className="w-full rounded-2xl border border-club-line bg-white p-5"
    >
      <h2 className={label}>Nový plán</h2>
      <div className="mt-4">
        <PlanFields values={defaults} groups={groups} />
      </div>
      {sources.length > 0 && (
        <label className="mt-3 block">
          <span className={label}>Převzít body z plánu (nepovinné)</span>
          <select name="sourceId" defaultValue="" className={field}>
            <option value="">— začít prázdný —</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.blockCount})
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" className={`${btnPrimary} ${btnSm}`}>
          Založit plán
        </button>
        <button
          type="button"
          className={`${btnOutline} ${btnSm}`}
          onClick={() => setOpen(false)}
        >
          Zrušit
        </button>
      </div>
    </form>
  );
}
