import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, ChevronLeft, Mic, Paperclip, SquarePen, X } from 'lucide-react';
import { getState, setState, useApp } from '@/store/store';
import { activeExec, aiRequestsLeft, appendMessage, updateMessage } from '@/store/logic';
import { AgentError, askAgent } from '@/lib/agent';
import { FREE_AI_REQUESTS, type ChatMessage } from '@/lib/model';
import { greeting, uid } from '@/lib/dates';
import { useVoice } from '@/lib/device';
import { OpaadMark } from '@/components/ui';
import { ActionCard } from './ActionCard';

const SUGGESTIONS = [
  { title: 'Plan my day', hint: 'Time blocks with buffers', prompt: 'Plan my day around what is open, with buffers between demanding blocks.' },
  { title: 'Draft a message', hint: 'In their voice', prompt: 'Help me draft a message. Here is the situation: ' },
  { title: "Write tonight's report", hint: 'From what got done', prompt: "Write tonight's end-of-day report from what I finished and what is still open." },
  { title: 'Prep for a meeting', hint: 'What they need to know', prompt: 'Prep me for this meeting: ' },
];

const TEXT_FILES = '.txt,.md,.csv,.eml,.json';

export function AskPanel({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: { prompt?: string; send?: boolean; n: number } }) {
  const s = useApp();
  const exec = activeExec(s);
  const execId = exec?.id ?? '';
  const messages = s.chats[execId] ?? [];
  const [draft, setDraft] = useState('');
  const [attached, setAttached] = useState<{ name: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileNote, setFileNote] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const voice = useVoice((t) => setDraft(t));
  const left = aiRequestsLeft(s, FREE_AI_REQUESTS);

  useEffect(() => {
    if (!open || !initial) return;
    if (initial.prompt && initial.send) void send(initial.prompt);
    else if (initial.prompt) setDraft(initial.prompt);
  }, [initial?.n]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) setTimeout(() => box.current?.focus(), 80);
  }, [open]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, busy]);

  const send = async (text: string) => {
    const content = (attached ? `${text}\n\n[Attached file: ${attached.name}]\n${attached.text}` : text).trim();
    if (!content || !exec || busy) return;
    if (aiRequestsLeft(getState(), FREE_AI_REQUESTS) <= 0) return;
    const userMsg: ChatMessage = { id: uid('m_'), role: 'user', content, createdAt: new Date().toISOString() };
    setState((st) => appendMessage(st, exec.id, userMsg));
    setDraft('');
    setAttached(null);
    setBusy(true);
    abort.current = new AbortController();
    try {
      const st = getState();
      const res = await askAgent(st.chats[exec.id] ?? [userMsg], st, exec, abort.current.signal);
      setState((x) => ({
        ...appendMessage(x, exec.id, { id: uid('m_'), role: 'assistant', content: res.reply, actions: res.actions, actionState: res.actions.length ? 'pending' : undefined, createdAt: new Date().toISOString() }),
        usage: { ...x.usage, aiRequests: x.usage.aiRequests + 1 },
      }));
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const msg = err instanceof AgentError ? err.message : 'Opaad could not answer. Try again.';
      setState((x) => appendMessage(x, exec.id, { id: uid('m_'), role: 'assistant', content: msg, error: true, createdAt: new Date().toISOString() }));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };

  const newChat = () => {
    abort.current?.abort();
    setState((x) => ({ ...x, chats: { ...x.chats, [execId]: [] } }));
    setDraft('');
  };

  const onFile = async (f: File | undefined) => {
    setFileNote('');
    if (!f) return;
    if (!/\.(txt|md|csv|eml|json)$/i.test(f.name) && !f.type.startsWith('text/')) {
      setFileNote('Opaad reads text files for now. For a PDF or photo, paste the part that matters.');
      return;
    }
    const text = (await f.text()).slice(0, 6000);
    setAttached({ name: f.name, text });
  };

  if (!exec) return null;
  const canSend = (draft.trim().length > 0 || !!attached) && !busy && left > 0 && !voice.listening;

  return (
    <div role="dialog" aria-modal="true" aria-label="Ask Opaad" aria-hidden={!open} className={`fixed inset-0 z-[55] flex justify-end ${open ? 'visible' : 'invisible'}`} style={{ transition: open ? 'visibility 0s' : 'visibility 0s linear 220ms' }}>
      <button type="button" tabIndex={-1} aria-hidden onClick={onClose} className={`absolute inset-0 hidden bg-ink/30 lg:block ${open ? 't-std opacity-100' : 't-out opacity-0'}`} />
      <section className={`relative flex h-dvh w-full flex-col bg-page lg:w-[460px] lg:border-l lg:border-line ${open ? 't-large translate-x-0 opacity-100' : 't-large-out translate-x-6 opacity-0'}`}>
        <header className="flex items-center gap-2 px-3 pt-3 pb-2">
          <button type="button" onClick={onClose} aria-label="Back to where you were" className="flex size-11 items-center justify-center rounded-card border border-line bg-surface">
            <ChevronLeft size={20} aria-hidden className="lg:hidden" />
            <X size={18} aria-hidden className="hidden lg:block" />
          </button>
          <span className="flex-1 truncate text-center text-sm font-medium text-ink-2">For {exec.addressAs}</span>
          <button type="button" onClick={newChat} aria-label="New chat" disabled={!messages.length} className="flex size-11 items-center justify-center rounded-card border border-line bg-surface disabled:opacity-40">
            <SquarePen size={18} aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {messages.length === 0 ? (
            <div className="flex min-h-full flex-col justify-center gap-6 py-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <OpaadMark size={32} />
                <h2 className="font-display text-[28px] leading-tight tracking-[-1px]">
                  {greeting()}, {s.profile.name || 'there'}
                </h2>
                <p className="text-base text-ink-2">What do you need to get ahead of?</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTIONS.map((x) => (
                  <button key={x.title} type="button" onClick={() => (x.prompt.endsWith(': ') ? (setDraft(x.prompt), box.current?.focus()) : void send(x.prompt))} className="flex flex-col gap-1 rounded-card border border-line bg-surface p-3 text-left hover:bg-subtle">
                    <span className="text-sm font-semibold">{x.title}</span>
                    <span className="text-[13px] text-ink-2">{x.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="flex flex-col gap-4 pt-2">
              {messages.map((m) => (
                <li key={m.id} className={`anim-rise flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-ink text-white' : m.error ? 'border border-line bg-danger-soft text-danger-ink' : 'border border-line bg-surface'}`}>
                    {m.role === 'user' ? m.content.split('\n\n[Attached file:')[0] : m.content}
                  </div>
                  {m.actions && m.actions.length > 0 && <ActionCard message={m} execId={exec.id} onApplied={(ids) => setState((x) => updateMessage(x, exec.id, m.id, { actionState: 'applied', appliedIds: ids }))} />}
                </li>
              ))}
              {busy && (
                <li className="flex items-center gap-2 text-sm text-ink-2" role="status">
                  <span className="size-2 animate-pulse rounded-full bg-ink" aria-hidden /> Opaad is thinking…
                </li>
              )}
            </ol>
          )}
          <div ref={end} />
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-2 border-t border-line bg-surface px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {attached && (
            <span className="flex items-center gap-2 self-start rounded-field border border-line bg-subtle px-2.5 py-1 text-[13px]">
              {attached.name}
              <button type="button" aria-label="Remove file" onClick={() => setAttached(null)}>
                <X size={14} aria-hidden />
              </button>
            </span>
          )}
          {fileNote && <p className="text-[13px] text-ink-2">{fileNote}</p>}
          {left <= 0 ? (
            <p className="rounded-card bg-subtle p-3 text-sm leading-relaxed">You have used your {FREE_AI_REQUESTS} free AI requests. Everything else in Opaad stays free. Unlimited AI is coming with the paid plan.</p>
          ) : (
            <div className="flex items-end gap-2 rounded-card border border-line px-2 py-1.5 focus-within:border-ink">
              <label className="relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-[10px] hover:bg-subtle" title="Attach a text file">
                <Paperclip size={18} aria-hidden />
                <span className="sr-only">Attach a text file</span>
                <input type="file" accept={TEXT_FILES} className="absolute inset-0 opacity-0" onChange={(e) => void onFile(e.target.files?.[0])} />
              </label>
              <label htmlFor="ask-box" className="sr-only">Message Opaad</label>
              <textarea
                id="ask-box"
                ref={box}
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(min-width: 1024px)').matches) {
                    e.preventDefault();
                    if (canSend) void send(draft);
                  }
                }}
                placeholder={voice.listening ? 'Listening…' : "Tell Opaad what's going on"}
                className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-base outline-none [field-sizing:content]"
              />
              {voice.supported && (
                <button type="button" onClick={voice.toggle} aria-pressed={voice.listening} aria-label={voice.listening ? 'Stop voice input' : 'Speak instead of typing'} className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${voice.listening ? 'bg-lime' : 'hover:bg-subtle'}`}>
                  <Mic size={18} aria-hidden />
                </button>
              )}
              <button type="submit" disabled={!canSend} aria-label="Send to Opaad" className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-lime disabled:bg-disabled disabled:text-disabled-ink">
                <ArrowUp size={18} aria-hidden />
              </button>
            </div>
          )}
          <p className="text-center text-xs text-ink-2">
            {left === Infinity ? 'Opaad suggests. You decide what changes and what gets sent.' : `${left} of ${FREE_AI_REQUESTS} free AI requests left · You approve every change`}
          </p>
        </form>
      </section>
    </div>
  );
}
