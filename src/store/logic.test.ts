import { describe, expect, it } from 'vitest';
import { addExecutive, addItem, aiRequestsLeft, applyActions, completeOnboarding, initialState, makeItem, newExecutive, removeExecutive, removeItems, toggleDone } from './logic';
import { buildReport, briefFor } from '@/lib/report';
import { deriveAlerts } from '@/lib/alerts';
import { ActionSchema } from '@/lib/model';
import { addDays, toLocalDateTime, todayKey } from '@/lib/dates';

function seeded() {
  const ex = newExecutive({ name: 'Adaeze Okafor', addressAs: 'Mrs. Okafor', traits: ['Short messages'] });
  return { s: completeOnboarding(initialState(), 'Boluwatife', ex), ex };
}

describe('store logic', () => {
  it('onboards one executive and makes them active', () => {
    const { s, ex } = seeded();
    expect(s.profile.onboarded).toBe(true);
    expect(s.activeExecId).toBe(ex.id);
  });

  it('caps executives at five', () => {
    let { s } = seeded();
    for (let i = 0; i < 6; i++) s = addExecutive(s, newExecutive({ name: `Exec ${i}`, addressAs: `E${i}` }));
    expect(s.executives).toHaveLength(5);
  });

  it('removing an executive removes everything about them', () => {
    let { s, ex } = seeded();
    const other = newExecutive({ name: 'Tunde Ene', addressAs: 'Mr. Ene' });
    s = addExecutive(s, other);
    s = addItem(s, makeItem(ex.id, 'todo', 'Keep me'));
    s = addItem(s, makeItem(other.id, 'todo', 'Remove me'));
    s = removeExecutive(s, other.id);
    expect(s.items.map((i) => i.title)).toEqual(['Keep me']);
    expect(s.activeExecId).toBe(ex.id);
  });

  it('applies approved agent actions and can undo them', () => {
    const { s, ex } = seeded();
    const due = toLocalDateTime(addDays(new Date(), 1));
    const actions = [
      ActionSchema.parse({ kind: 'add_todo', title: 'Chase Finance for Q3 numbers', due }),
      ActionSchema.parse({ kind: 'add_reminder', title: 'Call Tunde', remind_at: due }),
      ActionSchema.parse({ kind: 'plan_day', date: todayKey(), blocks: [{ start: '10:00', end: '11:00', title: 'Board pack', kind: 'focus' }, { start: '09:00', end: '09:30', title: 'Inbox' }] }),
      ActionSchema.parse({ kind: 'draft_message', to: 'Finance', channel: 'email', body: 'Please send the Q3 numbers by 1pm.' }),
      ActionSchema.parse({ kind: 'remember_preference', text: 'Wants two options, not five' }),
    ];
    const r = applyActions(s, ex.id, actions);
    expect(r.state.items).toHaveLength(2);
    expect(r.state.plan.map((b) => b.start)).toEqual(['09:00', '10:00']);
    expect(r.state.drafts).toHaveLength(1);
    expect(r.state.executives[0]!.learned[0]!.text).toBe('Wants two options, not five');
    const undone = removeItems(r.state, r.createdIds);
    expect(undone.items).toHaveLength(0);
    expect(undone.plan).toHaveLength(0);
    expect(undone.executives[0]!.learned).toHaveLength(0);
  });

  it('rejects malformed actions', () => {
    expect(ActionSchema.safeParse({ kind: 'add_reminder', title: 'x', remind_at: 'tomorrow' }).success).toBe(false);
    expect(ActionSchema.safeParse({ kind: 'send_email', to: 'boss' }).success).toBe(false);
  });

  it('free plan allows five AI requests once the limit is on; own key lifts it', () => {
    const { s } = seeded();
    expect(aiRequestsLeft(s, 5)).toBe(5);
    expect(aiRequestsLeft({ ...s, usage: { aiRequests: 5, plan: 'free' } }, 5)).toBe(0);
    expect(aiRequestsLeft({ ...s, settings: { ...s.settings, ownKey: 'k' } }, 5)).toBe(Infinity);
  });
});

describe('report, brief and alerts', () => {
  it('builds a report with done, open and evidence counts', () => {
    let { s, ex } = seeded();
    const done = makeItem(ex.id, 'todo', 'Confirm AC technician', { evidence: [{ id: 'e1', name: 'ac.jpg', mime: 'image/jpeg', size: 1, addedAt: '' }] });
    s = addItem(s, done);
    s = toggleDone(s, done.id);
    s = addItem(s, makeItem(ex.id, 'todo', 'Follow up Finance', { due: toLocalDateTime(addDays(new Date(), -2)) }));
    const text = buildReport(s, ex);
    expect(text).toContain('Good evening Mrs. Okafor');
    expect(text).toContain('• Confirm AC technician (1 attached)');
    expect(text).toContain('Follow up Finance (overdue since');
    expect(text.trim().endsWith('Boluwatife')).toBe(true);
  });

  it('brief and alerts flag overdue work', () => {
    let { s, ex } = seeded();
    s = addItem(s, makeItem(ex.id, 'todo', 'Follow up Finance', { due: toLocalDateTime(addDays(new Date(), -1)) }));
    expect(briefFor(s, ex)[0]).toMatch(/^1 overdue: Follow up Finance/);
    expect(deriveAlerts(s, ex).some((a) => a.kind === 'overdue')).toBe(true);
  });
});
