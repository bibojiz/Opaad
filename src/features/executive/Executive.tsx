import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { setState, useApp } from '@/store/store';
import { activeExec, addExecutive, newExecutive, removeExecutive, updateExecutive } from '@/store/logic';
import { PageHeader } from '@/app/shell';
import { Button, Chip, Field, inputCls } from '@/components/ui';
import { Sheet, useToast } from '@/components/overlays';
import { MAX_EXECUTIVES, MAX_TRAITS, TRAIT_GROUPS, type Pronoun } from '@/lib/model';

export function ExecutivePage() {
  const s = useApp();
  const exec = activeExec(s)!;
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [traitsOpen, setTraitsOpen] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rule, setRule] = useState('');
  const patch = (p: Parameters<typeof updateExecutive>[2]) => setState((st) => updateExecutive(st, exec.id, p));
  const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  const them = exec.pronoun === 'he' ? 'him' : exec.pronoun === 'she' ? 'her' : 'them';

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader title="Executive" subtitle="Who Opaad shapes its suggestions for" />
      <div className="mx-auto w-full max-w-2xl px-4 lg:px-8">
        <div role="group" aria-label="Executives you assist" className="flex flex-wrap items-center gap-2 pb-4">
          {s.executives.map((e) => (
            <button key={e.id} type="button" aria-pressed={e.id === exec.id} onClick={() => setState((st) => ({ ...st, activeExecId: e.id }))} className={`flex h-10 items-center gap-2 rounded-full py-0 pr-3 pl-1.5 text-sm ${e.id === exec.id ? 'border border-ink bg-lime font-semibold' : 'border border-line bg-surface font-medium'}`}>
              <span aria-hidden className={`flex size-7 items-center justify-center rounded-full text-[11px] font-bold ${e.id === exec.id ? 'bg-ink text-white' : 'bg-subtle'}`}>{initials(e.name)}</span>
              {e.addressAs}
            </button>
          ))}
          {s.executives.length < MAX_EXECUTIVES && (
            <button type="button" onClick={() => setAdding(true)} className="flex h-10 items-center gap-1.5 rounded-full border border-dashed border-ink-3 px-3 text-sm">
              <Plus size={14} aria-hidden /> Add executive
            </button>
          )}
          <span className="ml-auto text-xs text-ink-2">{s.executives.length} of {MAX_EXECUTIVES}</span>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-7 border-t border-line bg-surface px-4 py-5 lg:rounded-card lg:border lg:px-6">
        <section aria-label="Profile" className="flex items-center gap-3.5">
          <span aria-hidden className="flex size-14 items-center justify-center rounded-full border border-ink bg-lime font-display text-xl">{initials(exec.name)}</span>
          <div className="flex flex-1 flex-col gap-1">
            <h2 className="font-display text-[22px] leading-tight tracking-[-1px]">{exec.name}</h2>
            <span className="text-sm text-ink-2">{[exec.role, exec.org].filter(Boolean).join(' · ') || 'Role not set'} · You call {them} "{exec.addressAs}"</span>
          </div>
          <button type="button" onClick={() => setEditing(true)} className="h-11 px-1 text-sm font-medium underline">Edit</button>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">How {exec.pronoun} work{exec.pronoun === 'they' ? '' : 's'}</h2>
            <button type="button" onClick={() => setTraitsOpen(true)} className="h-10 text-sm font-medium underline">Change</button>
          </div>
          {exec.traits.length ? (
            <ul className="flex flex-wrap gap-2">{exec.traits.map((t) => <li key={t} className="flex h-9 items-center rounded-field border border-line bg-subtle px-3 text-sm">{t}</li>)}</ul>
          ) : (
            <button type="button" onClick={() => setTraitsOpen(true)} className="rounded-card border border-dashed border-ink-3 p-3 text-left text-sm">Pick up to {MAX_TRAITS} traits so suggestions fit how {exec.pronoun} work{exec.pronoun === 'they' ? '' : 's'}.</button>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">How {exec.pronoun} write{exec.pronoun === 'they' ? '' : 's'}</h2>
            {exec.samples.length < 3 && <button type="button" onClick={() => setSampleOpen(true)} className="h-10 text-sm font-medium underline">Add a message</button>}
          </div>
          {exec.samples.length ? (
            <ul className="flex flex-col gap-2">
              {exec.samples.map((m, i) => (
                <li key={i} className="flex gap-2 rounded-card border border-line p-3 text-sm leading-relaxed">
                  <span className="flex-1 whitespace-pre-wrap">"{m}"</span>
                  <button type="button" aria-label="Remove this message" onClick={() => patch({ samples: exec.samples.filter((_, j) => j !== i) })} className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-subtle"><X size={14} aria-hidden /></button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-relaxed text-ink-2">Paste one or two messages {exec.pronoun} sent you. Drafts written as {them} will match the tone.</p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Opaad has learned</h2>
            <span className="text-sm text-ink-2">From what you told it. Remove anything that isn't true.</span>
          </div>
          {exec.learned.length ? (
            <ul className="flex flex-col gap-2">
              {exec.learned.map((l) => (
                <li key={l.id} className="flex items-center gap-3 rounded-card border border-line p-3">
                  <span className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-medium">{l.text}</span><span className="text-[13px] text-ink-2">{l.source}</span></span>
                  <Button size="sm" variant="secondary" onClick={() => { patch({ learned: exec.learned.filter((x) => x.id !== l.id) }); toast('Removed', () => patch({ learned: exec.learned })); }}>Remove</Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">Nothing yet. When you tell Opaad something lasting ("she wants two options, not five"), it offers to remember it.</p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Never suggest</h2>
            <span className="text-sm text-ink-2">Opaad won't propose these, even if they'd save time.</span>
          </div>
          <ul className="flex flex-wrap gap-2">
            {exec.neverSuggest.map((r) => (
              <li key={r} className="flex h-9 items-center gap-0.5 rounded-field border border-line pr-1 pl-3 text-sm">
                {r}
                <button type="button" aria-label={`Remove: ${r}`} onClick={() => patch({ neverSuggest: exec.neverSuggest.filter((x) => x !== r) })} className="flex size-8 items-center justify-center"><X size={14} aria-hidden /></button>
              </li>
            ))}
          </ul>
          <form onSubmit={(e) => { e.preventDefault(); const r = rule.trim(); if (r && !exec.neverSuggest.includes(r)) patch({ neverSuggest: [...exec.neverSuggest, r.slice(0, 120)] }); setRule(''); }} className="flex gap-2">
            <label htmlFor="rule" className="sr-only">Add a rule</label>
            <input id="rule" value={rule} onChange={(e) => setRule(e.target.value)} placeholder="e.g. Weekend meetings" className={`${inputCls} h-11`} />
            <Button type="submit" variant="secondary" disabled={!rule.trim()}>Add</Button>
          </form>
        </section>

        <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 self-start text-sm text-danger-ink underline">Delete everything Opaad knows about {exec.addressAs}</button>
      </main>

      <AddExecutiveSheet open={adding} onClose={() => setAdding(false)} onAdded={(n) => toast(`${n} added. Each executive keeps their own style, tasks and reports.`)} />
      <EditSheet open={editing} onClose={() => setEditing(false)} />
      <Sheet open={traitsOpen} onClose={() => setTraitsOpen(false)} title={`How ${exec.addressAs} works`} wide>
        <p className="mb-3 text-sm text-ink-2">{exec.traits.length} of {MAX_TRAITS} picked</p>
        <div className="flex flex-col gap-4">
          {TRAIT_GROUPS.map((g) => (
            <fieldset key={g.id} className="flex flex-col gap-2">
              <legend className="mb-1.5 text-xs font-semibold tracking-wider text-ink-2 uppercase">{g.name}</legend>
              <div className="flex flex-wrap gap-2">
                {g.items.map((t) => {
                  const on = exec.traits.includes(t);
                  return (
                    <button key={t} type="button" aria-pressed={on} disabled={!on && exec.traits.length >= MAX_TRAITS} onClick={() => patch({ traits: on ? exec.traits.filter((x) => x !== t) : [...exec.traits, t] })} className={`min-h-10 rounded-[10px] border px-3 py-2 text-sm disabled:opacity-40 ${on ? 'border-ink bg-lime font-semibold' : 'border-line bg-surface'}`}>{t}</button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
        <Button block className="mt-5" onClick={() => setTraitsOpen(false)}>Done</Button>
      </Sheet>
      <SampleSheet open={sampleOpen} onClose={() => setSampleOpen(false)} onSave={(t) => patch({ samples: [...exec.samples, t].slice(0, 3) })} who={exec.addressAs} />
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete ${exec.addressAs}?`}>
        <p className="mb-4 text-[15px] leading-relaxed text-ink-2">Their profile, tasks, notes, reminders, plans, reports and chats are removed from this device. This can't be undone.</p>
        <div className="flex gap-2">
          <Button variant="danger" className="flex-1" disabled={s.executives.length === 1} onClick={() => { setState((st) => removeExecutive(st, exec.id)); setConfirmDelete(false); toast('Deleted'); }}>Delete</Button>
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>Keep</Button>
        </div>
        {s.executives.length === 1 && <p className="mt-3 text-[13px] text-ink-2">You need at least one executive. To start over, use Settings, then Delete all data.</p>}
      </Sheet>
    </div>
  );
}

function AddExecutiveSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (name: string) => void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [addressAs, setAddressAs] = useState('');
  const [pronoun, setPronoun] = useState<Pronoun>('she');
  return (
    <Sheet open={open} onClose={onClose} title="Add an executive">
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (name.trim().length < 2) return; const ex = newExecutive({ name: name.trim(), role: role.trim(), addressAs: addressAs.trim() || name.trim().split(/\s+/)[0]!, pronoun }); setState((st) => addExecutive(st, ex)); onAdded(ex.addressAs); setName(''); setRole(''); setAddressAs(''); onClose(); }}>
        <p className="text-sm text-ink-2">Their style, tasks and reports stay separate. Opaad learns how they work as you go.</p>
        <Field label="Full name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Role" hint="(optional)"><input className={inputCls} value={role} onChange={(e) => setRole(e.target.value)} /></Field>
        <Field label="You address them as"><input className={inputCls} value={addressAs} onChange={(e) => setAddressAs(e.target.value)} placeholder="e.g. Mr. Ene" /></Field>
        <div className="flex gap-2">{(['she', 'he', 'they'] as const).map((p) => <Chip key={p} on={pronoun === p} onClick={() => setPronoun(p)}>{p}</Chip>)}</div>
        <Button type="submit" size="lg" block disabled={name.trim().length < 2}>Add executive</Button>
      </form>
    </Sheet>
  );
}

function EditSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useApp();
  const exec = activeExec(s)!;
  const set = (p: Parameters<typeof updateExecutive>[2]) => setState((st) => updateExecutive(st, exec.id, p));
  return (
    <Sheet open={open} onClose={onClose} title="Edit profile">
      <div className="flex flex-col gap-4">
        <Field label="Full name"><input className={inputCls} value={exec.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Role"><input className={inputCls} value={exec.role} onChange={(e) => set({ role: e.target.value })} /></Field>
        <Field label="Organisation"><input className={inputCls} value={exec.org} onChange={(e) => set({ org: e.target.value })} /></Field>
        <Field label="You address them as"><input className={inputCls} value={exec.addressAs} onChange={(e) => set({ addressAs: e.target.value || exec.addressAs })} /></Field>
        <div className="flex gap-2">{(['she', 'he', 'they'] as const).map((p) => <Chip key={p} on={exec.pronoun === p} onClick={() => set({ pronoun: p })}>{p}</Chip>)}</div>
        <Button block onClick={onClose}>Done</Button>
      </div>
    </Sheet>
  );
}

function SampleSheet({ open, onClose, onSave, who }: { open: boolean; onClose: () => void; onSave: (t: string) => void; who: string }) {
  const [t, setT] = useState('');
  return (
    <Sheet open={open} onClose={onClose} title={`A message from ${who}`}>
      <textarea value={t} onChange={(e) => setT(e.target.value)} rows={6} aria-label="Message" className="w-full rounded-field border border-line p-3 text-base outline-none focus:border-ink" placeholder="Paste a message they sent you" />
      <p className="mt-2 mb-4 text-[13px] text-ink-2">Leave out passwords, account numbers and anyone's health details.</p>
      <Button block disabled={!t.trim()} onClick={() => { onSave(t.trim().slice(0, 2000)); setT(''); onClose(); }}>Save</Button>
    </Sheet>
  );
}
