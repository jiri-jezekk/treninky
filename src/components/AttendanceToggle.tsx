"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setAttendancePresent } from "@/actions/trainings";

/**
 * Přepínač účasti přes celý řádek — na telefonu se do malého čtverečku
 * trefuje špatně a docházka se zapisuje hlavně v hale na mobilu.
 */
export function AttendanceToggle({
  trainingId,
  playerId,
  present,
  children,
}: {
  trainingId: string;
  playerId: string;
  present: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(present);

  // Po přenačtení ze serveru má přednost skutečný stav.
  const [lastServer, setLastServer] = useState(present);
  if (lastServer !== present) {
    setLastServer(present);
    setOptimistic(present);
  }

  function toggle() {
    const next = !optimistic;
    setOptimistic(next);
    startTransition(async () => {
      await setAttendancePresent(trainingId, playerId, next);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={optimistic}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition sm:px-5 ${
        optimistic ? "bg-emerald-50" : "hover:bg-slate-50"
      } ${pending ? "opacity-70" : ""}`}
    >
      <span
        aria-hidden
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition ${
          optimistic
            ? "border-emerald-600 bg-emerald-600 text-slate-900"
            : "border-slate-300"
        }`}
      >
        {optimistic && (
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#020617"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </span>
      {children}
    </button>
  );
}
