import { AgentRequestSchema, UpstreamError, callOpenRouter } from './agent-core';

const MAX_BODY = 60_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'too_large', message: 'That request is too long. Shorten it and try again.' }, 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'bad_request', message: 'The request was not valid.' }, 400);
  }
  const parsed = AgentRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'bad_request', message: 'The request was not valid.' }, 400);

  const ownKey = request.headers.get('x-openrouter-key')?.trim();
  const apiKey = ownKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return json({ error: 'not_configured', message: "Opaad's AI isn't switched on for this site yet. The owner needs to add the OpenRouter key." }, 503);
  }

  try {
    const result = await callOpenRouter(parsed.data, {
      apiKey,
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-6.1-terra',
      fallbackModel: process.env.OPENROUTER_FALLBACK_MODEL || 'deepseek/deepseek-v4.1-flash-1017',
      referer: process.env.PUBLIC_SITE_URL || new URL(request.url).origin,
    });
    return json(result);
  } catch (err) {
    if (err instanceof UpstreamError) {
      const status = err.status === 401 || err.status === 403 ? 502 : err.status === 429 ? 429 : 502;
      const message =
        err.status === 401 ? 'The AI key was rejected. Check the OpenRouter key.' : err.status === 402 ? 'The AI account is out of credit.' : err.status === 429 ? 'Opaad is busy. Try again in a minute.' : 'The AI service had a problem. Try again.';
      return json({ error: 'upstream', message }, status);
    }
    return json({ error: 'server', message: 'Something went wrong on our side. Try again.' }, 500);
  }
}

export function GET(): Response {
  return json({ ok: true, configured: Boolean(process.env.OPENROUTER_API_KEY) });
}
