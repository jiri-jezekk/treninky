const pad2 = (n: number) => String(n).padStart(2, "0");

/** Kalendářní datum jako DD/MM/YYYY. */
export function formatDateDdMmYyyy(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Samotný čas v 24hodinovém formátu: HH:mm */
export function formatTime24h(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Datum a čas v 24hodinovém formátu: DD/MM/YYYY HH:mm */
export function formatDateTimeDdMmYyyy24h(d: Date): string {
  return `${formatDateDdMmYyyy(d)} ${formatTime24h(d)}`;
}

/** Řetězec DD/MM/YYYY → lokální datum (00:00), nebo null při neplatné kombinaci. */
export function parseDdMmYyyy(s: string): Date | null {
  const t = s.trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
}

/** Čas HH:mm (24 h). */
export function parseTime24h(s: string): { hour: number; minute: number } | null {
  const t = s.trim();
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** Jedno datum + čas v lokálním čase. */
export function combineDdMmYyyyAndTime24h(dateStr: string, timeStr: string): Date {
  const d = parseDdMmYyyy(dateStr);
  const tm = parseTime24h(timeStr);
  if (!d || !tm) {
    throw new Error("Neplatné datum nebo čas. Použijte DD/MM/YYYY a HH:mm (24 h).");
  }
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    tm.hour,
    tm.minute,
    0,
    0,
  );
}

/**
 * Datum z nativního `<input type="date">` (YYYY-MM-DD) nebo ručně psané
 * DD/MM/YYYY, k tomu čas HH:mm. Na telefonu je nativní výběr pohodlnější,
 * ruční zápis ale dál projde.
 */
export function combineDateInputAndTime(dateStr: string, timeStr: string): Date {
  const iso = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const ddmm = iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : dateStr;
  return combineDdMmYyyyAndTime24h(ddmm, timeStr);
}

/** Datum pro nativní `<input type="date">`: YYYY-MM-DD v místním čase. */
export function formatDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Datum v poledni — pro bezpečné procházení rozsahu dnů (hromadné tréninky). */
export function parseDdMmYyyyAtNoon(s: string): Date | null {
  const d = parseDdMmYyyy(s);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}
