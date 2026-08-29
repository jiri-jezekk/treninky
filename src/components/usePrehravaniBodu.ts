"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usekBodu, usekDobehl } from "@/lib/review-tracker";

/**
 * Přehrání vybraných bodů za sebou.
 *
 * Tohle je způsob, jak se rozbor doopravdy kouká: „pusť mi všechny moje
 * dead za sebou“. Video skočí kousek před bod, chvíli hraje a jede na
 * další — člověk nemusí klikat mezi časy a scrollovat v seznamu.
 *
 * Stav se drží v refech a posouvá se z tiku přehrávače, ne z efektu:
 * čas videa je vnější zdroj, na který se dá jen dívat. Po skoku se
 * krátkou chvíli nic nevyhodnocuje — přehrávač hlásí starý čas ještě
 * pár desetin po přetočení a bez té pauzy by playlist přeskočil
 * všechny body naráz.
 */

export type BodPrehravani = { id: string; atSeconds: number };

/** Jak dlouho po skoku se ignoruje čas z přehrávače. */
const PO_SKOKU_MS = 1500;

export type Prehravani = {
  bezi: boolean;
  /** Kolikátý bod z kolika, počítáno od jedné. */
  kde: number;
  pocet: number;
  aktualniId: string | null;
  spust: (ids: string[]) => void;
  zastav: () => void;
  /** Volá se z tiku přehrávače s aktuálním časem. */
  tik: (cas: number) => void;
};

export function usePrehravaniBodu(
  body: BodPrehravani[],
  ovladani: { seek: (s: number) => void; play: () => void },
): Prehravani {
  const [stav, setStav] = useState<{ ids: string[]; kde: number } | null>(null);

  const stavRef = useRef(stav);
  const bodyRef = useRef(body);
  const ovladaniRef = useRef(ovladani);
  const skokDoRef = useRef(0);

  useEffect(() => {
    stavRef.current = stav;
  }, [stav]);
  useEffect(() => {
    bodyRef.current = body;
  }, [body]);
  useEffect(() => {
    ovladaniRef.current = ovladani;
  }, [ovladani]);

  const skoc = useCallback((at: number) => {
    skokDoRef.current = Date.now() + PO_SKOKU_MS;
    ovladaniRef.current.seek(usekBodu(at).od);
  }, []);

  const spust = useCallback(
    (ids: string[]) => {
      const prvni = bodyRef.current.find((b) => b.id === ids[0]);
      if (!prvni) return;
      setStav({ ids, kde: 0 });
      skoc(prvni.atSeconds);
      ovladaniRef.current.play();
    },
    [skoc],
  );

  const zastav = useCallback(() => setStav(null), []);

  const tik = useCallback(
    (cas: number) => {
      const s = stavRef.current;
      if (!s) return;
      if (Date.now() < skokDoRef.current) return;

      const bod = bodyRef.current.find((b) => b.id === s.ids[s.kde]);
      // Bod mezitím zmizel (smazaný zápis) — přehrávání nemá kde stát.
      if (!bod) {
        setStav(null);
        return;
      }
      if (!usekDobehl(cas, usekBodu(bod.atSeconds))) return;

      const dalsi = s.kde + 1;
      if (dalsi >= s.ids.length) {
        setStav(null);
        return;
      }
      const cil = bodyRef.current.find((b) => b.id === s.ids[dalsi]);
      if (!cil) {
        setStav(null);
        return;
      }
      setStav({ ids: s.ids, kde: dalsi });
      skoc(cil.atSeconds);
    },
    [skoc],
  );

  return {
    bezi: stav != null,
    kde: stav ? stav.kde + 1 : 0,
    pocet: stav?.ids.length ?? 0,
    aktualniId: stav ? (stav.ids[stav.kde] ?? null) : null,
    spust,
    zastav,
    tik,
  };
}
