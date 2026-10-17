import type { DrillKind } from "@/lib/training-plan";

/** Barva štítku druhu cvičení — v plánu i v knihovně stejná. */
export const DRILL_KIND_CLASS: Record<DrillKind, string> = {
  WARMUP: "bg-amber-50 text-amber-900",
  MOVEMENT_GAME: "bg-orange-50 text-orange-900",
  GAME_DRILL: "bg-club-soft text-club",
  PREP_GAME: "bg-emerald-50 text-emerald-800",
  PREP_DRILL: "bg-violet-50 text-violet-800",
  GAME: "bg-sky-50 text-sky-900",
  COOLDOWN: "bg-slate-100 text-slate-600",
};
