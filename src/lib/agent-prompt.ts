import { ActionSchema, type Action } from './model';

export type AgentContext = {
  assistant: { name: string; role: string };
  executive: { name: string; role: string; org: string; addressAs: string; pronoun: 'she' | 'he' | 'they'; traits: string[]; samples: string[]; learned: string[]; neverSuggest: string[] };
  now: string;
  weekday: string;
  timezone: string;
  open: { type: string; title: string; due: string; overdue: boolean }[];
  doneToday: string[];
  plan: string[];
  notesToRaise: string[];
  /** The executive's Google calendar, when the assistant connected it. Null means no calendar is connected. */
  calendar?: { name: string; canWrite: boolean; events: string[] } | null;
};

/* ---------- Tools the model may call. The server never executes them: the app shows them for approval. ---------- */

const dt = { type: 'string', description: 'Local date and time, format YYYY-MM-DDTHH:mm' };
export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_todo',
      description: 'Propose a to-do for the assistant. Use for concrete things the assistant must do.',
      parameters: { type: 'object', properties: { title: { type: 'string', description: 'Short, starts with a verb' }, due: dt, notes: { type: 'string' } }, required: ['title'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_reminder',
      description: 'Propose a reminder at a specific time.',
      parameters: { type: 'object', properties: { title: { type: 'string' }, remind_at: dt }, required: ['title', 'remind_at'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_note',
      description: 'Propose a note. Set raise_with_executive when the assistant should bring it up with the executive.',
      parameters: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' }, raise_with_executive: { type: 'boolean' } }, required: ['title'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'plan_day',
      description: "Propose a time-blocked plan for a day, with buffers between demanding blocks. Replaces that day's plan when approved.",
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          blocks: {
            type: 'array',
            items: {
              type: 'object',
              properties: { start: { type: 'string', description: 'HH:mm' }, end: { type: 'string', description: 'HH:mm' }, title: { type: 'string' }, kind: { type: 'string', enum: ['focus', 'meeting', 'buffer', 'task', 'break'] } },
              required: ['start', 'end', 'title'],
            },
          },
        },
        required: ['date', 'blocks'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_message',
      description: 'Draft a message the assistant will check, copy and send themselves on WhatsApp or email. Never claim it was sent.',
      parameters: {
        type: 'object',
        properties: { to: { type: 'string', description: 'Who it is for, e.g. the executive or "Finance team"' }, channel: { type: 'string', enum: ['whatsapp', 'email'] }, subject: { type: 'string' }, body: { type: 'string' } },
        required: ['to', 'channel', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_report',
      description: "Write tonight's end-of-day report to the executive in their preferred style: done, still open with next steps, tomorrow, anything needing their decision.",
      parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_event',
      description: "Propose an event on the executive's connected calendar. Only when the calendar is connected and editable; otherwise propose a reminder. Check the listed events for clashes first.",
      parameters: {
        type: 'object',
        properties: { title: { type: 'string' }, start: dt, end: dt, location: { type: 'string', description: 'Place, or a meeting link if the assistant gave one' }, notes: { type: 'string' } },
        required: ['title', 'start', 'end'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remember_preference',
      description: 'Save something durable the assistant just said about how the executive likes things done.',
      parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    },
  },
] as const;

export function systemPrompt(c: AgentContext): string {
  const e = c.executive;
  const they = e.pronoun === 'she' ? 'she' : e.pronoun === 'he' ? 'he' : 'they';
  const lines = [
    `You are Opaad, the AI copilot for ${c.assistant.name || 'the assistant'}, who works as ${c.assistant.role || 'an assistant'} to ${e.name}${e.role ? `, ${e.role}` : ''}${e.org ? ` at ${e.org}` : ''}. The assistant addresses ${they === 'they' ? 'them' : they === 'she' ? 'her' : 'him'} as "${e.addressAs}".`,
    'You help the assistant think ahead and work with confidence: what to decide, what to do first, what to say and how to say it. You act only when asked.',
    '',
    'How to answer:',
    '- Lead with the answer or the decision. Then the reason in a sentence. Short paragraphs, plain words: the assistant reads on a phone.',
    '- When it helps, propose concrete actions with the tools (to-dos, reminders, notes, a time-blocked plan with buffers, a message draft, tonight\'s report, a preference to remember). The assistant approves every action before anything changes. Do not use tools for advice alone.',
    '- Always write a short reply as well, even when you propose actions.',
    `- Times are the assistant's local time. Now is ${c.now} (${c.weekday}, ${c.timezone}). Use YYYY-MM-DDTHH:mm for date-times.`,
    '- Messages written as or to the executive follow their style. If you are unsure of a fact (a name, an amount, a date), leave a clear [placeholder] instead of guessing.',
    c.calendar
      ? `- You can see ${e.name}'s calendar "${c.calendar.name}" for today and tomorrow (listed below)${c.calendar.canWrite ? ' and can propose events on it with add_event' : '; it is read-only, so propose reminders instead of events'}. You cannot read WhatsApp or email, and you never send anything. Never say something was sent.`
      : '- No calendar is connected, so you cannot see meetings unless the assistant tells you. Do not use add_event; propose a reminder instead. You cannot read WhatsApp or email, and you never send anything. Never say something was sent.',
    '- Be discreet, diplomatic and firm when the situation needs it. Never fabricate records: no fake receipts, padded expenses, forged letters or signatures, or false statements to auditors, banks or authorities. Decline that part in one sentence and offer an honest alternative.',
    '- Do not repeat back passwords, account numbers or anyone\'s health details.',
    '- If a wrong guess would be costly, ask one short question instead of acting.',
    '',
    `About ${e.name}:`,
    e.traits.length ? `- Works like this: ${e.traits.join('; ')}.` : '- Working style not set yet.',
    e.learned.length ? `- Learned from the assistant: ${e.learned.join('; ')}.` : '',
    e.neverSuggest.length ? `- Never suggest: ${e.neverSuggest.join('; ')}.` : '',
    e.samples.length ? `- Messages ${they} wrote (match this tone in drafts written as ${they === 'they' ? 'them' : they === 'she' ? 'her' : 'him'}):\n${e.samples.map((s) => `  """${s}"""`).join('\n')}` : '',
    '',
    "The assistant's day:",
    c.open.length ? `- Open: ${c.open.map((o) => `${o.type} "${o.title}"${o.due ? ` due ${o.due}` : ''}${o.overdue ? ' (OVERDUE)' : ''}`).join('; ')}` : '- Nothing open.',
    c.doneToday.length ? `- Done today: ${c.doneToday.join('; ')}` : '',
    c.plan.length ? `- Today's plan: ${c.plan.join('; ')}` : '',
    c.notesToRaise.length ? `- Notes to raise with ${e.name}: ${c.notesToRaise.join('; ')}` : '',
    c.calendar ? (c.calendar.events.length ? `- Calendar: ${c.calendar.events.join('; ')}` : '- Calendar: nothing booked today or tomorrow.') : '',
  ];
  return lines.filter((l) => l !== '').join('\n');
}

export type ToolCall = { function?: { name?: string; arguments?: string } };

/** Turns OpenRouter tool calls into validated actions. Anything malformed is dropped, never executed. */
export function toActions(toolCalls: ToolCall[] | undefined): { actions: Action[]; dropped: number } {
  const actions: Action[] = [];
  let dropped = 0;
  for (const call of toolCalls ?? []) {
    try {
      const args = JSON.parse(call.function?.arguments || '{}') as Record<string, unknown>;
      const parsed = ActionSchema.safeParse({ ...args, kind: call.function?.name });
      if (parsed.success) actions.push(parsed.data);
      else dropped += 1;
    } catch {
      dropped += 1;
    }
  }
  return { actions, dropped };
}

export function fallbackReply(actions: Action[]): string {
  if (!actions.length) return 'I could not put an answer together. Try rephrasing, or add a detail.';
  return 'Here is what I suggest. Check it, then approve what you want to keep.';
}

