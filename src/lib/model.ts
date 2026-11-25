import { z } from 'zod';

export const TRAIT_GROUPS = [
  { id: 'decides', name: 'How they decide', items: ['Results first', 'Wants options', 'Decides fast', 'Needs the numbers', 'Asks for my view', 'Hates surprises', 'Careful with risk', 'Big-picture'] },
  { id: 'communicates', name: 'How they communicate', items: ['Short messages', 'Formal', 'Warm', 'Direct', 'Prefers calls', 'Prefers WhatsApp', 'Wants frequent updates', 'Fixes, not excuses'] },
  { id: 'works', name: 'How they work', items: ['Detail-oriented', 'Punctual', 'Early starter', 'Back-to-back meetings', 'Travels often', 'Protects family time', 'Changes plans often', 'Delegates a lot'] },
] as const;

export const MAX_TRAITS = 5;
export const MAX_EXECUTIVES = 5;
export const FREE_AI_REQUESTS = 3;

export const PronounSchema = z.enum(['she', 'he', 'they']);
export type Pronoun = z.infer<typeof PronounSchema>;

export const LearnedSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(200),
  source: z.string().max(80),
  createdAt: z.string(),
});
export type Learned = z.infer<typeof LearnedSchema>;

export const ExecutiveSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  role: z.string().max(80).default(''),
  org: z.string().max(80).default(''),
  addressAs: z.string().min(1).max(60),
  pronoun: PronounSchema.default('she'),
  traits: z.array(z.string()).max(MAX_TRAITS).default([]),
  samples: z.array(z.string().max(2000)).max(5).default([]),
  learned: z.array(LearnedSchema).default([]),
  neverSuggest: z.array(z.string().max(120)).default([]),
  createdAt: z.string(),
});
export type Executive = z.infer<typeof ExecutiveSchema>;

export const EvidenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  mime: z.string(),
  size: z.number(),
  addedAt: z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const ItemTypeSchema = z.enum(['todo', 'note', 'reminder']);
export type ItemType = z.infer<typeof ItemTypeSchema>;

export const ItemSchema = z.object({
  id: z.string(),
  execId: z.string(),
  type: ItemTypeSchema,
  title: z.string().min(1).max(200),
  body: z.string().max(4000).default(''),
  /** Local date-time "YYYY-MM-DDTHH:mm" for to-dos and reminders; empty when unset. */
  due: z.string().default(''),
  tag: z.string().max(40).default(''),
  raiseWithExec: z.boolean().default(false),
  done: z.boolean().default(false),
  doneAt: z.string().default(''),
  notified: z.boolean().default(false),
  evidence: z.array(EvidenceSchema).default([]),
  source: z.enum(['manual', 'agent']).default('manual'),
  createdAt: z.string(),
});
export type Item = z.infer<typeof ItemSchema>;

export const BlockKindSchema = z.enum(['focus', 'meeting', 'buffer', 'task', 'break']);
export const PlanBlockSchema = z.object({
  id: z.string(),
  execId: z.string(),
  date: z.string(),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  title: z.string().min(1).max(120),
  kind: BlockKindSchema.default('task'),
});
export type PlanBlock = z.infer<typeof PlanBlockSchema>;

export const DraftSchema = z.object({
  id: z.string(),
  execId: z.string(),
  to: z.string().max(80),
  channel: z.enum(['whatsapp', 'email']),
  subject: z.string().max(160).default(''),
  body: z.string().max(4000),
  createdAt: z.string(),
});
export type Draft = z.infer<typeof DraftSchema>;

export const ReportSchema = z.object({
  execId: z.string(),
  date: z.string(),
  text: z.string().max(6000),
  edited: z.boolean().default(false),
  sentVia: z.enum(['', 'whatsapp', 'email', 'copy']).default(''),
  sentAt: z.string().default(''),
});
export type Report = z.infer<typeof ReportSchema>;

/* ---------- Agent actions: what the model may propose; the app runs them only after approval ---------- */

const LocalDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Use YYYY-MM-DDTHH:mm');

export const ActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('add_todo'), title: z.string().min(1).max(200), due: LocalDateTime.optional(), notes: z.string().max(1000).optional() }),
  z.object({ kind: z.literal('add_reminder'), title: z.string().min(1).max(200), remind_at: LocalDateTime }),
  z.object({ kind: z.literal('add_note'), title: z.string().min(1).max(200), body: z.string().max(2000).optional(), raise_with_executive: z.boolean().optional() }),
  z.object({
    kind: z.literal('plan_day'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    blocks: z.array(z.object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/), title: z.string().min(1).max(120), kind: BlockKindSchema.optional() })).min(1).max(16),
  }),
  z.object({ kind: z.literal('draft_message'), to: z.string().min(1).max(80), channel: z.enum(['whatsapp', 'email']), subject: z.string().max(160).optional(), body: z.string().min(1).max(4000) }),
  z.object({ kind: z.literal('write_report'), text: z.string().min(1).max(6000) }),
  z.object({ kind: z.literal('remember_preference'), text: z.string().min(1).max(200) }),
]);
export type Action = z.infer<typeof ActionSchema>;

export const AgentResponseSchema = z.object({
  reply: z.string().max(8000),
  actions: z.array(z.unknown()).max(20),
  model: z.string().optional(),
});

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: Action[];
  /** pending: waiting for approval; applied: approved and run; dismissed: declined */
  actionState?: 'pending' | 'applied' | 'dismissed';
  appliedIds?: string[];
  error?: boolean;
  createdAt: string;
};

export type Profile = {
  name: string;
  role: string;
  onboarded: boolean;
  createdAt: string;
};

export type Settings = {
  notifications: 'default' | 'granted' | 'denied' | 'unsupported';
  ownKey: string;
};

export type AppState = {
  version: 1;
  profile: Profile;
  executives: Executive[];
  activeExecId: string;
  items: Item[];
  plan: PlanBlock[];
  drafts: Draft[];
  reports: Report[];
  chats: Record<string, ChatMessage[]>;
  usage: { aiRequests: number; plan: 'free' | 'pro' };
  readAlerts: string[];
  settings: Settings;
};
