"use client";

import { useActionState } from "react";
import {
  setPortalPassword,
  verifyPortalPassword,
  type PortalActionState,
} from "@/actions/player-portal";

const field =
  "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-club";

/**
 * Brána k platebnímu odkazu. Při prvním otevření si hráč heslo zvolí,
 * potom už ho jen zadává — a to nejvýš jednou za týden, protože se
 * přihlášení při každé návštěvě prodlouží.
 */
export function PortalGate({
  payToken,
  mode,
  playerName,
}: {
  payToken: string;
  mode: "set" | "enter";
  playerName: string;
}) {
  const action = mode === "set" ? setPortalPassword : verifyPortalPassword;
  const [state, formAction, pending] = useActionState(
    action,
    {} as PortalActionState,
  );

  return (
    <form
      action={formAction}
      className="mx-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6"
    >
      <input type="hidden" name="payToken" value={payToken} />

      <h1 className="font-heading text-xl font-extrabold text-slate-800">
        Ahoj {playerName.split(" ")[0]}!
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {mode === "set"
          ? "Zvol si heslo, kterým si svůj přehled plateb ochráníš. Budeš ho zadávat jen když se týden neukážeš."
          : "Zadej svoje heslo."}
      </p>

      {state.error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
          {state.error}
        </p>
      )}

      <label className="mt-5 block">
        <span className="font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
          {mode === "set" ? "Nové heslo (min. 6 znaků)" : "Heslo"}
        </span>
        <input
          type="password"
          name="password"
          required
          minLength={6}
          autoFocus
          autoComplete={mode === "set" ? "new-password" : "current-password"}
          className={`${field} mt-1.5`}
        />
      </label>

      {mode === "set" && (
        <label className="mt-4 block">
          <span className="font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
            Heslo znovu
          </span>
          <input
            type="password"
            name="passwordAgain"
            required
            minLength={6}
            autoComplete="new-password"
            className={`${field} mt-1.5`}
          />
        </label>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-full border-2 border-club bg-club px-4 py-2.5 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover disabled:opacity-60"
      >
        {pending
          ? "Moment…"
          : mode === "set"
            ? "Nastavit heslo a pokračovat"
            : "Zobrazit platby"}
      </button>

      {mode === "enter" && (
        <p className="mt-4 text-center text-xs italic text-slate-500">
          Heslo si nepamatuješ? Napiš trenérovi, zruší ti ho a nastavíš si nové.
        </p>
      )}
    </form>
  );
}
