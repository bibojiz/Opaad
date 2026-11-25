import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Bell, Camera, FileText, ListChecks, Mic, NotebookPen, Paperclip, Plus, Video, X } from 'lucide-react';
import { getState, saveEvidenceFile, setState, useApp } from '@/store/store';
import { activeExec, addItem, makeItem, removeItems, updateItem } from '@/store/logic';
import { useToast } from '@/components/overlays';
import { useVoice } from '@/lib/device';
import { addDays, atTime, toLocalDateTime, uid } from '@/lib/dates';

export type AddKind = 'todo' | 'reminder' | 'note' | 'evidence';
export type QuickAddRequest = { kind: AddKind; n: number } | null;

const ARC: { kind: AddKind; label: string; dx: number; dy: number; Icon: typeof Plus }[] = [
  { kind: 'evidence', label: 'Evidence', dx: -98, dy: 36, Icon: Paperclip },
  { kind: 'todo', label: 'To do', dx: -46, dy: 94, Icon: ListChecks },
  { kind: 'reminder', label: 'Reminder', dx: 46, dy: 94, Icon: Bell },
  { kind: 'note', label: 'Note', dx: 98, dy: 36, Icon: NotebookPen },
];

function whenOptions(kind: AddKind, now: Date): { label: string; value: string }[] {
  if (kind === 'todo') return [
    { label: 'Today', value: toLocalDateTime(atTime(now, Math.max(17, now.getHours() + 1))) },
    { label: 'Tomorrow', value: toLocalDateTime(atTime(addDays(now, 1), 9)) },
    { label: 'No date', value: '' },
  ];
  if (kind === 'reminder') return [
    { label: 'In 1 hour', value: toLocalDateTime(new Date(now.getTime() + 3600_000)) },
    { label: 'Today 17:00', value: toLocalDateTime(atTime(now, 17)) },
    { label: 'Tomorrow 09:00', value: toLocalDateTime(atTime(addDays(now, 1), 9)) },
  ];
  return [];
}

export function QuickAdd({ request, onAdded }: { request?: QuickAddRequest; onAdded?: (id: string, kind: AddKind) => void }) {
  const s = useApp();
  const exec = activeExec(s);
  const toast = useToast();
  const [fan, setFan] = useState(false);
  const [kind, setKind] = useState<AddKind | null>(null);
  const [shown, setShown] = useState<AddKind>('todo');
  const [text, setText] = useState('');
  const [when, setWhen] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [raise, setRaise] = useState(false);
  const [target, setTarget] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const fab = useRef<HTMLButtonElement>(null);
  const voice = useVoice((t) => setText(t));
  const now = useMemo(() => new Date(), [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const opts = whenOptions(shown, now);
  const openTodos = s.items.filter((i) => i.execId === exec?.id && !i.done && i.type === 'todo').slice(0, 5);

  const open = (k: AddKind) => {
    setFan(false);
    setKind(k);
    setShown(k);
    setText('');
    setWhen(null);
    setCustom('');
    setRaise(false);
    setFile(null);
    setTarget(openTodos[0]?.id ?? '');
  };
  useEffect(() => {
    if (request) open(request.kind);
  }, [request?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (kind) {
      const t = setTimeout(() => input.current?.focus(), 260);
      return () => clearTimeout(t);
    }
  }, [kind]);
  useEffect(() => {
    if (!fan && !kind) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const close = () => {
    setFan(false);
    setKind(null);
    fab.current?.focus();
  };
  const due = custom || (when ?? opts[shown === 'reminder' ? 1 : 0]?.value ?? '');
  const canAdd = shown === 'evidence' ? !!file && !!target : text.trim().length > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!exec || !canAdd) return;
    if (shown === 'evidence' && file) {
      const ev = { id: uid('ev_'), name: file.name, mime: file.type || 'application/octet-stream', size: file.size, addedAt: new Date().toISOString() };
      await saveEvidenceFile(ev.id, file);
      const item = getState().items.find((i) => i.id === target);
      setState((st) => updateItem(st, target, { evidence: [...(item?.evidence ?? []), ev], body: text.trim() ? `${item?.body ? `${item.body}\n` : ''}${text.trim()}` : (item?.body ?? '') }));
      toast(`Attached to "${item?.title ?? 'task'}". It goes into tonight's report.`);
      close();
      return;
    }
    const type = shown === 'evidence' ? 'todo' : shown;
    const it = makeItem(exec.id, type, text, { due: type === 'note' ? '' : due, raiseWithExec: type === 'note' && raise });
    setState((st) => addItem(st, it));
    onAdded?.(it.id, shown);
    toast(type === 'note' ? 'Note saved' : type === 'reminder' ? 'Reminder set' : 'To-do added', () => setState((st) => removeItems(st, [it.id])));
    close();
  };

  const active = fan || !!kind;
  const title = { todo: 'New to-do', reminder: 'New reminder', note: 'New note', evidence: 'Add evidence' }[shown];
  const ph = { todo: 'What needs doing?', reminder: 'Remind me to…', note: 'Write it down', evidence: 'What does this show? (optional)' }[shown];

  return (
    <div className="pointer-events-none fixed inset-0 z-30 lg:left-[var(--sidebar-w,264px)]">
      <button type="button" tabIndex={-1} aria-hidden onClick={close} className={`pointer-events-auto absolute inset-0 bg-page/90 ${active ? 't-std visible opacity-100' : 't-out invisible opacity-0'}`} />
      <div className="absolute bottom-0 left-1/2 h-0 w-0">
        <div id="qa-menu" role="menu" aria-label="Add">
          {ARC.map((a, i) => (
            <button
              key={a.kind}
              type="button"
              role="menuitem"
              onClick={() => open(a.kind)}
              className={`absolute flex h-[76px] w-[76px] flex-col items-center justify-end gap-1 ${fan ? 't-std pointer-events-auto visible opacity-100' : 't-out invisible opacity-0'}`}
              style={{ left: -38, bottom: 6, transformOrigin: '50% 30px', transform: fan ? `translate(${a.dx}px, ${-a.dy}px)` : 'scale(0.5)', transitionDelay: fan ? `${i * 35}ms` : '0ms' }}
            >
              <span className="flex size-13 items-center justify-center rounded-full border border-line bg-surface">
                <a.Icon size={22} strokeWidth={1.8} aria-hidden />
              </span>
              <span className="text-xs leading-4 font-semibold">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={submit}
        role="dialog"
        aria-label={title}
        className={`pointer-events-auto absolute inset-x-3 bottom-24 mx-auto flex max-w-lg flex-col gap-3.5 rounded-[20px] border border-line bg-surface p-4 shadow-[0_12px_32px_rgba(20,21,24,0.12)] ${kind ? 't-large visible opacity-100' : 't-large-out pointer-events-none invisible opacity-0'}`}
        style={{ transformOrigin: '50% calc(100% + 44px)', transform: kind ? 'none' : 'translateY(24px) scale(0.4)' }}
      >
        <div className="flex items-center gap-2.5">
          <span aria-hidden className={`flex size-8 items-center justify-center rounded-[10px] ${shown === 'todo' ? 'bg-todo' : shown === 'note' ? 'bg-note' : shown === 'reminder' ? 'bg-reminder text-white' : 'border border-line bg-subtle'}`}>
            {(() => {
              const I = ARC.find((a) => a.kind === shown)!.Icon;
              return <I size={16} strokeWidth={2} />;
            })()}
          </span>
          <div className="flex flex-1 flex-col">
            <span className="text-base leading-tight font-semibold">{title}</span>
            <span className="text-xs text-ink-2">For {exec?.addressAs}</span>
          </div>
          <button type="button" onClick={close} aria-label="Close" className="flex size-10 items-center justify-center rounded-card border border-line">
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="flex items-center gap-2 rounded-card border border-line pr-1.5 pl-3.5 focus-within:border-ink">
          <label htmlFor="qa-text" className="sr-only">
            {ph}
          </label>
          <input id="qa-text" ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder={voice.listening ? 'Listening…' : ph} autoComplete="off" enterKeyHint="done" className="h-13 min-w-0 flex-1 bg-transparent text-base outline-none" />
          {voice.supported && (
            <button type="button" onClick={voice.toggle} aria-pressed={voice.listening} aria-label={voice.listening ? 'Stop voice input' : 'Speak instead of typing'} className={`flex size-10 items-center justify-center rounded-[10px] ${voice.listening ? 'bg-lime' : 'border border-line'}`}>
              <Mic size={18} aria-hidden />
            </button>
          )}
        </div>

        {shown === 'evidence' && (
          <>
            <div className="flex gap-2">
              {[
                { l: 'Photo', a: 'image/*', I: Camera },
                { l: 'Video', a: 'video/*', I: Video },
                { l: 'File', a: '.pdf,.doc,.docx,.xls,.xlsx', I: FileText },
              ].map(({ l, a, I }) => (
                <label key={l} className="relative flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-line text-sm focus-within:outline-2 focus-within:outline-ink">
                  <I size={16} aria-hidden />
                  {l}
                  <input type="file" accept={a} className="absolute inset-0 opacity-0" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
              ))}
            </div>
            {file && <span className="self-start rounded-field border border-line bg-subtle px-2.5 py-1.5 text-[13px]">{file.name}</span>}
          </>
        )}

        <ChipsFor shown={shown} opts={opts} due={due} setWhen={(v) => { setWhen(v); setCustom(''); }} custom={custom} setCustom={setCustom} raise={raise} setRaise={setRaise} addressAs={exec?.addressAs ?? 'them'} todos={openTodos} target={target} setTarget={setTarget} />

        <div className="flex items-center gap-3">
          <span className="flex-1 text-[13px] leading-snug text-ink-2">
            {shown === 'reminder' ? 'On this device, at that time.' : shown === 'note' ? 'Only you see notes.' : shown === 'evidence' ? "Goes into tonight's report." : 'Shows in Today and in your report when done.'}
          </span>
          <button type="submit" disabled={!canAdd} className="h-12 rounded-card bg-lime px-5 text-[15px] font-semibold disabled:bg-disabled disabled:text-disabled-ink">
            {shown === 'todo' ? 'Add to-do' : shown === 'reminder' ? 'Add reminder' : shown === 'note' ? 'Save note' : 'Attach'}
          </button>
        </div>
      </form>

      <button
        ref={fab}
        type="button"
        onClick={() => (active ? close() : setFan(true))}
        aria-expanded={active}
        aria-controls="qa-menu"
        aria-label={active ? 'Close' : 'Add a to-do, reminder, note or evidence'}
        className="pointer-events-auto absolute bottom-6 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-ink text-white shadow-[0_6px_16px_rgba(20,21,24,0.18)]"
      >
        <Plus size={24} strokeWidth={2.2} aria-hidden className="t-std" style={{ transform: active ? 'rotate(45deg)' : 'none' }} />
      </button>
    </div>
  );
}

type ChipsProps = {
  shown: AddKind;
  opts: { label: string; value: string }[];
  due: string;
  setWhen: (v: string) => void;
  custom: string;
  setCustom: (v: string) => void;
  raise: boolean;
  setRaise: (v: boolean) => void;
  addressAs: string;
  todos: { id: string; title: string }[];
  target: string;
  setTarget: (v: string) => void;
};

function ChipsFor(p: ChipsProps) {
  const chip = (on: boolean) => `min-h-10 rounded-[10px] border px-3 py-2 text-left text-sm leading-tight ${on ? 'border-ink bg-ink font-semibold text-white' : 'border-line bg-surface'}`;
  if (p.shown === 'note') {
    return (
      <div role="group" aria-label="Keep it" className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={!p.raise} onClick={() => p.setRaise(false)} className={chip(!p.raise)}>Just a note</button>
        <button type="button" aria-pressed={p.raise} onClick={() => p.setRaise(true)} className={chip(p.raise)}>Raise with {p.addressAs}</button>
      </div>
    );
  }
  if (p.shown === 'evidence') {
    if (!p.todos.length) return <p className="text-sm text-ink-2">Add a to-do first, then attach proof to it.</p>;
    return (
      <div role="group" aria-label="Attach to" className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-wider text-ink-2 uppercase">Attach to</span>
        <div className="flex flex-wrap gap-2">
          {p.todos.map((t) => (
            <button key={t.id} type="button" aria-pressed={p.target === t.id} onClick={() => p.setTarget(t.id)} className={chip(p.target === t.id)}>{t.title}</button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold tracking-wider text-ink-2 uppercase">{p.shown === 'reminder' ? 'Remind me' : 'When'}</span>
      <div role="group" aria-label="When" className="flex flex-wrap gap-2">
        {p.opts.map((o) => (
          <button key={o.label} type="button" aria-pressed={!p.custom && p.due === o.value} onClick={() => p.setWhen(o.value)} className={chip(!p.custom && p.due === o.value)}>{o.label}</button>
        ))}
        <label className={`${chip(!!p.custom)} relative cursor-pointer`}>
          {p.custom ? p.custom.replace('T', ' ') : 'Pick a time'}
          <input type="datetime-local" value={p.custom} onChange={(e) => p.setCustom(e.target.value)} className="absolute inset-0 opacity-0" aria-label="Pick a date and time" />
        </label>
      </div>
    </div>
  );
}
