import { ActionSchema, AgentResponseSchema, type Action, type AppState, type ChatMessage, type Executive } from './model';
import { dueLabel, isOverdue, isToday, todayKey, toLocalDateTime } from './dates';
import { IN_PREVIEW } from './env';
import { TOOLS, fallbackReply, systemPrompt, type AgentContext } from './agent-prompt';

export function buildContext(s: AppState, exec: Executive, now: Date = new Date()): AgentContext {
  const mine = s.items.filter((i) => i.execId === exec.id);
  return {
    assistant: { name: s.profile.name, role: s.profile.role },
    executive: {
      name: exec.name,
      role: exec.role,
      org: exec.org,
      addressAs: exec.addressAs,
      pronoun: exec.pronoun,
      traits: exec.traits.slice(0, 5),
      samples: exec.samples.slice(0, 3).map((x) => x.slice(0, 800)),
      learned: exec.learned.map((l) => l.text).slice(-30),
      neverSuggest: exec.neverSuggest.slice(0, 20),
    },
    now: toLocalDateTime(now),
    weekday: new Intl.DateTimeFormat('en', { weekday: 'long' }).format(now),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'local',
    open: mine
      .filter((i) => !i.done && i.type !== 'note')
      .slice(0, 40)
      .map((i) => ({ type: i.type, title: i.title, due: i.due ? dueLabel(i.due, now) : '', overdue: !!i.due && isOverdue(i.due, now) })),
    doneToday: mine.filter((i) => i.done && i.doneAt && todayKey(new Date(i.doneAt)) === todayKey(now)).map((i) => i.title).slice(0, 40),
    plan: s.plan.filter((b) => b.execId === exec.id && b.date === todayKey(now)).map((b) => `${b.start}-${b.end} ${b.title}`).slice(0, 20),
    notesToRaise: mine.filter((i) => i.type === 'note' && i.raiseWithExec && !i.done).map((i) => i.title).slice(0, 20),
  };
}

export type AgentReply = { reply: string; actions: Action[] };

export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

export async function askAgent(history: ChatMessage[], s: AppState, exec: Executive, signal?: AbortSignal): Promise<AgentReply> {
  const messages = history
    .filter((m) => !m.error)
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }));
  if (IN_PREVIEW) return askViaClaude(messages, buildContext(s, exec), signal);
  let res: Response;
  try {
    res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(s.settings.ownKey ? { 'x-openrouter-key': s.settings.ownKey } : {}) },
      body: JSON.stringify({ messages, context: buildContext(s, exec) }),
      signal,
    });
  } catch {
    throw new AgentError("You're offline or the connection dropped. Your request is still here; try again when you're back online.", 'offline');
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data && typeof data === 'object' && 'message' in data ? String((data as { message: unknown }).message) : 'Opaad could not answer. Try again.';
    const code = data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : 'server';
    throw new AgentError(msg, code);
  }
  const parsed = AgentResponseSchema.safeParse(data);
  if (!parsed.success) throw new AgentError('Opaad sent back something unexpected. Try again.', 'bad_response');
  const actions = parsed.data.actions.flatMap((a) => {
    const r = ActionSchema.safeParse(a);
    return r.success ? [r.data] : [];
  });
  return { reply: parsed.data.reply, actions };
}

export function describeAction(a: Action): { label: string; detail: string } {
  switch (a.kind) {
    case 'add_todo':
      return { label: 'To-do', detail: a.title + (a.due ? ` · ${dueLabel(a.due)}` : '') };
    case 'add_reminder':
      return { label: 'Reminder', detail: `${a.title} · ${dueLabel(a.remind_at)}` };
    case 'add_note':
      return { label: a.raise_with_executive ? 'Note to raise' : 'Note', detail: a.title };
    case 'plan_day':
      return { label: isToday(`${a.date}T00:00`) ? "Today's plan" : `Plan for ${a.date}`, detail: a.blocks.map((b) => `${b.start} ${b.title}`).join(' · ') };
    case 'draft_message':
      return { label: `${a.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} draft`, detail: `To ${a.to}` };
    case 'write_report':
      return { label: "Tonight's report", detail: a.text.split('\n').find((l) => l.trim())?.slice(0, 90) ?? '' };
    case 'remember_preference':
      return { label: 'Remember', detail: a.text };
  }
}

type Sample = ((input: { role: 'user' | 'assistant'; content: string }[], opts?: Record<string, unknown>) => Promise<{ text: string }>) | null;

/** Preview build only: Claude answers through the page's `sample` capability; tools only collect proposals. */
async function askViaClaude(messages: { role: 'user' | 'assistant'; content: string }[], context: AgentContext, signal?: AbortSignal): Promise<AgentReply> {
  const w = window as unknown as { claude?: { use: (n: string) => Promise<unknown> } };
  const sample = (w.claude ? ((await w.claude.use('sample')) as Sample) : null) ?? null;
  if (!sample) throw new AgentError('Ask Opaad works when this preview is open in Claude. Open it from claude.ai and try again.', 'not_configured');
  const proposed: unknown[] = [];
  const tools = TOOLS.map((t) => ({
    name: t.function.name,
    description: `${t.function.description} Calling this only proposes it; the assistant reviews and approves.`,
    inputSchema: t.function.parameters,
    execute: (input: Record<string, unknown>) => {
      proposed.push({ ...input, kind: t.function.name });
      return { status: 'proposed', note: 'Shown to the assistant for approval. Do not say it is done.' };
    },
  }));
  const first = messages[0];
  const convo = messages.map((m, i) => (i === 0 && first ? { role: m.role, content: `${systemPrompt(context)}\n\n---\n\n${m.content}` } : m));
  try {
    const res = await sample(convo, { tools, modelTier: 'default', cache: false, signal });
    const actions = proposed.flatMap((a) => {
      const r = ActionSchema.safeParse(a);
      return r.success ? [r.data] : [];
    });
    return { reply: res.text.trim() || fallbackReply(actions), actions };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'rate_limited') throw new AgentError('Opaad is busy right now. Try again in a minute.', 'rate_limited');
    if (e.code === 'not_granted') throw new AgentError('Allow this page to use Claude, then try again.', 'not_granted');
    throw new AgentError('Opaad could not answer. Try again.', 'server');
  }
}
