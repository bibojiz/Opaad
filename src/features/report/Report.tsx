import { useEffect, useState } from 'react';
import { Check, Copy, Mail, RotateCcw } from 'lucide-react';
import { readEvidenceFile, setState, useApp } from '@/store/store';
import { activeExec, upsertReport } from '@/store/logic';
import { PageHeader, useShell } from '@/app/shell';
import { Button, OpaadMark } from '@/components/ui';
import { useToast } from '@/components/overlays';
import { buildReport, doneOn } from '@/lib/report';
import { copyText, openEmail, shareToWhatsApp } from '@/lib/device';
import { formatLongDay, formatTime, todayKey } from '@/lib/dates';

export function Report() {
  const s = useApp();
  const exec = activeExec(s)!;
  const { openAsk } = useShell();
  const toast = useToast();
  const date = todayKey();
  const saved = s.reports.find((r) => r.execId === exec.id && r.date === date);
  const generated = buildReport(s, exec);
  const text = saved?.edited ? saved.text : generated;
  const done = doneOn(s.items.filter((i) => i.execId === exec.id), date);
  const evidence = done.flatMap((i) => i.evidence.map((ev) => ({ ...ev, task: i.title })));
  const [skip, setSkip] = useState<string[]>([]);
  const chosen = evidence.filter((e) => !skip.includes(e.id));

  const save = (t: string, patch: Partial<NonNullable<typeof saved>> = {}) =>
    setState((st) => upsertReport(st, { execId: exec.id, date, text: t, edited: true, sentVia: saved?.sentVia ?? '', sentAt: saved?.sentAt ?? '', ...patch }));
  const markSent = (via: 'whatsapp' | 'email' | 'copy') => save(text, { sentVia: via, sentAt: new Date().toISOString() });

  const files = async () => {
    const out: File[] = [];
    for (const ev of chosen) {
      const b = await readEvidenceFile(ev.id);
      if (b) out.push(new File([b], ev.name, { type: ev.mime }));
    }
    return out;
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader title="Tonight's report" subtitle={`For ${exec.addressAs} · ${formatLongDay()}`} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 pb-6 lg:px-8">
        {saved?.sentAt && (
          <p role="status" className="flex items-center gap-2 rounded-card bg-lime/40 p-3 text-sm">
            <Check size={16} aria-hidden /> Handed to {saved.sentVia === 'whatsapp' ? 'WhatsApp' : saved.sentVia === 'email' ? 'email' : 'your clipboard'} at {formatTime(new Date(saved.sentAt))}. Send it from there.
          </p>
        )}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="report" className="text-base font-semibold">Check it, change anything</label>
            {saved?.edited && (
              <button type="button" onClick={() => save(generated, { edited: false })} className="flex h-10 items-center gap-1.5 text-sm text-ink-2">
                <RotateCcw size={14} aria-hidden /> Rebuild from today
              </button>
            )}
          </div>
          <textarea id="report" value={text} onChange={(e) => save(e.target.value)} rows={16} className="rounded-card border border-line bg-surface p-3.5 text-[15px] leading-relaxed outline-none focus:border-ink" />
          <button type="button" onClick={() => openAsk({ prompt: `Write tonight's report to ${exec.addressAs} in ${exec.pronoun === 'he' ? 'his' : exec.pronoun === 'she' ? 'her' : 'their'} preferred style, from what I finished and what is still open.`, send: true })} className="flex items-center gap-2 self-start rounded-field border border-line bg-surface px-3 py-2.5 text-sm font-medium">
            <OpaadMark size={16} /> Rewrite in {exec.addressAs}'s style
          </button>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Proof to attach</h2>
            <span className="text-[13px] text-ink-2">{chosen.length} of {evidence.length}</span>
          </div>
          {evidence.length ? (
            <ul className="grid grid-cols-3 gap-2">
              {evidence.map((ev) => (
                <li key={ev.id}>
                  <EvidenceChoice name={ev.name} id={ev.id} mime={ev.mime} task={ev.task} on={!skip.includes(ev.id)} toggle={() => setSkip((x) => (x.includes(ev.id) ? x.filter((y) => y !== ev.id) : [...x, ev.id]))} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-relaxed text-ink-2">No photos or files on today's finished tasks. Add them from a task, or with + then Evidence.</p>
          )}
        </section>
      </main>

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-surface px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] lg:px-8">
        <div className="mx-auto flex w-full max-w-2xl gap-2">
          <Button
            variant="whatsapp"
            size="lg"
            className="flex-1"
            onClick={async () => {
              const r = await shareToWhatsApp(text, await files());
              if (r !== 'cancelled') markSent('whatsapp');
              if (r === 'opened' && chosen.length) toast('Text is in WhatsApp. Attach the photos from your gallery.');
            }}
          >
            Share to WhatsApp
          </Button>
          <Button variant="secondary" size="lg" onClick={() => { openEmail(`Today's update · ${formatLongDay()}`, text); markSent('email'); }} aria-label="Open in email">
            <Mail size={18} aria-hidden />
          </Button>
          <Button variant="secondary" size="lg" onClick={async () => { if (await copyText(text)) { markSent('copy'); toast('Report copied'); } }} aria-label="Copy report">
            <Copy size={18} aria-hidden />
          </Button>
        </div>
        <p className="text-center text-xs text-ink-2">Opaad never sends anything itself. You send it from WhatsApp or email.</p>
      </div>
    </div>
  );
}

function EvidenceChoice({ id, name, mime, task, on, toggle }: { id: string; name: string; mime: string; task: string; on: boolean; toggle: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let u = '';
    if (mime.startsWith('image/')) void readEvidenceFile(id).then((b) => b && setUrl((u = URL.createObjectURL(b))));
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [id, mime]);
  return (
    <button type="button" aria-pressed={on} onClick={toggle} title={`${name} · ${task}`} className={`relative flex h-24 w-full items-end overflow-hidden rounded-card border-2 bg-subtle p-1.5 text-left text-[11px] ${on ? 'border-ink' : 'border-transparent opacity-50'}`}>
      {url ? <img src={url} alt="" className="absolute inset-0 size-full object-cover" /> : <span className="break-all">{name}</span>}
      {on && (
        <span className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-lime">
          <Check size={13} strokeWidth={3} aria-hidden />
        </span>
      )}
      <span className="sr-only">{on ? 'Included' : 'Left out'}: {name}, from {task}</span>
    </button>
  );
}
