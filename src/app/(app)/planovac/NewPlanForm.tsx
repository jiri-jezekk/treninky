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

export type TemplateOption = {
  id: string;
  label: string;
  groupId: string | null;
  durationMinutes: number | null;
};

export function NewPlanForm({
  groups,
  defaults,
  sources,
  templates,
  initialTemplateId = null,
}: {
  groups: GroupOption[];
  defaults: PlanFieldValues;
  sources: CopySource[];
  templates: TemplateOption[];
  /** Šablona vybraná předem (odkaz „Založit plán“ ze záložky Šablony). */
  initialTemplateId?: string | null;
}) {
  const [open, setOpen] = useState(initialTemplateId != null);
  const [templateId, setTemplateId] = useState(initialTemplateId ?? "");

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

  // Šablona předvyplní kategorii a délku; datum a čas zůstávají.
  const template = templates.find((t) => t.id === templateId);
  const values: PlanFieldValues = template
    ? {
        ...defaults,
        groupId: template.groupId ?? defaults.groupId,
        durationMinutes: template.durationMinutes ?? defaults.durationMinutes,
      }
    : defaults;

  return (
    <form
      action={createPlan}
      className="w-full rounded-2xl border border-club-line bg-white p-5"
    >
      <h2 className={label}>Nový plán</h2>
      {templates.length > 0 && (
        <label className="mt-4 block">
          <span className={label}>Ze šablony</span>
          <select
            name="templateId"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className={field}
          >
            <option value="">— bez šablony —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="mt-4">
        <PlanFields key={templateId} values={values} groups={groups} />
      </div>
      {sources.length > 0 && (
        <label className="mt-3 block">
          <span className={label}>Převzít body z plánu (nepovinné)</span>
          <select name="sourceId" defaultValue="" className={field}>
            <option value="">— nepřebírat —</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.blockCount})
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" className={`${btnPrimary} ${btnSm} flex-1 sm:flex-none`}>
          Založit plán
        </button>
        <button
          type="button"
          className={`${btnOutline} ${btnSm} flex-1 sm:flex-none`}
          onClick={() => setOpen(false)}
        >
          Zrušit
        </button>
      </div>
    </form>
  );
}
