import { afterEach, describe, expect, it } from 'vitest';
import { verifyUser } from './supabase-auth';

const ok = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('server sign-in check', () => {
  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
  });
  it('is off when Supabase is not configured', async () => {
    expect(await verifyUser(null)).toEqual({ required: false });
  });
  it('rejects missing or bad tokens and accepts a real session', async () => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'pk';
    expect((await verifyUser(null)).user).toBeUndefined();
    expect((await verifyUser('Bearer bad', () => ok({}, 401))).user).toBeUndefined();
    expect((await verifyUser('Bearer good', () => ok({ id: 'u1' }))).user).toEqual({ id: 'u1' });
  });
});
