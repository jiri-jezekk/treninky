/**
 * Odkaz na YouTube.
 *
 * Ukládá se jen jedenáctiznakové ID videa, ne celá URL. Odkaz, který
 * trenér zkopíruje z telefonu, s sebou nese čas, playlist a sledovací
 * parametry — kdyby se ukládal celý, měnil by se pokaždé, i když jde
 * o totéž video, a nešlo by poznat, že už rozbor existuje.
 *
 * Relativní cesty schválně: tenhle soubor spouští i kontrolní skript
 * mimo Next.js, kde alias @/ neexistuje.
 */

/** ID videa je vždycky 11 znaků z téhle abecedy. */
const ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Vytáhne ID videa z čehokoli, co jde zkopírovat: z adresy z prohlížeče,
 * ze zkráceného youtu.be, z odkazu na vložené video, z krátkého videa
 * i ze samotného ID.
 *
 * Vrací null, když to není odkaz na YouTube — pak rozbor běží na
 * stopkách a video se prostě nezobrazí.
 */
export function parseYouTubeId(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  if (text === "") return null;

  // Samotné ID, bez odkazu.
  if (ID.test(text)) return text;

  let url: URL;
  try {
    // Bez protokolu se URL nedá rozebrat, a lidé ho běžně nepíšou.
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  const youtube =
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "youtu.be";
  if (!youtube) return null;

  // youtu.be/<id>
  if (host === "youtu.be") {
    return kandidat(url.pathname.split("/")[1]);
  }

  // youtube.com/watch?v=<id>
  const v = url.searchParams.get("v");
  if (v) return kandidat(v);

  // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
  const casti = url.pathname.split("/").filter(Boolean);
  if (
    casti.length >= 2 &&
    ["embed", "shorts", "live", "v"].includes(casti[0]!.toLowerCase())
  ) {
    return kandidat(casti[1]);
  }

  return null;
}

function kandidat(raw: string | undefined): string | null {
  if (!raw) return null;
  return ID.test(raw) ? raw : null;
}

/**
 * Čas ve videu jako „12:34“, u delších záznamů „1:02:34“.
 * Používá se u každého zápisu, tak ať je krátký a čitelný.
 */
export function formatVideoTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const celkem = Math.floor(seconds);
  const h = Math.floor(celkem / 3600);
  const m = Math.floor((celkem % 3600) / 60);
  const s = celkem % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}
