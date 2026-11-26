import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { GOOGLE_SIGNIN, supabase } from '@/lib/supabase';
import { OpaadMark, inputCls } from '@/components/ui';
import { useSession } from './session';

type Step = { kind: 'email' } | { kind: 'code'; email: string };

function friendly(message: string): string {
  if (/rate limit|too many|seconds/i.test(message)) return 'Too many codes asked for. Wait a minute, then try again.';
  if (/expired|invalid|token/i.test(message)) return "That code didn't work. Check it, or send a new one.";
  if (/fetch|network/i.test(message)) return "You're offline. Connect and try again.";
  return 'Something went wrong. Try again.';
}

/** Email + one-time code. No passwords. The link in the same email also signs the person in. */
export function SignIn() {
  const session = useSession();
  const [step, setStep] = useState<Step>({ kind: 'email' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (session.status === 'in') return <Navigate to="/" replace />;

  const sendCode = async (address: string) => {
    if (!supabase) return;
    setBusy(true);
    setError('');
    const { error: e } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true, emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (e) return setError(friendly(e.message));
    setStep({ kind: 'code', email: address });
    setCode('');
    setCooldown(60);
  };

  const onEmail = (ev: FormEvent) => {
    ev.preventDefault();
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return setError('Enter a full email address, like name@company.com.');
    void sendCode(address);
  };

  const onCode = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!supabase || step.kind !== 'code') return;
    const token = code.replace(/\D/g, '');
    if (token.length < 6) return setError('Enter the code from the email.');
    setBusy(true);
    setError('');
    const { error: e } = await supabase.auth.verifyOtp({ email: step.email, token, type: 'email' });
    setBusy(false);
    if (e) setError(friendly(e.message));
  };

  const google = async () => {
    if (!supabase) return;
    const { error: e } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (e) setError(friendly(e.message));
  };

  const loading = session.status === 'loading' || session.status === 'syncing';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-6 px-5 pb-8 pt-10">
      <div className="flex items-center gap-2.5">
        <OpaadMark size={26} />
        <span className="font-display text-2xl leading-none tracking-tight">Opaad</span>
      </div>

      {loading ? (
        <p role="status" className="text-ink-2">
          {session.status === 'syncing' ? 'Opening your workspace…' : 'Loading…'}
        </p>
      ) : step.kind === 'email' ? (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[32px] leading-[1.1] tracking-tight">Sign in or create your account</h1>
            <p className="text-ink-2">Free while we're in early access.</p>
          </div>
          {GOOGLE_SIGNIN && (
            <>
              <button type="button" onClick={() => void google()} className="flex h-[52px] items-center justify-center gap-2 rounded-card border border-line bg-surface text-base font-semibold">
                Continue with Google
              </button>
              <p className="text-center text-sm text-ink-3">or use your email</p>
            </>
          )}
          <form onSubmit={onEmail} noValidate className="flex flex-col gap-3">
            <label htmlFor="signin-email" className="text-sm font-semibold">
              Email
            </label>
            <input id="signin-email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" aria-describedby="signin-help" className={`${inputCls} h-12`} />
            <p id="signin-help" className="text-sm text-ink-2">
              We'll email you a code. No password to remember.
            </p>
            <button type="submit" disabled={busy} className="mt-2 h-[52px] rounded-card bg-lime text-base font-semibold disabled:opacity-60">
              {busy ? 'Sending…' : 'Send me a code'}
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[32px] leading-[1.1] tracking-tight">Check your email</h1>
            <p className="text-ink-2">
              We sent a code to <span className="font-semibold text-ink">{step.email}</span>. Enter it here, or tap the link in that email.
            </p>
          </div>
          <form onSubmit={(e) => void onCode(e)} noValidate className="flex flex-col gap-3">
            <label htmlFor="signin-code" className="text-sm font-semibold">
              Code
            </label>
            <input id="signin-code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} className={`${inputCls} h-12 text-lg tracking-[0.3em]`} autoFocus />
            <button type="submit" disabled={busy} className="mt-2 h-[52px] rounded-card bg-lime text-base font-semibold disabled:opacity-60">
              {busy ? 'Checking…' : 'Sign in'}
            </button>
          </form>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <button type="button" disabled={busy || cooldown > 0} onClick={() => void sendCode(step.email)} className="min-h-11 font-semibold underline disabled:no-underline disabled:opacity-60">
              {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
            </button>
            <button type="button" onClick={() => { setStep({ kind: 'email' }); setError(''); }} className="min-h-11 font-semibold underline">
              Use a different email
            </button>
          </div>
        </>
      )}

      {(error || session.error) && (
        <p role="alert" className="text-sm text-danger">
          {error || session.error}
        </p>
      )}
    </main>
  );
}
