import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, ChevronLeft, EyeOff, Lock, Send, Trash2 } from 'lucide-react';
import { setState } from '@/store/store';
import { completeOnboarding, newExecutive } from '@/store/logic';
import { Button, Chip, Field, OpaadMark, inputCls } from '@/components/ui';
import { MAX_TRAITS, TRAIT_GROUPS, type Pronoun } from '@/lib/model';
import { requestNotifications, useVoice } from '@/lib/device';
import { AUTH_ON } from '@/lib/supabase';

const ROLES = ['Executive Assistant', 'Personal Assistant', 'Virtual Assistant', 'Office Manager', 'Chief of Staff'];
const STEPS = 7;

export function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [role, setRole] = useState(ROLES[0]!);
  const [exec, setExec] = useState({ name: '', role: '', org: '', addressAs: '', pronoun: 'she' as Pronoun });
  const [traits, setTraits] = useState<string[]>([]);
  const [sample, setSample] = useState('');
  const voice = useVoice((t) => setSample(t));

  const surname = exec.name.trim().split(/\s+/).slice(-1)[0] ?? '';
  const first = exec.name.trim().split(/\s+/)[0] ?? '';
  const addressOptions = Array.from(new Set([exec.pronoun === 'he' ? `Mr. ${surname}` : exec.pronoun === 'she' ? `Mrs. ${surname}` : surname, first, exec.pronoun === 'he' ? 'Sir' : exec.pronoun === 'she' ? 'Ma' : first].filter((x) => x && x.trim().length > 1)));

  const finish = async (withReminders: boolean) => {
    const notifications = withReminders ? await requestNotifications() : 'default';
    const e = newExecutive({ ...exec, name: exec.name.trim(), addressAs: exec.addressAs.trim() || first, traits, samples: sample.trim() ? [sample.trim()] : [] });
    sessionStorage.setItem('opaad:welcome', '1');
    setState((s) => ({ ...completeOnboarding(s, name.trim(), e), profile: { ...s.profile, name: name.trim(), role, onboarded: true }, settings: { ...s.settings, notifications } }));
    nav('/', { replace: true });
  };

  const next = () => setStep((x) => Math.min(STEPS - 1, x + 1));
  const back = () => setStep((x) => Math.max(0, x - 1));
  const them = exec.pronoun === 'he' ? 'him' : exec.pronoun === 'she' ? 'her' : 'them';
  const they = exec.pronoun === 'they' ? 'they' : exec.pronoun;
  const who = exec.addressAs || first || 'your executive';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-4 pb-[max(20px,env(safe-area-inset-bottom))]">
      {step > 0 && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={back} aria-label="Back" className="flex size-11 items-center justify-center rounded-card border border-line bg-surface">
            <ChevronLeft size={20} aria-hidden />
          </button>
          <div className="flex flex-1 gap-1.5" aria-label={`Step ${step} of ${STEPS - 1}`} role="progressbar" aria-valuemin={1} aria-valuemax={STEPS - 1} aria-valuenow={step}>
            {Array.from({ length: STEPS - 1 }, (_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-ink' : 'bg-line'}`} />
            ))}
          </div>
        </div>
      )}

      {step === 0 && (
        <section className="flex flex-1 flex-col justify-between gap-8 pt-10">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2.5">
              <OpaadMark size={30} label="Opaad" />
              <span className="font-display text-[28px] leading-none tracking-[-1px]">Opaad</span>
            </div>
            <h1 className="font-display text-[40px] leading-[1.05] tracking-[-1.5px]">Work like you've done this for ten years.</h1>
            <p className="text-[17px] leading-relaxed text-ink-2">Tell Opaad what's going on. Get the decision, the plan and the words, the way your executive likes them. You check everything before it goes.</p>
          </div>
          <div className="flex flex-col gap-3">
            <Button size="lg" block onClick={next}>Get started</Button>
            <p className="text-center text-[13px] text-ink-2">{AUTH_ON ? 'Free in early access.' : 'Free in early access. No account needed: your work stays on this device.'}</p>
          </div>
        </section>
      )}

      {step === 1 && (
        <Step title="First, you" body="Opaad uses your name in drafts and reports." onNext={next} canNext={name.trim().length > 0}>
          <Field label="Your first name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" autoFocus />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium">Your role</legend>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <Chip key={r} on={role === r} onClick={() => setRole(r)}>{r}</Chip>
              ))}
            </div>
          </fieldset>
        </Step>
      )}

      {step === 2 && (
        <Step title="Who do you assist?" body="Start with one person. You can add up to four more later." onNext={next} canNext={exec.name.trim().length > 1}>
          <Field label="Their full name">
            <input className={inputCls} value={exec.name} onChange={(e) => setExec({ ...exec, name: e.target.value })} autoFocus placeholder="e.g. Adaeze Okafor" />
          </Field>
          <Field label="Their role" hint="(optional)">
            <input className={inputCls} value={exec.role} onChange={(e) => setExec({ ...exec, role: e.target.value })} placeholder="e.g. Managing Director" />
          </Field>
          <Field label="Organisation" hint="(optional)">
            <input className={inputCls} value={exec.org} onChange={(e) => setExec({ ...exec, org: e.target.value })} />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium">In drafts, refer to them as</legend>
            <div className="flex gap-2">
              {(['she', 'he', 'they'] as const).map((p) => (
                <Chip key={p} on={exec.pronoun === p} onClick={() => setExec({ ...exec, pronoun: p })}>{p}</Chip>
              ))}
            </div>
          </fieldset>
          {exec.name.trim().length > 1 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-medium">You address {them} as</legend>
              <div className="flex flex-wrap gap-2">
                {addressOptions.map((a) => (
                  <Chip key={a} on={exec.addressAs === a} onClick={() => setExec({ ...exec, addressAs: a })}>{a}</Chip>
                ))}
              </div>
              <input aria-label="Or type how you address them" className={inputCls} value={exec.addressAs} onChange={(e) => setExec({ ...exec, addressAs: e.target.value })} placeholder="Or type it" />
            </fieldset>
          )}
        </Step>
      )}

      {step === 3 && (
        <Step title={`How does ${who} work?`} body={`Pick up to ${MAX_TRAITS}. Opaad shapes every suggestion around them. ${traits.length} of ${MAX_TRAITS} picked.`} onNext={next} canNext nextLabel={traits.length ? 'Continue' : 'Skip for now'}>
          {TRAIT_GROUPS.map((g) => (
            <fieldset key={g.id} className="flex flex-col gap-2">
              <legend className="mb-1.5 text-xs font-semibold tracking-wider text-ink-2 uppercase">{they === 'they' ? g.name : g.name.replace('they ', `${they} `).replace(/(decide|communicate|work)$/, '$1s')}</legend>
              <div className="flex flex-wrap gap-2">
                {g.items.map((t) => {
                  const on = traits.includes(t);
                  const full = traits.length >= MAX_TRAITS && !on;
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      disabled={full}
                      onClick={() => setTraits((x) => (on ? x.filter((y) => y !== t) : [...x, t]))}
                      className={`min-h-10 rounded-[10px] border px-3 py-2 text-sm ${on ? 'border-ink bg-lime font-semibold' : 'border-line bg-surface'} disabled:opacity-40`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </Step>
      )}

      {step === 4 && (
        <Step title={`Show Opaad how ${who} writes`} body={`Paste a message ${they} sent you, or read it out. Drafts will sound like ${them}. Optional.`} onNext={next} canNext nextLabel={sample.trim() ? 'Continue' : 'Skip for now'}>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            A message from {who}
            <textarea value={sample} onChange={(e) => setSample(e.target.value)} rows={6} className="rounded-field border border-line bg-surface p-3.5 text-base outline-none focus:border-ink" placeholder="e.g. Bolu, the board pack must be on my desk by 3. If Finance delays, call Tunde directly. No stories please." />
          </label>
          {voice.supported && (
            <Button variant="secondary" onClick={voice.toggle} aria-pressed={voice.listening}>
              {voice.listening ? 'Stop listening' : 'Read it out instead'}
            </Button>
          )}
          <p className="text-[13px] text-ink-2">Leave out passwords, account numbers and anyone's health details.</p>
        </Step>
      )}

      {step === 5 && (
        <Step title="What Opaad sees" body={`You handle private things for ${who}. Here is how Opaad handles them.`} onNext={next} canNext nextLabel="I understand">
          <ul className="flex flex-col gap-4">
            {[
              { I: EyeOff, t: 'Only what you allow', b: 'Opaad reads what you type, and a calendar only if you connect one. It never reads your WhatsApp or email.' },
              { I: Send, t: 'Nothing goes out without you', b: 'Every draft waits for you to check, copy and send. Every change waits for your approval.' },
              AUTH_ON ? { I: Lock, t: 'Private to your account', b: 'Your tasks and notes are stored in your Opaad account so they follow you to any device. Only you can open them. Attached files stay on the device you added them on. When you ask Opaad, that request goes to our AI provider with data collection switched off.' } : { I: Lock, t: 'Kept on this device', b: 'Your tasks, notes and files stay in this browser. When you ask Opaad, that request goes to our AI provider with data collection switched off.' },
              { I: Trash2, t: 'Yours to delete', b: 'Remove an executive and everything about them goes too. Settings can wipe it all.' },
            ].map(({ I, t, b }) => (
              <li key={t} className="flex gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-card bg-subtle"><I size={18} aria-hidden /></span>
                <span className="flex flex-col gap-0.5"><span className="font-semibold">{t}</span><span className="text-sm leading-relaxed text-ink-2">{b}</span></span>
              </li>
            ))}
          </ul>
        </Step>
      )}

      {step === 6 && (
        <section className="flex flex-1 flex-col justify-between gap-8 pt-8">
          <div className="flex flex-col gap-4">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-lime"><BellRing size={26} aria-hidden /></span>
            <h1 className="font-display text-[30px] leading-tight tracking-[-1px]">Never miss a follow-up</h1>
            <p className="text-base leading-relaxed text-ink-2">Opaad reminds you 15 minutes before a to-do is due, and when a reminder's time comes. On iPhone, add Opaad to your Home Screen first (Share, then Add to Home Screen).</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button size="lg" block onClick={() => void finish(true)}>Turn on reminders</Button>
            <Button size="lg" variant="ghost" block onClick={() => void finish(false)}>Not now</Button>
          </div>
        </section>
      )}
    </main>
  );
}

function Step({ title, body, children, onNext, canNext, nextLabel = 'Continue' }: { title: string; body: string; children: ReactNode; onNext: () => void; canNext: boolean; nextLabel?: string }) {
  return (
    <form
      className="flex flex-1 flex-col gap-6 pt-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (canNext) onNext();
      }}
    >
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[30px] leading-tight tracking-[-1px]">{title}</h1>
        <p className="text-base leading-relaxed text-ink-2">{body}</p>
      </div>
      <div className="flex flex-1 flex-col gap-5">{children}</div>
      <Button type="submit" size="lg" block disabled={!canNext}>{nextLabel}</Button>
    </form>
  );
}
