import { useState } from 'react';
import { setState, useApp } from '@/store/store';
import { calendarFor, setEvents, setGoogle } from '@/store/logic';
import { calendarAvailable } from '@/lib/gcal';
import { IN_PREVIEW } from '@/lib/env';
import { Button, Field, inputCls } from '@/components/ui';
import { useToast } from '@/components/overlays';
import { calendarMessage, connectGoogle, disconnectGoogleCalendar, refreshCalendars } from './calendar';

export function CalendarSettings() {
  const s = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const g = s.settings.google;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(calendarMessage(e));
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (IN_PREVIEW) body = <p className="text-sm leading-relaxed text-ink-2">Google Calendar connects in the released app. This preview can't reach Google.</p>;
  else if (!calendarAvailable()) body = <p className="text-sm leading-relaxed text-ink-2">Google Calendar isn't switched on for this site yet.</p>;
  else if (!g.connected)
    body = (
      <>
        <p className="text-sm leading-relaxed text-ink-2">
          Connect the Google account you use for work. Calendars your executives share with you show up here, and you pick which one is theirs. Opaad reads today's and tomorrow's events, and adds an event only after you approve it.
        </p>
        <Button variant="secondary" className="self-start" disabled={busy} onClick={() => void run(connectGoogle)}>
          {busy ? 'Connecting…' : 'Connect Google Calendar'}
        </Button>
      </>
    );
  else
    body = (
      <>
        <p className="text-sm text-ink-2">Connected as {g.email || 'your Google account'}.</p>
        {s.executives.map((ex) => {
          const cal = calendarFor(s, ex.id);
          return (
            <Field key={ex.id} label={`${ex.name}'s calendar`}>
              <select
                className={`${inputCls} h-11`}
                value={cal?.id ?? ''}
                onChange={(e) => {
                  const id = e.target.value;
                  setState((st) => setEvents(setGoogle(st, { execCalendar: { ...st.settings.google.execCalendar, [ex.id]: id } }), ex.id, [], ''));
                }}
              >
                {g.calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.primary ? ' (yours)' : ''}
                    {c.canWrite ? '' : ' · view only'}
                  </option>
                ))}
              </select>
            </Field>
          );
        })}
        <p className="text-[13px] leading-relaxed text-ink-3">Don't see an executive's calendar? Ask them to share it with {g.email || 'this account'} with "Make changes to events", then refresh the list.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => void run(async () => { await refreshCalendars(); toast('Calendar list updated'); })}>
            Refresh list
          </Button>
          <Button variant="secondary" onClick={() => { disconnectGoogleCalendar(); toast('Google Calendar disconnected'); }}>
            Disconnect
          </Button>
        </div>
      </>
    );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Google Calendar</h2>
      {body}
      {error && <p role="status" className="text-sm text-danger">{error}</p>}
    </section>
  );
}
