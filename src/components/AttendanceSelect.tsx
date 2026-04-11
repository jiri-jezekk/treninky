"use client";

import { AttendanceStatus } from "@prisma/client";
import { setAttendance } from "@/actions/trainings";

const labels: Record<AttendanceStatus, string> = {
  PRESENT: "Přítomen",
  ABSENT: "Nepřítomen",
  EXCUSED: "Omluven",
};

export function AttendanceSelect({
  trainingId,
  playerId,
  value,
}: {
  trainingId: string;
  playerId: string;
  value: AttendanceStatus;
}) {
  return (
    <select
      value={value}
      onChange={async (e) => {
        await setAttendance(
          trainingId,
          playerId,
          e.target.value as AttendanceStatus,
        );
      }}
      className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
    >
      {(Object.keys(labels) as AttendanceStatus[]).map((k) => (
        <option key={k} value={k}>
          {labels[k]}
        </option>
      ))}
    </select>
  );
}
