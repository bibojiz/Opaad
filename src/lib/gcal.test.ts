import { describe, expect, it } from 'vitest';
import { __setTokenForTests, createEvent, eventsOn, listCalendars, toEvent } from './gcal';
import { addEventLocal, applyActions, calendarFor, completeOnboarding, disconnectGoogle, initialState, newExecutive, removeExecutive, setEvents, setGoogle } from '@/store/logic';
import { buildContext } from './agent';
import { systemPrompt } from './agent-prompt';

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

function seeded() {
  const ex = newExecutive({ name: 'Adaeze Okafor', addressAs: 'Mrs. Okafor' });
  return { s: completeOnboarding(initialState(), 'Boluwatife', ex), ex };
}

describe('Google Calendar', () => {
  it('maps timed, all-day and cancelled events', () => {
    const timed = toEvent({ id: 'a', summary: 'Board meeting', start: { dateTime: new Date(2026, 10, 25, 9, 0).toISOString() }, end: { dateTime: new Date(2026, 10, 25, 10, 30).toISOString() } });
    expect(timed).toMatchObject({ title: 'Board meeting', start: '2026-11-25T09:00', end: '2026-11-25T10:30', allDay: false });
    expect(toEvent({ id: 'b', start: { date: '2026-11-25' }, end: { date: '2026-11-26' } })).toMatchObject({ title: '(No title)', allDay: true, start: '2026-11-25T00:00' });
    expect(toEvent({ id: 'c', status: 'cancelled', start: { date: '2026-11-25' } })).toBeNull();
  });

  it('lists calendars with write access and finds the primary account', async () => {
    __setTokenForTests('t');
    const r = await listCalendars(() =>
      json({ items: [{ id: 'me@x.com', summary: 'Me', primary: true, accessRole: 'owner' }, { id: 'ceo@x.com', summary: 'CEO', accessRole: 'writer' }, { id: 'hol', summary: 'Holidays', accessRole: 'reader' }] }),
    );
    expect(r.email).toBe('me@x.com');
    expect(r.calendars.map((c) => c.canWrite)).toEqual([true, true, false]);
  });

  it('rejects events that end before they start, and maps 403 to a clear message', async () => {
    __setTokenForTests('t');
    await expect(createEvent('cal', { title: 'x', start: '2026-11-25T10:00', end: '2026-11-25T09:00' }, () => json({}))).rejects.toThrow(/valid start and end/);
    await expect(createEvent('cal', { title: 'x', start: '2026-11-25T09:00', end: '2026-11-25T10:00' }, () => json({}, 403))).rejects.toThrow(/can't change that calendar/);
  });

  it('uses the picked calendar per executive, else the primary', () => {
    let { s, ex } = seeded();
    expect(calendarFor(s, ex.id)).toBeNull();
    s = setGoogle(s, { connected: true, email: 'me@x.com', calendars: [{ id: 'me@x.com', name: 'Me', primary: true, canWrite: true }, { id: 'ceo', name: 'CEO', primary: false, canWrite: true }] });
    expect(calendarFor(s, ex.id)?.id).toBe('me@x.com');
    s = setGoogle(s, { execCalendar: { [ex.id]: 'ceo' } });
    expect(calendarFor(s, ex.id)?.id).toBe('ceo');
    expect(disconnectGoogle(s).settings.google.connected).toBe(false);
    expect(removeExecutive(s, ex.id).settings.google.execCalendar).toEqual({});
  });

  it('keeps an event as a reminder when no calendar can take it', () => {
    const { s, ex } = seeded();
    const r = applyActions(s, ex.id, [{ kind: 'add_event', title: 'Call with auditors', start: '2026-11-26T11:00', end: '2026-11-26T11:30' }]);
    const it = r.state.items.find((i) => i.id === r.createdIds[0]);
    expect(it).toMatchObject({ type: 'reminder', title: 'Call with auditors', due: '2026-11-26T11:00' });
  });

  it("tells the model about today's meetings only when a calendar is connected", () => {
    let { s, ex } = seeded();
    const now = new Date(2026, 10, 25, 8, 0);
    expect(systemPrompt(buildContext(s, ex, now))).toMatch(/No calendar is connected/);
    s = setGoogle(s, { connected: true, email: 'me@x.com', calendars: [{ id: 'me@x.com', name: 'Mrs. Okafor', primary: true, canWrite: true }] });
    s = setEvents(s, ex.id, [{ id: 'e1', title: 'Board meeting', start: '2026-11-25T09:00', end: '2026-11-25T10:00', allDay: false, location: 'HQ', link: '' }]);
    s = addEventLocal(s, ex.id, { id: 'e2', title: 'Flight to Abuja', start: '2026-11-26T07:00', end: '2026-11-26T08:10', allDay: false, location: '', link: '' });
    const p = systemPrompt(buildContext(s, ex, now));
    expect(p).toMatch(/Today 09:00-10:00 Board meeting \(HQ\)/);
    expect(p).toMatch(/Tomorrow 07:00-08:10 Flight to Abuja/);
    expect(eventsOn(s.events[ex.id]!.items, '2026-11-25')).toHaveLength(1);
  });
});
