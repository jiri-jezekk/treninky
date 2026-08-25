"use client";

import { useEffect, useRef } from "react";
import { touchPortalSession } from "@/actions/player-portal-touch";

/**
 * Posune platnost přihlášení o dalších sedm dní. Cookie nejde zapsat
 * při vykreslování serverové komponenty, proto se to dělá až po načtení.
 */
export function SessionRefresh({ payToken }: { payToken: string }) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void touchPortalSession(payToken);
  }, [payToken]);

  return null;
}
