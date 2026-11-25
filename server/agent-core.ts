import { z } from 'zod';
import type { Action } from '../src/lib/model';
import { TOOLS, fallbackReply, systemPrompt, toActions, type ToolCall } from '../src/lib/agent-prompt';
export { TOOLS, systemPrompt, toActions };

/* ---------- Request contract (validated on the server) ---------- */

export const AgentRequestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(6000) }))
    .min(1)
    .max(24),
  context: z.object({
    assistant: z.object({ name: z.string().max(80), role: z.string().max(80) }),
    executive: z.object({
      name: z.string().max(80),
      role: z.string().max(80),
      org: z.string().max(80),
      addressAs: z.string().max(60),
      pronoun: z.enum(['she', 'he', 'they']),
      traits: z.array(z.string().max(60)).max(5),
      samples: z.array(z.string().max(800)).max(3),
      learned: z.array(z.string().max(200)).max(30),
      neverSuggest: z.array(z.string().max(120)).max(20),
    }),
    now: z.string().max(40),
    weekday: z.string().max(20),
    timezone: z.string().max(60),
    open: z
      .array(z.object({ type: z.string().max(12), title: z.string().max(200), due: z.string().max(20), overdue: z.boolean() }))
      .max(40),
    doneToday: z.array(z.string().max(200)).max(40),
    plan: z.array(z.string().max(160)).max(20),
    notesToRaise: z.array(z.string().max(200)).max(20),
    calendar: z
      .object({ name: z.string().max(80), canWrite: z.boolean(), events: z.array(z.string().max(200)).max(30) })
      .nullable()
      .optional(),
  }),
});
export type AgentRequest = z.infer<typeof AgentRequestSchema>;

export type OpenRouterResult = { reply: string; actions: Action[]; model?: string; dropped: number };

export async function callOpenRouter(req: AgentRequest, opts: { apiKey: string; model: string; fallbackModel?: string; referer: string; fetchImpl?: typeof fetch }): Promise<OpenRouterResult> {
  const f = opts.fetchImpl ?? fetch;
  const res = await f('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': opts.referer,
      'X-Title': 'Opaad',
    },
    body: JSON.stringify({
      model: opts.model,
      ...(opts.fallbackModel ? { models: [opts.model, opts.fallbackModel] } : {}),
      messages: [{ role: 'system', content: systemPrompt(req.context) }, ...req.messages.slice(-12)],
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 1400,
      provider: { data_collection: 'deny' },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new UpstreamError(res.status, text.slice(0, 300));
  }
  const data = (await res.json()) as { model?: string; choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[] };
  const msg = data.choices?.[0]?.message;
  const { actions, dropped } = toActions(msg?.tool_calls);
  const reply = (msg?.content ?? '').trim() || fallbackReply(actions);
  return { reply, actions, model: data.model, dropped };
}

export class UpstreamError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`OpenRouter ${status}`);
  }
}
