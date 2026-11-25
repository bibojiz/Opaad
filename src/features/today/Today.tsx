import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { useApp } from '@/store/store';
import { activeExec } from '@/store/logic';
import { AlertsBell, PageHeader, useShell } from '@/app/shell';
import { OpaadMark, SectionTitle } from '@/components/ui';
import { QuickAdd, type AddKind, type QuickAddRequest } from '@/features/tasks/QuickAdd';
import { ItemRow } from '@/features/tasks/ItemRow';
import { CalendarCard } from '@/features/calendar/CalendarCard';
import { briefFor } from '@/lib/report';
import { dueLabel, greeting, isOverdue, todayKey, weekStrip } from '@/lib/dates';

export function Today() {
  const s = useApp();
  const exec = activeExec(s)!;
  const { openAsk } = useShell();
  const [params, setParams] = useSearchParams();
  const [qa, setQa] = useState<QuickAddRequest>(null);
  const [fresh, setFresh] = useState('');
  const now = new Date();
  const mine = useMemo(() => s.items.filter((i) => i.execId === exec.id), [s.items, exec.id]);
  const open = mine.filter((i) => !i.done);
  const brief = briefFor(s, exec, now);
  const plan = s.plan.filter((b) => b.execId === exec.id && b.date === todayKey(now));
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const outstanding = open.filter((i) => i.type !== 'note' && (!i.due || isOverdue(i.due, now))).sort((a, b) => (a.due || 'z').localeCompare(b.due || 'z'));
  const [hint, setHint] = useState(() => params.get('welcome') === '1' || sessionStorage.getItem('opaad:welcome') === '1');
  const showHint = hint;

  const cards: { kind: AddKind; label: string; cls: string; items: typeof open }[] = [
    { kind: 'todo', label: 'To do', cls: 'bg-todo', items: open.filter((i) => i.type === 'todo').slice(0, 3) },
    { kind: 'note', label: 'Notes', cls: 'bg-note', items: open.filter((i) => i.type === 'note').slice(-2).reverse() },
    { kind: 'reminder', label: 'Reminders', cls: 'bg-reminder text-[#F3F5ED]', items: open.filter((i) => i.type === 'reminder').sort((a, b) => a.due.localeCompare(b.due)).slice(0, 3) },
  ];

  return (
    <div className="relative pb-32">
      <PageHeader
        display
        title={
          <>
            <span className="text-base text-ink-2">{greeting(now)},</span>
            <h1 className="font-display text-2xl leading-none tracking-[-1.5px]">{s.profile.name}</h1>
          </>
        }
      >
        <AlertsBell />
      </PageHeader>

      {showHint && (
        <div role="note" className="anim-rise absolute top-[68px] right-4 z-20 flex w-64 flex-col gap-2.5 rounded-card bg-ink p-3 text-white lg:right-8">
          <span aria-hidden className="absolute -top-1.5 right-4 size-3 rotate-45 bg-ink" />
          <p className="text-sm leading-relaxed">This is Opaad. Tap it on any screen to ask for help. Back brings you right here.</p>
          <button type="button" onClick={() => { sessionStorage.removeItem('opaad:welcome'); setHint(false); if (params.has('welcome')) setParams({}, { replace: true }); }} className="h-9 self-end rounded-field bg-lime px-3.5 text-sm font-semibold text-ink">
            Got it
          </button>
        </div>
      )}

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 lg:px-8">
        <ol aria-label="This week" className="flex gap-2 rounded-card border border-line bg-subtle p-3">
          {weekStrip(now).map((d) => (
            <li key={d.key} aria-current={d.isToday ? 'date' : undefined} className={`flex flex-1 flex-col items-center gap-1.5 rounded-md border border-line py-1 ${d.isToday ? 'bg-lime text-ink' : 'text-ink-3'}`}>
              <span className="text-xs tracking-wide">{d.day}</span>
              <span className="text-base font-semibold">{d.date}</span>
            </li>
          ))}
        </ol>

        <section aria-labelledby="brief-h" className="flex flex-col gap-4 rounded-card border border-line bg-surface p-3">
          <SectionTitle action={<Link to="/report" className="text-sm text-ink-3 hover:text-ink">Tonight's report</Link>}>
            <span id="brief-h">Today's brief</span>
          </SectionTitle>
          {brief.length ? (
            <ol className="list-decimal pl-5 text-base leading-relaxed text-ink-2">{brief.map((b) => <li key={b}>{b}</li>)}</ol>
          ) : (
            <p className="text-base leading-relaxed text-ink-2">Nothing on the list yet. Add what's on your plate with the + button, or tell Opaad and it will sort it.</p>
          )}
        </section>

        <CalendarCard exec={exec} />

        <button type="button" onClick={() => openAsk({ prompt: 'Plan my day around my meetings and what is open, with buffers between demanding blocks.', send: true })} className="flex items-center gap-3 rounded-field bg-lime p-3 text-left">
          <OpaadMark size={22} />
          <span className="flex flex-1 flex-col gap-1">
            <span className="text-base font-semibold">Plan my day</span>
            <span className="text-sm text-ink-2">Opaad suggests time blocks with buffers. You approve them.</span>
          </span>
          <ArrowRight size={20} aria-hidden />
        </button>

        <section aria-labelledby="tasks-h" className="flex flex-col gap-4">
          <SectionTitle action={<Link to="/tasks" className="text-sm text-ink-3 hover:text-ink">See all</Link>}>
            <span id="tasks-h">Task</span>
          </SectionTitle>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {cards.map((c) => (
              <div key={c.kind} className={`flex flex-col gap-3 rounded-field p-3 ${c.cls} ${c.kind === 'reminder' ? 'col-span-2 lg:col-span-1' : ''}`}>
                <div className="flex items-center">
                  <h3 className={`flex-1 text-sm ${c.kind === 'reminder' ? 'text-[#E8E3FC]' : 'text-ink-2'}`}>{c.label}</h3>
                  <button type="button" onClick={() => setQa({ kind: c.kind, n: Date.now() })} aria-label={`Add ${c.kind === 'todo' ? 'a to-do' : c.kind === 'note' ? 'a note' : 'a reminder'}`} className="-m-2 flex size-10 items-center justify-center rounded-full hover:bg-black/5">
                    <Plus size={18} aria-hidden />
                  </button>
                </div>
                {c.items.length ? (
                  <ul className="flex flex-col gap-2.5">
                    {c.items.map((i) => (
                      <li key={i.id} className={`relative ${i.id === fresh ? 'anim-row-in' : ''}`}>
                        <Link to={`/tasks/${i.id}`} className="flex gap-2 text-sm leading-snug">
                          {c.kind !== 'note' && <span aria-hidden className={`mt-0.5 size-3.5 shrink-0 rounded-full border-[1.5px] ${c.kind === 'reminder' ? 'border-[#F3F5ED]' : 'border-ink'}`} />}
                          <span className="flex flex-col">
                            {i.title}
                            {c.kind === 'reminder' && i.due && <span className="text-xs opacity-80">{dueLabel(i.due, now)}</span>}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm opacity-80">{c.kind === 'note' ? 'No notes yet.' : 'Nothing yet.'}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="plan-h" className="flex flex-col gap-3">
          <SectionTitle action={<button type="button" onClick={() => openAsk({ prompt: 'Change my plan for today: ' })} className="h-11 text-sm text-ink-3 hover:text-ink">{plan.length ? 'Make changes' : ''}</button>}>
            <span id="plan-h">Today's plan</span>
          </SectionTitle>
          {plan.length ? (
            <ol className="flex flex-col">
              {plan.map((b) => {
                const isNow = b.start <= hhmm && hhmm < b.end;
                const past = b.end <= hhmm;
                return (
                  <li key={b.id} className="flex gap-3 border-b border-line-soft py-2.5">
                    <span className={`w-14 shrink-0 text-sm tabular-nums ${isNow ? 'font-semibold text-lime-ink' : 'text-ink-3'}`}>{b.start}</span>
                    <span className="flex flex-1 flex-col">
                      <span className={`text-base ${past ? 'text-ink-3' : ''}`}>{b.title}</span>
                      <span className="text-[13px] text-ink-3">
                        {b.start}–{b.end}
                        {b.kind === 'buffer' ? ' · Buffer' : ''}
                      </span>
                    </span>
                    {isNow && <span className="self-start rounded-md bg-lime px-2 py-0.5 text-xs font-semibold">Now</span>}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-ink-2">No plan yet. "Plan my day" above builds one from your open items.</p>
          )}
        </section>

        <section aria-labelledby="out-h" className="flex flex-col gap-1">
          <SectionTitle action={<Link to="/tasks" className="text-sm text-ink-3 hover:text-ink">See all</Link>}>
            <span id="out-h">Outstanding</span>
          </SectionTitle>
          {outstanding.length ? (
            <ul>{outstanding.slice(0, 6).map((i) => <ItemRow key={i.id} item={i} />)}</ul>
          ) : (
            <p className="py-2 text-sm text-ink-2">Nothing overdue or undated. Good place to be.</p>
          )}
        </section>
      </main>

      <QuickAdd request={qa} onAdded={(id) => setFresh(id)} />
    </div>
  );
}
