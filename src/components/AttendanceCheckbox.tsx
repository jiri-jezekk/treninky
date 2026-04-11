"use client";

import { useRouter } from "next/navigation";
import { setAttendancePresent } from "@/actions/trainings";

export function AttendanceCheckbox({
  trainingId,
  playerId,
  present,
}: {
  trainingId: string;
  playerId: string;
  present: boolean;
}) {
  const router = useRouter();
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={present}
        onChange={async (e) => {
          await setAttendancePresent(trainingId, playerId, e.target.checked);
          router.refresh();
        }}
        className="h-4 w-4 rounded border-slate-300 text-slate-700"
      />
      <span>Přítomen</span>
    </label>
  );
}
