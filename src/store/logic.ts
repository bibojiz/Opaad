import type { Action, AppState, CalEvent, ChatMessage, Draft, Executive, GoogleSettings, Item, ItemType, PlanBlock, Report } from '@/lib/model';
import { MAX_EXECUTIVES } from '@/lib/model';
import { todayKey, uid } from '@/lib/dates';
import { IN_PREVIEW } from '@/lib/env';

export function initialState(): AppState {
  return {
    version: 1,
    profile: { name: '', role: 'Executive Assistant', onboarded: false, createdAt: new Date().toISOString() },
    executives: [],
    activeExecId: '',
    items: [],
    plan: [],
    drafts: [],
    reports: [],
    chats: {},
    usage: { aiRequests: 0, plan: 'free' },
    readAlerts: [],
    settings: { notifications: 'default', ownKey: '', google: { connected: false, email: '', calendars: [], execCalendar: {} } },
    events: {},
  };
}

export function activeExec(s: AppState): Executive | undefined {
  return s.executives.find((e) => e.id === s.activeExecId) ?? s.executives[0];
}

export function newExecutive(input: Pick<Executive, 'name' | 'addressAs'> & Partial<Executive>): Executive {
  return {
    id: uid('ex_'),
    role: '',
    org: '',
    pronoun: 'she',
    traits: [],
    samples: [],
    learned: [],
    neverSuggest: [],
    createdAt: new Date().toISOString(),
    ...input,
  };
}

export function completeOnboarding(s: AppState, name: string, exec: Executive): AppState {
  return { ...s, profile: { ...s.profile, name, onboarded: true }, executives: [exec], activeExecId: exec.id };
}

export function addExecutive(s: AppState, exec: Executive): AppState {
  if (s.executives.length >= MAX_EXECUTIVES) return s;
  return { ...s, executives: [...s.executives, exec], activeExecId: exec.id };
}

export function updateExecutive(s: AppState, id: string, patch: Partial<Executive>): AppState {
  return { ...s, executives: s.executives.map((e) => (e.id === id ? { ...e, ...patch, id: e.id } : e)) };
}

/** Removes an executive and everything Opaad holds about them. */
export function removeExecutive(s: AppState, id: string): AppState {
  const executives = s.executives.filter((e) => e.id !== id);
  const chats = { ...s.chats };
  delete chats[id];
  return {
    ...s,
    executives,
    activeExecId: s.activeExecId === id ? (executives[0]?.id ?? '') : s.activeExecId,
    items: s.items.filter((i) => i.execId !== id),
    plan: s.plan.filter((b) => b.execId !== id),
    drafts: s.drafts.filter((d) => d.execId !== id),
    reports: s.reports.filter((r) => r.execId !== id),
    chats,
    events: Object.fromEntries(Object.entries(s.events).filter(([k]) => k !== id)),
    settings: { ...s.settings, google: { ...s.settings.google, execCalendar: Object.fromEntries(Object.entries(s.settings.google.execCalendar).filter(([k]) => k !== id)) } },
  };
}

export function makeItem(execId: string, type: ItemType, title: string, extra: Partial<Item> = {}): Item {
  return {
    id: uid('it_'),
    execId,
    type,
    title: title.trim().slice(0, 200),
    body: '',
    due: '',
    tag: '',
    raiseWithExec: false,
    done: false,
    doneAt: '',
    notified: false,
    evidence: [],
    source: 'manual',
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

export function addItem(s: AppState, item: Item): AppState {
  return { ...s, items: [...s.items, item] };
}

export function updateItem(s: AppState, id: string, patch: Partial<Item>): AppState {
  return { ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...patch, id: i.id } : i)) };
}

export function toggleDone(s: AppState, id: string, now = new Date()): AppState {
  return {
    ...s,
    items: s.items.map((i) => (i.id === id ? { ...i, done: !i.done, doneAt: i.done ? '' : now.toISOString() } : i)),
  };
}

export function removeItems(s: AppState, ids: string[]): AppState {
  const set = new Set(ids);
  return {
    ...s,
    items: s.items.filter((i) => !set.has(i.id)),
    plan: s.plan.filter((b) => !set.has(b.id)),
    drafts: s.drafts.filter((d) => !set.has(d.id)),
    executives: s.executives.map((e) => ({ ...e, learned: e.learned.filter((l) => !set.has(l.id)) })),
  };
}

export function setPlan(s: AppState, execId: string, date: string, blocks: Omit<PlanBlock, 'id' | 'execId' | 'date'>[]): { state: AppState; ids: string[] } {
  const made = blocks
    .map((b) => ({ ...b, id: uid('pb_'), execId, date }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const kept = s.plan.filter((b) => !(b.execId === execId && b.date === date));
  return { state: { ...s, plan: [...kept, ...made] }, ids: made.map((b) => b.id) };
}

export function addDraft(s: AppState, d: Omit<Draft, 'id' | 'createdAt'>): { state: AppState; id: string } {
  const draft: Draft = { ...d, id: uid('dr_'), createdAt: new Date().toISOString() };
  return { state: { ...s, drafts: [draft, ...s.drafts].slice(0, 50) }, id: draft.id };
}

export function upsertReport(s: AppState, r: Report): AppState {
  const others = s.reports.filter((x) => !(x.execId === r.execId && x.date === r.date));
  return { ...s, reports: [...others, r] };
}

export function addLearned(s: AppState, execId: string, text: string, source: string): { state: AppState; id: string } {
  const id = uid('lp_');
  return {
    state: updateExecutive(s, execId, {
      learned: [...(s.executives.find((e) => e.id === execId)?.learned ?? []), { id, text: text.slice(0, 200), source, createdAt: new Date().toISOString() }],
    }),
    id,
  };
}

export function appendMessage(s: AppState, execId: string, m: ChatMessage): AppState {
  const list = s.chats[execId] ?? [];
  return { ...s, chats: { ...s.chats, [execId]: [...list, m].slice(-60) } };
}

export function updateMessage(s: AppState, execId: string, id: string, patch: Partial<ChatMessage>): AppState {
  const list = s.chats[execId] ?? [];
  return { ...s, chats: { ...s.chats, [execId]: list.map((m) => (m.id === id ? { ...m, ...patch } : m)) } };
}

export type ApplyResult = { state: AppState; createdIds: string[]; reportText?: string; summary: string[] };

/** Runs approved agent actions against the store. Pure: returns the new state and the ids it created (for undo). */
export function applyActions(s: AppState, execId: string, actions: Action[]): ApplyResult {
  let state = s;
  const createdIds: string[] = [];
  const summary: string[] = [];
  let reportText: string | undefined;
  for (const a of actions) {
    switch (a.kind) {
      case 'add_todo': {
        const it = makeItem(execId, 'todo', a.title, { due: a.due ?? '', body: a.notes ?? '', source: 'agent' });
        state = addItem(state, it);
        createdIds.push(it.id);
        summary.push(`To-do: ${a.title}`);
        break;
      }
      case 'add_reminder': {
        const it = makeItem(execId, 'reminder', a.title, { due: a.remind_at, source: 'agent' });
        state = addItem(state, it);
        createdIds.push(it.id);
        summary.push(`Reminder: ${a.title}`);
        break;
      }
      case 'add_note': {
        const it = makeItem(execId, 'note', a.title, { body: a.body ?? '', raiseWithExec: !!a.raise_with_executive, source: 'agent' });
        state = addItem(state, it);
        createdIds.push(it.id);
        summary.push(`Note: ${a.title}`);
        break;
      }
      case 'plan_day': {
        const r = setPlan(state, execId, a.date, a.blocks.map((b) => ({ start: b.start, end: b.end, title: b.title, kind: b.kind ?? 'task' })));
        state = r.state;
        createdIds.push(...r.ids);
        summary.push(`Plan for ${a.date === todayKey() ? 'today' : a.date}: ${a.blocks.length} blocks`);
        break;
      }
      case 'draft_message': {
        const r = addDraft(state, { execId, to: a.to, channel: a.channel, subject: a.subject ?? '', body: a.body });
        state = r.state;
        createdIds.push(r.id);
        summary.push(`Draft to ${a.to}`);
        break;
      }
      case 'write_report': {
        reportText = a.text;
        state = upsertReport(state, { execId, date: todayKey(), text: a.text, edited: true, sentVia: '', sentAt: '' });
        summary.push("Tonight's report drafted");
        break;
      }
      case 'add_event': {
        // Reached only when the calendar can't take it (not connected, or read-only): keep it as a reminder at the start time.
        const it = makeItem(execId, 'reminder', a.title, { due: a.start, body: [a.location, a.notes].filter(Boolean).join('\n'), source: 'agent' });
        state = addItem(state, it);
        createdIds.push(it.id);
        summary.push(`Reminder: ${a.title}`);
        break;
      }
      case 'remember_preference': {
        const r = addLearned(state, execId, a.text, 'From your request');
        state = r.state;
        createdIds.push(r.id);
        summary.push(`Remember: ${a.text}`);
        break;
      }
    }
  }
  return { state, createdIds, reportText, summary };
}

export function aiRequestsLeft(s: AppState, freeLimit: number): number {
  // The claude.ai preview is for testing: Claude answers there, so no free-plan cap.
  if (IN_PREVIEW || s.usage.plan === 'pro' || s.settings.ownKey) return Infinity;
  return Math.max(0, freeLimit - s.usage.aiRequests);
}

/* ---------- Google Calendar ---------- */

export function setGoogle(s: AppState, patch: Partial<GoogleSettings>): AppState {
  return { ...s, settings: { ...s.settings, google: { ...s.settings.google, ...patch } } };
}

/** The calendar Opaad reads and writes for this executive: the one picked in Settings, else the assistant's primary. */
export function calendarFor(s: AppState, execId: string): GoogleSettings['calendars'][number] | null {
  const g = s.settings.google;
  if (!g.connected) return null;
  const id = g.execCalendar[execId];
  return g.calendars.find((c) => c.id === id) ?? g.calendars.find((c) => c.primary) ?? null;
}

export function setEvents(s: AppState, execId: string, items: CalEvent[], fetchedAt: string = new Date().toISOString()): AppState {
  return { ...s, events: { ...s.events, [execId]: { fetchedAt, items } } };
}

export function addEventLocal(s: AppState, execId: string, ev: CalEvent): AppState {
  const cur = s.events[execId];
  const items = [...(cur?.items ?? []).filter((e) => e.id !== ev.id), ev].sort((a, b) => a.start.localeCompare(b.start));
  return { ...s, events: { ...s.events, [execId]: { fetchedAt: cur?.fetchedAt ?? new Date().toISOString(), items } } };
}

export function removeEventLocal(s: AppState, execId: string, eventId: string): AppState {
  const cur = s.events[execId];
  if (!cur) return s;
  return { ...s, events: { ...s.events, [execId]: { ...cur, items: cur.items.filter((e) => e.id !== eventId) } } };
}

export function disconnectGoogle(s: AppState): AppState {
  return { ...s, events: {}, settings: { ...s.settings, google: { connected: false, email: '', calendars: [], execCalendar: {} } } };
}
