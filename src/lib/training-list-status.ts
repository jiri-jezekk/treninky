import type { Training } from "@prisma/client";

export type TrainingListStatus =
  | "cancelled"
  | "planned"
  | "completed"
  | "unfilled";

export function trainingListStatus(args: {
  training: Pick<Training, "startsAt" | "cancelled">;
  now: Date;
  activePlayerCount: number;
  /** Počet záznamů docházky se stavem Přítomen (automatické „nepřítomen“ se nepočítá). */
  presentCount: number;
}): TrainingListStatus {
  const { training, now, activePlayerCount, presentCount } = args;
  if (training.cancelled) return "cancelled";
  const start = training.startsAt.getTime();
  if (start > now.getTime()) return "planned";

  if (activePlayerCount === 0) return "completed";
  if (presentCount > 0) return "completed";
  return "unfilled";
}

export const TRAINING_STATUS_LABELS: Record<TrainingListStatus, string> = {
  cancelled: "Zrušen",
  planned: "Plánován",
  completed: "Dokončen",
  unfilled: "Nevyplněno",
};
