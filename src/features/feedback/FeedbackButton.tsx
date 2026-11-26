import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { MessageSquarePlus } from 'lucide-react';
import { Sheet, useToast } from '@/components/overlays';
import { Button } from '@/components/ui';
import { AUTH_ON } from '@/lib/supabase';
import { sendFeedback } from '@/features/admin/api';

const kinds = [
  { id: 'idea', label: 'Idea' },
  { id: 'problem', label: 'Something went wrong' },
  { id: 'praise', label: 'Something I like' },
] as const;

/** Testers tell the Opaad team what works and what doesn't. Goes to the admin portal's Feedback tab. */
export function FeedbackButton({ rail }: { rail?: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof kinds)[number]['id']>('idea');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const loc = useLocation();
  if (!AUTH_ON) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return setError('Write a few words first.');
    setBusy(true);
    setError('');
    try {
      await sendFeedback(kind, text.trim(), loc.pathname);
      setOpen(false);
      setText('');
      toast('Thank you. The Opaad team reads every message.');
    } catch {
      setError("Couldn't send it. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={rail ? 'Send feedback' : undefined} className={`flex h-11 items-center gap-3 rounded-card px-3 text-[15px] font-medium text-ink-2 hover:bg-subtle ${rail ? 'justify-center' : ''}`}>
        <MessageSquarePlus size={20} aria-hidden />
        {!rail && 'Send feedback'}
      </button>
      {createPortal(
      <Sheet open={open} onClose={() => setOpen(false)} title="Send feedback">
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-2 text-sm font-semibold">What is it about?</legend>
            {kinds.map((k) => (
              <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)} className={`min-h-10 rounded-[10px] border px-3 text-sm ${kind === k.id ? 'border-ink bg-lime font-semibold' : 'border-line bg-surface'}`}>
                {k.label}
              </button>
            ))}
          </fieldset>
          <label htmlFor="fb-text" className="text-sm font-semibold">Tell us</label>
          <textarea id="fb-text" rows={5} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="What were you trying to do, and what happened?" className="w-full rounded-field border border-line bg-surface p-3 text-base outline-none focus:border-ink" />
          <p className="text-[13px] text-ink-3">We see your message and email, not your tasks or notes.</p>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send'}</Button>
        </form>
      </Sheet>,
      document.body,
      )}
    </>
  );
}
