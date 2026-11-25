import { CalendarError, connect, disconnect, hasToken, listCalendars, listEvents } from '@/lib/gcal';
import { getState, setState } from '@/store/store';
import { calendarFor, disconnectGoogle, setEvents, setGoogle } from '@/store/logic';

/** First connection: Google's consent screen, then the list of calendars the assistant can see. Call from a tap. */
export async function connectGoogle(): Promise<void> {
  await connect();
  const { email, calendars } = await listCalendars();
  setState((st) => setGoogle(st, { connected: true, email, calendars }));
}

/** Gets a fresh token when the hour is up. Silent if the assistant already consented. Call from a tap. */
export async function ensureToken(): Promise<void> {
  if (hasToken()) return;
  await connect({ silent: true, hint: getState().settings.google.email });
}

export async function refreshEvents(execId: string): Promise<void> {
  const cal = calendarFor(getState(), execId);
  if (!cal) return;
  const items = await listEvents(cal.id);
  setState((st) => setEvents(st, execId, items));
}

/** Re-reads the calendar list too, so newly shared calendars show up. */
export async function refreshCalendars(): Promise<void> {
  await ensureToken();
  const { email, calendars } = await listCalendars();
  setState((st) => setGoogle(st, { email: email || st.settings.google.email, calendars }));
}

export function disconnectGoogleCalendar(): void {
  disconnect();
  setState(disconnectGoogle);
}

export function calendarMessage(err: unknown): string {
  return err instanceof CalendarError ? err.message : 'Google Calendar had a problem. Try again.';
}

const STALE_MS = 5 * 60_000;
export function isStale(fetchedAt: string | undefined, now = Date.now()): boolean {
  return !fetchedAt || now - new Date(fetchedAt).getTime() > STALE_MS;
}
