import { describe, expect, it } from 'vitest';
import { AgentRequestSchema, callOpenRouter, systemPrompt, toActions } from './agent-core';

const request = AgentRequestSchema.parse({
  messages: [{ role: 'user', content: 'She wants the board pack by 4pm and Finance has not sent the Q3 numbers. What do I do?' }],
  context: {
    assistant: { name: 'Boluwatife', role: 'Executive Assistant' },
    executive: { name: 'Adaeze Okafor', role: 'Managing Director', org: '', addressAs: 'Mrs. Okafor', pronoun: 'she', traits: ['Results first', 'Hates surprises'], samples: ['Bolu, the board pack must be on my desk by 3. No stories please.'], learned: ['Wants two options, not five'], neverSuggest: ['Weekend meetings'] },
    now: '2026-11-24T10:00',
    weekday: 'Tuesday',
    timezone: 'Africa/Lagos',
    open: [{ type: 'todo', title: 'Follow up Finance', due: 'Yesterday 12:00', overdue: true }],
    doneToday: [],
    plan: [],
    notesToRaise: [],
  },
});

describe('agent server', () => {
  it('puts the executive profile and the rules in the system prompt', () => {
    const p = systemPrompt(request.context);
    expect(p).toContain('"Mrs. Okafor"');
    expect(p).toContain('Results first; Hates surprises');
    expect(p).toContain('Never suggest: Weekend meetings');
    expect(p).toContain('Never fabricate records');
    expect(p).toContain('(OVERDUE)');
  });

  it('keeps valid tool calls and drops malformed ones', () => {
    const { actions, dropped } = toActions([
      { function: { name: 'add_todo', arguments: JSON.stringify({ title: 'Call Tunde in Finance', due: '2026-11-24T11:00' }) } },
      { function: { name: 'add_reminder', arguments: JSON.stringify({ title: 'Check numbers', remind_at: 'soon' }) } },
      { function: { name: 'send_whatsapp', arguments: '{}' } },
      { function: { name: 'draft_message', arguments: 'not json' } },
    ]);
    expect(actions).toEqual([{ kind: 'add_todo', title: 'Call Tunde in Finance', due: '2026-11-24T11:00' }]);
    expect(dropped).toBe(3);
  });

  it('calls OpenRouter with tools, privacy routing and a fallback model', async () => {
    let sent: Record<string, unknown> = {};
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response(
        JSON.stringify({
          model: 'test/model',
          choices: [{ message: { content: 'Ask Finance for the Q3 numbers by 1pm.', tool_calls: [{ function: { name: 'add_reminder', arguments: '{"title":"Chase Q3 numbers","remind_at":"2026-11-24T13:00"}' } }] } }],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const r = await callOpenRouter(request, { apiKey: 'k', model: 'a/primary', fallbackModel: 'b/fallback', referer: 'https://opaad.test', fetchImpl: fakeFetch });
    expect(r.reply).toContain('Q3 numbers');
    expect(r.actions[0]).toMatchObject({ kind: 'add_reminder', remind_at: '2026-11-24T13:00' });
    expect(sent.models).toEqual(['a/primary', 'b/fallback']);
    expect(sent.provider).toEqual({ data_collection: 'deny' });
    expect((sent.tools as unknown[]).length).toBe(8);
  });
});
