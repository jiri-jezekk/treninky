const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD → lokální datum 00:00. */
export function parseIsoDateLocal(s: string): Date | null {
  const m = s.trim().match(ISO_DATE);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return null;
  }
  return dt;
}

export function toIsoDateString(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function currentMonthBounds(): { start: Date; end: Date } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m, 1, 0, 0, 0, 0);
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

const MAX_RANGE_MS = 5 * 366 * 24 * 60 * 60 * 1000;

export type StatisticsPeriod = {
  start: Date;
  end: Date;
  odIso: string;
  doIso: string;
};

/**
 * Výchozí = aktuální kalendářní měsíc (lokální čas serveru).
 * Platné `od` + `do` (YYYY-MM-DD) = vlastní rozsah včetně krajních dnů.
 */
export function parseStatisticsPeriod(query: { od?: string; do?: string }): StatisticsPeriod {
  const rawOd = query.od?.trim();
  const rawDo = query.do?.trim();
  if (rawOd && rawDo) {
    const d1 = parseIsoDateLocal(rawOd);
    const d2 = parseIsoDateLocal(rawDo);
    if (d1 && d2) {
      let start = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate(), 0, 0, 0, 0);
      let end = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate(), 23, 59, 59, 999);
      if (start.getTime() > end.getTime()) {
        const t = start;
        start = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0);
        end = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59, 999);
      }
      if (end.getTime() - start.getTime() > MAX_RANGE_MS) {
        end = new Date(start.getTime() + MAX_RANGE_MS);
      }
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      return {
        start,
        end,
        odIso: toIsoDateString(start),
        doIso: toIsoDateString(endDay),
      };
    }
  }

  const { start, end } = currentMonthBounds();
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return {
    start,
    end,
    odIso: toIsoDateString(start),
    doIso: toIsoDateString(endDay),
  };
}

/** Hranice předchozího kalendářního měsíce. */
export function previousMonthPeriod(): StatisticsPeriod {
  const now = new Date();
  const firstThis = new Date(now.getFullYear(), now.getMonth(), 1);
  const endPrev = new Date(firstThis.getTime() - 1);
  const y = endPrev.getFullYear();
  const m = endPrev.getMonth();
  const start = new Date(y, m, 1, 0, 0, 0, 0);
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return {
    start,
    end,
    odIso: toIsoDateString(start),
    doIso: toIsoDateString(endDay),
  };
}

/** Posledních N kalendářních měsíců včetně aktuálního (od 1. dne prvního měsíce do konce posledního). */
export function lastNMonthsPeriod(months: number): StatisticsPeriod {
  const n = Math.min(36, Math.max(1, Math.floor(months)));
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const startMonth = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1, 0, 0, 0, 0);
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return {
    start: startMonth,
    end,
    odIso: toIsoDateString(startMonth),
    doIso: toIsoDateString(endDay),
  };
}

export function buildStatistikyHref(
  basePath: string,
  p: { od?: string; do?: string; skupina?: string | null },
): string {
  const params = new URLSearchParams();
  if (p.skupina) params.set("skupina", p.skupina);
  if (p.od) params.set("od", p.od);
  if (p.do) params.set("do", p.do);
  const q = params.toString();
  return q ? `${basePath}?${q}` : basePath;
}
