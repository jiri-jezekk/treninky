"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Přehrávač YouTube přes IFrame API.
 *
 * Proč vlastní komponenta a ne prosté <iframe>: rozbor potřebuje číst
 * aktuální čas (kliknutí na počítadlo si ho bere) a umět skočit na čas
 * (kliknutí v záznamu). Obojí jde jen přes API.
 *
 * Skript se načítá jednou pro celou stránku. Když se nenačte — zakázané
 * vkládání, blokovaný skript, žádné video — komponenta to ohlásí ven
 * a rozbor jede na stopkách. Nikdy se kvůli videu nesmí zastavit
 * zapisování; kvůli němu se to celé dělá.
 */

type YTPlayer = {
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
  destroy(): void;
};

type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: Record<string, unknown>,
  ) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const SCRIPT_ID = "youtube-iframe-api";

/** Načte skript jen jednou, i když je na stránce víc přehrávačů. */
function loadApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("bez okna"));
  if (window.YT?.Player) return Promise.resolve(window.YT);

  return new Promise((resolve, reject) => {
    const hotovo = () => {
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube API se nenačetlo"));
    };

    const existing = document.getElementById(SCRIPT_ID);
    if (!existing) {
      const s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      s.onerror = () => reject(new Error("YouTube API se nepodařilo stáhnout"));
      document.head.appendChild(s);
    }

    // API hlásí připravenost globální funkcí; navazuje se na ni,
    // aby se nepřepsala tomu, kdo si ji zaregistroval dřív.
    const puvodni = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      puvodni?.();
      hotovo();
    };

    // Když skript v prohlížeči už je a událost proběhla dřív, počkáme
    // na objekt sami. Bez toho by se přehrávač nikdy nespustil.
    const start = Date.now();
    const tik = setInterval(() => {
      if (window.YT?.Player) {
        clearInterval(tik);
        resolve(window.YT);
      } else if (Date.now() - start > 8000) {
        clearInterval(tik);
        reject(new Error("YouTube API se nenačetlo včas"));
      }
    }, 150);
  });
}

export type PlayerHandle = {
  getTime(): number;
  /** Délka záznamu v sekundách; 0, dokud ji přehrávač nezná. */
  getDuration(): number;
  seekTo(seconds: number): void;
  toggle(): void;
  isPlaying(): boolean;
};

export function YouTubePlayer({
  videoId,
  onReady,
  onFail,
  hideFullscreen = false,
}: {
  videoId: string;
  /** Ovládání ven — rodič si sáhne na čas a umí skočit. */
  onReady: (handle: PlayerHandle) => void;
  onFail: () => void;
  /**
   * Schová tlačítko celé obrazovky uvnitř YouTube. Používá to rozbor:
   * přes nativní fullscreen iframu se nedá nic vykreslit, takže by
   * tudy trenér přišel o počítadla. Rozbor má vlastní tlačítko, které
   * roztáhne celý box i s panelem.
   */
  hideFullscreen?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [chyba, setChyba] = useState(false);

  const ohlasChybu = useCallback(() => {
    setChyba(true);
    onFail();
  }, [onFail]);

  useEffect(() => {
    let player: YTPlayer | null = null;
    let zruseno = false;

    loadApi()
      .then((YT) => {
        if (zruseno || !boxRef.current) return;
        player = new YT.Player(boxRef.current, {
          videoId,
          playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            ...(hideFullscreen ? { fs: 0 } : {}),
          },
          events: {
            onReady: () => {
              if (zruseno || !player) return;
              const p = player;
              onReady({
                getTime: () => {
                  try {
                    return p.getCurrentTime();
                  } catch {
                    return 0;
                  }
                },
                getDuration: () => {
                  try {
                    const d = p.getDuration();
                    return Number.isFinite(d) && d > 0 ? d : 0;
                  } catch {
                    return 0;
                  }
                },
                seekTo: (s) => {
                  try {
                    p.seekTo(Math.max(0, s), true);
                  } catch {
                    /* přehrávač mezitím zmizel */
                  }
                },
                toggle: () => {
                  try {
                    // 1 = hraje
                    if (p.getPlayerState() === 1) p.pauseVideo();
                    else p.playVideo();
                  } catch {
                    /* přehrávač mezitím zmizel */
                  }
                },
                isPlaying: () => {
                  try {
                    return p.getPlayerState() === 1;
                  } catch {
                    return false;
                  }
                },
              });
            },
            // Zakázané vkládání, smazané video, soukromé — všechno
            // sem spadne a rozbor pojede na stopkách.
            onError: ohlasChybu,
          },
        });
      })
      .catch(ohlasChybu);

    return () => {
      zruseno = true;
      try {
        player?.destroy();
      } catch {
        /* už je pryč */
      }
    };
  }, [videoId, onReady, ohlasChybu, hideFullscreen]);

  if (chyba) return null;

  return (
    <div className="aspect-video w-full" style={{ background: "#000" }}>
      <div ref={boxRef} className="h-full w-full" />
    </div>
  );
}
