import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CornerDownLeft, Plus, X } from 'lucide-react';
import { setState, useApp } from '@/store/store';
import { activeExec, addItem, makeItem } from '@/store/logic';
import { AlertsBell, PageHeader, useShell } from '@/app/shell';
import { Empty } from '@/components/ui';
import { ItemRow } from './ItemRow';
import { QuickAdd } from './QuickAdd';
import type { Item, ItemType } from '@/lib/model';
import { addDays, atTime, isOverdue, isToday, todayKey, toLocalDateTime } from '@/lib/dates';

const TABS: { id: ItemType; label: string; dot: string; word: string }[] = [
  { id: 'todo', label: 'To do', dot: 'bg-todo', word: 'to-do' },
  { id: 'note', label: 'Notes', dot: 'bg-note', word: 'note' },
  { id: 'reminder', label: 'Reminders', dot: 'bg-reminder', word: 'reminder' },
];

function groupsFor(tab: ItemType, items: Item[], now: Date): { name: string; tone?: 'danger'; items: Item[] }[] {
  const open = items.filter((i) => !i.done);
  const byDue = (a: Item, b: Item) => (a.due || 'z').localeCompare(b.due || 'z');
  if (tab === 'note') {
    return [
      { name: 'To raise', items: open.filter((i) => i.raiseWithExec) },
      { name: 'Notes', items: open.filter((i) => !i.raiseWithExec).reverse() },
    ];
  }
  const doneToday = items.filter((i) => i.done && i.doneAt && todayKey(new Date(i.doneAt)) === todayKey(now));
  return [
    { name: 'Overdue', tone: 'danger', items: open.filter((i) => i.due && isOverdue(i.due, now)).sort(byDue) },
    { name: 'Today', items: open.filter((i) => i.due && isToday(i.due, now) && !isOverdue(i.due, now)).sort(byDue) },
    { name: 'Coming up', items: open.filter((i) => i.due && !isToday(i.due, now) && !isOverdue(i.due, now)).sort(byDue) },
    { name: 'No date', items: open.filter((i) => !i.due) },
    { name: 'Done today', items: doneToday },
  ];
}

export function Tasks() {
  const s = useApp();
  const exec = activeExec(s)!;
  const { openAsk } = useShell();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'todo') as ItemType;
  const [fresh, setFresh] = useState('');
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const inlineRef = useRef<HTMLInputElement>(null);
  const now = new Date();
  const mine = s.items.filter((i) => i.execId === exec.id);
  const overdue = mine.filter((i) => !i.done && i.type !== 'note' && i.due && isOverdue(i.due, now)).length;
  const groups = groupsFor(tab, mine.filter((i) => i.type === tab), now).filter((g) => g.items.length);
  const word = TABS.find((t) => t.id === tab)!.word;

  useEffect(() => {
    if (adding) inlineRef.current?.focus();
  }, [adding]);

  const setTab = (id: ItemType) => {
    setParams(id === 'todo' ? {} : { tab: id }, { replace: true });
    setAdding(false);
  };

  const commit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    const due = tab === 'todo' ? toLocalDateTime(atTime(now, Math.max(17, now.getHours() + 1))) : tab === 'reminder' ? toLocalDateTime(atTime(addDays(now, now.getHours() >= 17 ? 1 : 0), now.getHours() >= 17 ? 9 : 17)) : '';
    const it = makeItem(exec.id, tab, t, { due });
    setState((st) => addItem(st, it));
    setFresh(it.id);
    setText('');
  };

  return (
    <div className="flex min-h-dvh flex-col pb-32">
      <PageHeader title="Tasks" subtitle={`For ${exec.addressAs}${overdue ? ` · ${overdue} overdue` : ''}`}>
        <AlertsBell />
      </PageHeader>
      <div className="mx-auto w-full max-w-3xl px-4 lg:px-8">
        <div role="tablist" aria-label="Task type" className="grid grid-cols-3 gap-1.5 rounded-card border border-line bg-subtle p-1.5">
          {TABS.map((t) => {
            const count = mine.filter((i) => i.type === t.id && !i.done).length;
            const on = t.id === tab;
            return (
              <button key={t.id} role="tab" aria-selected={on} onClick={() => setTab(t.id)} className={`flex h-10 items-center justify-center gap-1.5 rounded-field px-1 text-sm whitespace-nowrap ${on ? 'border border-ink bg-surface font-semibold' : 'border border-transparent font-medium'}`}>
                <span aria-hidden className={`size-2 shrink-0 rounded-full ${t.dot}`} />
                {t.label}
                <span className="text-xs text-ink-2">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <main role="tabpanel" className="mx-auto mt-3 w-full max-w-3xl flex-1 border-t border-line bg-surface px-4 pt-2 lg:rounded-card lg:border lg:px-6">
        {groups.map((g) => (
          <section key={g.name} className="pt-4">
            <h2 className={`mb-1 text-xs font-semibold tracking-wider uppercase ${g.tone === 'danger' ? 'text-danger-ink' : 'text-ink-2'}`}>{g.name}</h2>
            <ul>{g.items.map((i) => <ItemRow key={i.id} item={i} fresh={i.id === fresh} />)}</ul>
          </section>
        ))}
        {!groups.length && !adding && (
          <div className="pt-4">
            <Empty title={`No ${word}s yet`} body={`Add one below, or press + to choose what to add. You can also tell Opaad everything at once and approve what it sets up.`} />
          </div>
        )}

        {adding ? (
          <form onSubmit={commit} onKeyDown={(e) => e.key === 'Escape' && setAdding(false)} className="anim-row-in mt-3 flex items-center gap-2">
            <div className="flex h-13 flex-1 items-center gap-2 rounded-card border border-line bg-subtle pr-1.5 pl-3 focus-within:border-ink">
              <span aria-hidden className="size-4.5 shrink-0 rounded-full border-[1.5px] border-ink-3" />
              <label htmlFor="inline-add" className="sr-only">New {word}</label>
              <input id="inline-add" ref={inlineRef} value={text} onChange={(e) => setText(e.target.value)} placeholder={tab === 'note' ? 'Write a note' : tab === 'reminder' ? 'Remind me to…' : 'What needs doing?'} autoComplete="off" enterKeyHint="enter" className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none" />
              <button type="submit" aria-label="Add" className="flex size-10 items-center justify-center rounded-[10px] border border-line bg-surface">
                <CornerDownLeft size={16} aria-hidden />
              </button>
            </div>
            <button type="button" onClick={() => setAdding(false)} aria-label="Done adding" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface">
              <X size={16} aria-hidden />
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="mt-2 flex h-12 w-full items-center gap-3 text-[15px] text-ink-2">
            <span aria-hidden className="flex size-6 items-center justify-center rounded-full border-[1.5px] border-dashed border-ink-3">
              <Plus size={12} strokeWidth={2.6} />
            </span>
            Add {word}
          </button>
        )}
        {adding && <p className="mt-1.5 pl-1 text-xs text-ink-3">Enter adds it and keeps this row open for the next one. Esc closes.</p>}

        <button type="button" onClick={() => openAsk({ prompt: 'What on my list can move to tomorrow, and what should I do first?', send: true })} className="mt-5 mb-6 flex w-full items-center gap-3 rounded-card border border-dashed border-ink-3 p-3 text-left">
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold">Too much on today?</span>
            <span className="text-[13px] text-ink-2">Ask Opaad what can move to tomorrow</span>
          </span>
        </button>
      </main>

      <QuickAdd
        onAdded={(id, kind) => {
          if (kind !== 'evidence') setTab(kind === 'todo' ? 'todo' : kind);
          setFresh(id);
        }}
      />
    </div>
  );
}
