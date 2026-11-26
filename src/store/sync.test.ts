import { describe, expect, it } from 'vitest';
import { mergeStates, toCloud } from './sync';
import { addItem, completeOnboarding, initialState, makeItem, newExecutive } from './logic';

function seeded() {
  const ex = newExecutive({ name: 'Adaeze Okafor', addressAs: 'Mrs. Okafor' });
  return { s: completeOnboarding(initialState(), 'Boluwatife', ex), ex };
}

describe('cloud sync', () => {
  it('never uploads the own OpenRouter key or calendar cache', () => {
    const { s } = seeded();
    const withKey = { ...s, settings: { ...s.settings, ownKey: 'sk-secret' }, events: { x: { fetchedAt: '', items: [] } } };
    const out = toCloud(withKey);
    expect(out.settings.ownKey).toBe('');
    expect(out.events).toEqual({});
  });

  it('keeps work from both devices when they saved at the same time', () => {
    const { s, ex } = seeded();
    const a = makeItem(ex.id, 'todo', 'Book Abuja flight');
    const b = makeItem(ex.id, 'todo', 'Send board pack');
    const phone = addItem(s, a);
    const laptop = addItem(s, b);
    const merged = mergeStates(phone, laptop);
    expect(merged.items.map((i) => i.title).sort()).toEqual(['Book Abuja flight', 'Send board pack']);
  });

  it('prefers this device for the same record', () => {
    const { s, ex } = seeded();
    const it0 = makeItem(ex.id, 'todo', 'Draft memo');
    const remote = addItem(s, it0);
    const local = addItem(s, { ...it0, title: 'Draft memo v2' });
    expect(mergeStates(local, remote).items.find((i) => i.id === it0.id)?.title).toBe('Draft memo v2');
  });
});
