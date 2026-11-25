import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { useApp } from '@/store/store';
import { calendarFor } from '@/store/logic';
import { calendarAvailable, eventsOn, hasToken } from '@/lib/gcal';
import { IN_PREVIEW } from '@/lib/env';
import { todayKey } from '@/lib/dates';
import { SectionTitle } from '@/components/ui';
import type { Executive } from '@/lib/model';
import { calendarMessage, connectGoogle, ensureToken, isStale, refreshEvents } from './calendar';

/** Today's meetings for the active executive. Reads Google only when the assistant connected it. */
export function CalendarCard({ exec }: { exec: Executive }) {
  const s = useApp();
  const cal = calendarFor(s, exec.id);
  const cache = s.events[exec.id];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Refresh quietly on open when a token is still valid. Without one, Google needs a tap.
  useEffect(() => {
    if (!cal || !hasToken() || !isStale(cache?.fetchedAt)) return;
    refreshEvents(exec.id).catch((e: unknown) => setError(calendarMessage(e)));
  }, [cal?.id, exec.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!IN_PREVIEW && !calendarAvailable()) return null;

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

  const title = (
    <SectionTitle
      action={
        cal ? (
          <button type="button" onClick={() => void run(async () => { await ensureToken(); await refreshEvents(exec.id); })} disabled={busy} aria-label="Refresh calendar" className="-mr-2 flex size-11 items-center justify-center rounded-full text-ink-3 hover:text-ink disabled:opacity-50">
            <RefreshCw size={18} className={busy ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden />
          </button>
        ) : undefined
      }
    >
      <span id="cal-h">Calendar</span>
    </SectionTitle>
  );

  if (IN_PREVIEW) {
    return (
      <section aria-labelledby="cal-h" className="flex flex-col gap-2">
        {title}
        <p className="text-sm text-ink-2">Google Calendar connects in the released app, so {exec.addressAs}'s meetings show here and Opaad plans around them.</p>
      </section>
    );
  }

  if (!cal) {
    return (
      <section aria-labelledby="cal-h" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-3">
        {title}
        <p className="text-sm leading-relaxed text-ink-2">Connect Google Calendar to see {exec.addressAs}'s meetings here. Opaad plans around them and can add events you approve.</p>
        <button type="button" disabled={busy} onClick={() => void run(connectGoogle)} className="flex h-11 items-center gap-2 self-start rounded-card bg-ink px-4 text-[15px] font-semibold text-white disabled:opacity-60">
          <CalendarDays size={18} aria-hidden /> {busy ? 'Connecting…' : 'Connect Google Calendar'}
        </button>
        {error && <p role="status" className="text-sm text-danger">{error}</p>}
      </section>
    );
  }

  const today = eventsOn(cache?.items ?? [], todayKey(now));
  const updated = cache?.fetchedAt ? new Date(cache.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <section aria-labelledby="cal-h" className="flex flex-col gap-2">
      {title}
      {today.length ? (
        <ol className="flex flex-col">
          {today.map((e) => {
            const start = e.allDay ? '' : e.start.slice(11);
            const end = e.allDay ? '' : e.end.slice(11);
            const isNow = !e.allDay && start <= hhmm && hhmm < end;
            return (
              <li key={e.id} className="border-b border-line-soft">
                <a href={e.link || undefined} target="_blank" rel="noopener noreferrer" className="flex gap-3 py-2.5">
                  <span className={`w-14 shrink-0 text-sm tabular-nums ${isNow ? 'font-semibold text-lime-ink' : 'text-ink-3'}`}>{e.allDay ? 'All day' : start}</span>
                  <span className="flex flex-1 flex-col">
                    <span className={`text-base ${!e.allDay && end <= hhmm ? 'text-ink-3' : ''}`}>{e.title}</span>
                    <span className="text-[13px] text-ink-3">
                      {e.allDay ? 'All day' : `${start}–${end}`}
                      {e.location ? ` · ${e.location}` : ''}
                    </span>
                  </span>
                  {isNow && <span className="self-start rounded-md bg-lime px-2 py-0.5 text-xs font-semibold">Now</span>}
                </a>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="py-1 text-sm text-ink-2">{cache ? 'Nothing booked today.' : 'Tap refresh to load today’s meetings.'}</p>
      )}
      <p className="text-xs text-ink-3">
        {cal.name}
        {updated ? ` · Updated ${updated}` : ''}
        {!cal.canWrite ? ' · View only' : ''} · <Link to="/settings" className="underline">Change</Link>
      </p>
      {error && <p role="status" className="text-sm text-danger">{error}</p>}
    </section>
  );
}
