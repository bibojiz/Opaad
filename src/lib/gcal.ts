import type { CalEvent } from './model';
import { addDays, parseLocal, todayKey, toLocalDateTime } from './dates';
import { IN_PREVIEW } from './env';

/**
 * Google Calendar, in the browser, with Google Identity Services (token model).
 * The access token lives in memory only (about an hour); nothing about it is stored.
 * Scopes: list the calendars the assistant can see, and read/create events in them.
 */
export const SCOPES = 'https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events';
const API = 'https://www.googleapis.com/calendar/v3';

export const CLIENT_ID: string = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';
export const calendarAvailable = (): boolean => !IN_PREVIEW && CLIENT_ID.length > 0;

type TokenResponse = { access_token?: string; expires_in?: number; error?: string; error_description?: string };
type TokenClient = { requestAccessToken: (o?: { prompt?: string; hint?: string }) => void; callback: (r: TokenResponse) => void };
type Gis = { accounts: { oauth2: { initTokenClient: (c: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type: string }) => void }) => TokenClient; revoke: (t: string, cb: () => void) => void } } };

let token = '';
let tokenExpires = 0;
let client: TokenClient | null = null;
let loading: Promise<void> | null = null;

export function hasToken(): boolean {
  return !!token && Date.now() < tokenExpires - 60_000;
}

function loadGis(): Promise<void> {
  if ((window as unknown as { google?: Gis }).google?.accounts?.oauth2) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new CalendarError('Could not reach Google. Check your connection and try again.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export class CalendarError extends Error {
  constructor(
    message: string,
    public code: 'auth' | 'network' | 'denied' | 'not_found' | 'unknown' = 'unknown',
  ) {
    super(message);
  }
}

/** Opens Google's consent or account chooser. Call from a tap. `silent` reuses an earlier consent. */
export async function connect(opts: { silent?: boolean; hint?: string } = {}): Promise<void> {
  if (!calendarAvailable()) throw new CalendarError('Google Calendar is not set up on this site yet.', 'auth');
  await loadGis();
  const gis = (window as unknown as { google: Gis }).google;
  await new Promise<void>((resolve, reject) => {
    client = gis.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new CalendarError(r.error === 'access_denied' ? 'Google access was not allowed.' : 'Google sign-in did not finish.', 'denied'));
        token = r.access_token;
        tokenExpires = Date.now() + (r.expires_in ?? 3600) * 1000;
        resolve();
      },
      error_callback: (e) => reject(new CalendarError(e.type === 'popup_closed' ? 'The Google window was closed.' : 'Google sign-in was blocked. Allow pop-ups for Opaad.', 'denied')),
    });
    client.requestAccessToken({ prompt: opts.silent ? '' : 'consent', hint: opts.hint });
  });
}

export function disconnect(): void {
  const gis = (window as unknown as { google?: Gis }).google;
  if (token && gis) gis.accounts.oauth2.revoke(token, () => undefined);
  token = '';
  tokenExpires = 0;
}

async function call<T>(path: string, init: RequestInit = {}, fetchImpl: typeof fetch = fetch): Promise<T> {
  if (!hasToken()) throw new CalendarError('Reconnect Google Calendar to continue.', 'auth');
  let res: Response;
  try {
    res = await fetchImpl(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  } catch {
    throw new CalendarError("You're offline. Calendar will refresh when you're back.", 'network');
  }
  if (res.status === 401) {
    token = '';
    throw new CalendarError('Reconnect Google Calendar to continue.', 'auth');
  }
  if (res.status === 403) throw new CalendarError("Your Google account can't change that calendar. Ask for edit access or pick another calendar.", 'denied');
  if (res.status === 404) throw new CalendarError('That calendar or event no longer exists.', 'not_found');
  if (!res.ok) throw new CalendarError('Google Calendar had a problem. Try again.', 'unknown');
  return (res.status === 204 ? undefined : await res.json()) as T;
}

type GCalendar = { id: string; summary?: string; summaryOverride?: string; primary?: boolean; accessRole?: string };
type GEvent = { id: string; summary?: string; location?: string; htmlLink?: string; status?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } };

export async function listCalendars(fetchImpl?: typeof fetch): Promise<{ email: string; calendars: { id: string; name: string; primary: boolean; canWrite: boolean }[] }> {
  const data = await call<{ items?: GCalendar[] }>('/users/me/calendarList?minAccessRole=reader', {}, fetchImpl);
  const items = data.items ?? [];
  const primary = items.find((c) => c.primary);
  return {
    email: primary?.id ?? '',
    calendars: items.map((c) => ({ id: c.id, name: c.summaryOverride || c.summary || c.id, primary: !!c.primary, canWrite: c.accessRole === 'owner' || c.accessRole === 'writer' })),
  };
}

/** Google returns RFC 3339 times; Opaad works in local "YYYY-MM-DDTHH:mm". */
export function toEvent(e: GEvent): CalEvent | null {
  if (e.status === 'cancelled') return null;
  const allDay = !!e.start?.date && !e.start?.dateTime;
  const start = allDay ? `${e.start!.date}T00:00` : e.start?.dateTime ? toLocalDateTime(new Date(e.start.dateTime)) : '';
  const end = allDay ? `${e.end?.date ?? e.start!.date}T00:00` : e.end?.dateTime ? toLocalDateTime(new Date(e.end.dateTime)) : start;
  if (!start) return null;
  return { id: e.id, title: e.summary?.trim() || '(No title)', start, end, allDay, location: e.location ?? '', link: e.htmlLink ?? '' };
}

/** Events from the start of today to the end of tomorrow. */
export async function listEvents(calendarId: string, now: Date = new Date(), fetchImpl?: typeof fetch): Promise<CalEvent[]> {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = addDays(from, 2);
  const q = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '100' });
  const data = await call<{ items?: GEvent[] }>(`/calendars/${encodeURIComponent(calendarId)}/events?${q}`, {}, fetchImpl);
  return (data.items ?? []).flatMap((e) => {
    const ev = toEvent(e);
    return ev ? [ev] : [];
  });
}

export async function createEvent(calendarId: string, ev: { title: string; start: string; end: string; location?: string; notes?: string }, fetchImpl?: typeof fetch): Promise<CalEvent> {
  const s = parseLocal(ev.start);
  const e = parseLocal(ev.end);
  if (!s || !e || e <= s) throw new CalendarError('That event has no valid start and end time.', 'unknown');
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const body = {
    summary: ev.title,
    location: ev.location || undefined,
    description: [ev.notes, 'Added with Opaad'].filter(Boolean).join('\n\n'),
    start: { dateTime: s.toISOString(), timeZone: tz },
    end: { dateTime: e.toISOString(), timeZone: tz },
  };
  const created = await call<GEvent>(`/calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', body: JSON.stringify(body) }, fetchImpl);
  return toEvent(created)!;
}

export async function deleteEvent(calendarId: string, eventId: string, fetchImpl?: typeof fetch): Promise<void> {
  await call<void>(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' }, fetchImpl);
}

export function eventsOn(items: CalEvent[], date: string = todayKey()): CalEvent[] {
  return items.filter((e) => e.start.startsWith(date)).sort((a, b) => a.start.localeCompare(b.start));
}

/** Test hook: lets unit tests act as a signed-in user without Google's script. */
export function __setTokenForTests(t: string): void {
  token = t;
  tokenExpires = Date.now() + 3600_000;
}
