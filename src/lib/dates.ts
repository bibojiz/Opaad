const pad = (n: number) => String(n).padStart(2, '0');

export function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toLocalDateTime(d: Date): string {
  return `${todayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parses "YYYY-MM-DDTHH:mm" as local time. Returns null for empty or malformed values. */
export function parseLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  return new Date(y, mo - 1, d, h, mi);
}

export function addDays(d: Date, days: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + days);
  return c;
}

export function atTime(d: Date, hours: number, minutes = 0): Date {
  const c = new Date(d);
  c.setHours(hours, minutes, 0, 0);
  return c;
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const longDayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

export function formatTime(d: Date): string {
  return timeFmt.format(d);
}

export function formatLongDay(d: Date = new Date()): string {
  return longDayFmt.format(d);
}

/** Human label for a due value relative to now: "Today 15:00", "Tomorrow 09:00", "Fri 20 Nov, 12:00". */
export function dueLabel(value: string, now: Date = new Date()): string {
  const d = parseLocal(value);
  if (!d) return '';
  const t = formatTime(d);
  if (todayKey(d) === todayKey(now)) return `Today ${t}`;
  if (todayKey(d) === todayKey(addDays(now, 1))) return `Tomorrow ${t}`;
  if (todayKey(d) === todayKey(addDays(now, -1))) return `Yesterday ${t}`;
  return `${dayFmt.format(d)}, ${t}`;
}

export function isOverdue(value: string, now: Date = new Date()): boolean {
  const d = parseLocal(value);
  return !!d && d.getTime() < now.getTime();
}

export function isToday(value: string, now: Date = new Date()): boolean {
  const d = parseLocal(value);
  return !!d && todayKey(d) === todayKey(now);
}

export function minutesBetween(a: string, b: string): number {
  const [ah = 0, am = 0] = a.split(':').map(Number);
  const [bh = 0, bm = 0] = b.split(':').map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

export function weekStrip(now: Date = new Date()): { key: string; day: string; date: number; isToday: boolean }[] {
  const start = addDays(now, -((now.getDay() + 6) % 7));
  const wd = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    return { key: todayKey(d), day: wd.format(d), date: d.getDate(), isToday: todayKey(d) === todayKey(now) };
  });
}

export function uid(prefix = ''): string {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${r}`;
}
