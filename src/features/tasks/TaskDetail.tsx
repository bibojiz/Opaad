import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, FileText, Plus, Trash2 } from 'lucide-react';
import { deleteEvidenceFile, readEvidenceFile, saveEvidenceFile, setState, useApp } from '@/store/store';
import { removeItems, toggleDone, updateItem } from '@/store/logic';
import { useShell } from '@/app/shell';
import { Button, OpaadMark } from '@/components/ui';
import { Sheet, useToast } from '@/components/overlays';
import type { Evidence } from '@/lib/model';
import { dueLabel, isOverdue, uid } from '@/lib/dates';

export function TaskDetail() {
  const { id = '' } = useParams();
  const s = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const { openAsk } = useShell();
  const item = s.items.find((i) => i.id === id);
  const exec = s.executives.find((e) => e.id === item?.execId);
  const [confirm, setConfirm] = useState(false);

  if (!item) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
        <p className="text-base">This item no longer exists.</p>
        <Link to="/tasks" className="font-semibold underline">Back to Tasks</Link>
      </main>
    );
  }
  const late = !item.done && item.type !== 'note' && !!item.due && isOverdue(item.due);
  const patch = (p: Parameters<typeof updateItem>[2]) => setState((st) => updateItem(st, item.id, p));
  const label = item.type === 'todo' ? 'To-do' : item.type === 'note' ? 'Note' : 'Reminder';

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const added: Evidence[] = [];
    for (const f of Array.from(files).slice(0, 6)) {
      const ev = { id: uid('ev_'), name: f.name, mime: f.type || 'application/octet-stream', size: f.size, addedAt: new Date().toISOString() };
      await saveEvidenceFile(ev.id, f);
      added.push(ev);
    }
    patch({ evidence: [...item.evidence, ...added] });
    toast(`${added.length} file${added.length > 1 ? 's' : ''} attached`);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-2 px-4 pt-4 pb-2 lg:px-8">
        <button type="button" onClick={() => (history.length > 1 ? nav(-1) : nav('/tasks'))} aria-label="Back" className="flex size-11 items-center justify-center rounded-card border border-line bg-surface">
          <ChevronLeft size={20} aria-hidden />
        </button>
        <span className="flex-1" />
        <button type="button" onClick={() => setConfirm(true)} aria-label="Delete" className="flex size-11 items-center justify-center rounded-card border border-line bg-surface">
          <Trash2 size={18} aria-hidden />
        </button>
        <button type="button" onClick={() => openAsk()} aria-label="Ask Opaad" className="flex size-11 items-center justify-center rounded-full bg-lime">
          <OpaadMark size={20} />
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 pb-6 lg:px-8">
        <div className="flex flex-col gap-2.5">
          <span className={`self-start rounded-md px-2.5 py-1 text-[13px] font-semibold ${item.done ? 'bg-lime' : late ? 'bg-danger-soft text-danger-ink' : 'bg-subtle'}`}>
            {item.done ? 'Done' : late ? `Overdue since ${dueLabel(item.due)}` : label}
          </span>
          <label className="sr-only" htmlFor="title">Title</label>
          <textarea id="title" rows={2} value={item.title} onChange={(e) => patch({ title: e.target.value.slice(0, 200) || item.title })} className="resize-none bg-transparent font-display text-[26px] leading-tight tracking-[-1px] outline-none [field-sizing:content]" />
        </div>

        <dl className="rounded-card border border-line bg-surface px-3">
          {item.type !== 'note' && (
            <Row term={item.type === 'reminder' ? 'Remind me' : 'Due'}>
              <input type="datetime-local" value={item.due} onChange={(e) => patch({ due: e.target.value, notified: false })} className="h-10 rounded-field border border-line px-2 text-sm" aria-label="Due date and time" />
            </Row>
          )}
          <Row term="For">{exec?.addressAs}</Row>
          <Row term="Tag">
            <input value={item.tag} onChange={(e) => patch({ tag: e.target.value.slice(0, 40) })} placeholder="e.g. Business" className="h-10 w-36 rounded-field border border-line px-2 text-right text-sm" aria-label="Tag" />
          </Row>
          {item.type === 'note' && (
            <Row term={`Raise with ${exec?.addressAs}`}>
              <input type="checkbox" role="switch" checked={item.raiseWithExec} onChange={(e) => patch({ raiseWithExec: e.target.checked })} className="size-5 accent-ink" aria-label="Raise with executive" />
            </Row>
          )}
          <Row term="Added" last>
            {new Date(item.createdAt).toLocaleDateString()} {item.source === 'agent' ? '· by Opaad, approved by you' : ''}
          </Row>
        </dl>

        <section className="flex flex-col gap-2">
          <label htmlFor="body" className="text-base font-semibold">Notes</label>
          <textarea id="body" value={item.body} onChange={(e) => patch({ body: e.target.value })} rows={4} placeholder="Details, names, numbers, next step" className="rounded-card border border-line bg-surface p-3 text-[15px] leading-relaxed outline-none focus:border-ink" />
        </section>

        {item.type !== 'note' && (
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold">Evidence</h2>
              <span className="text-[13px] text-ink-2">Goes into tonight's report</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {item.evidence.map((ev) => (
                <EvidenceTile key={ev.id} ev={ev} onRemove={() => { void deleteEvidenceFile(ev.id); patch({ evidence: item.evidence.filter((x) => x.id !== ev.id) }); }} />
              ))}
              <label className="relative flex h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-card border-[1.5px] border-dashed border-ink-3 bg-surface text-center text-xs text-ink-2 focus-within:outline-2 focus-within:outline-ink">
                <Plus size={18} aria-hidden className="text-ink" />
                Photo, video
                <br />
                or file
                <input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" className="absolute inset-0 opacity-0" aria-label="Add evidence from your device" onChange={(e) => void addFiles(e.target.files)} />
              </label>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-3">
          <h2 className="flex items-center gap-2 text-base font-semibold"><OpaadMark size={16} /> Opaad can help</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => openAsk({ prompt: `Draft a firm, polite follow-up about: "${item.title}". ${item.body}`, send: true })} className="h-10 rounded-field border border-line px-3 text-sm">Draft a follow-up</button>
            <button type="button" onClick={() => openAsk({ prompt: `About "${item.title}"${late ? ' (it is overdue)' : ''}: what do I tell ${exec?.addressAs}?`, send: true })} className="h-10 rounded-field border border-line px-3 text-sm">What do I tell {exec?.addressAs}?</button>
          </div>
        </section>
      </main>

      {item.type !== 'note' && (
        <div className="sticky bottom-0 flex gap-2 border-t border-line bg-surface px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] lg:px-8">
          <Button size="lg" variant={item.done ? 'secondary' : 'primary'} className="flex-1" onClick={() => { setState((st) => toggleDone(st, item.id)); if (!item.done) toast("Done. It's in tonight's report."); }}>
            {item.done ? 'Mark not done' : <><Check size={18} aria-hidden /> Mark as done</>}
          </Button>
        </div>
      )}

      <Sheet open={confirm} onClose={() => setConfirm(false)} title={`Delete this ${label.toLowerCase()}?`}>
        <p className="mb-4 text-[15px] leading-relaxed text-ink-2">"{item.title}" and its {item.evidence.length} attached file{item.evidence.length === 1 ? '' : 's'} will be removed from this device.</p>
        <div className="flex gap-2">
          <Button variant="danger" className="flex-1" onClick={() => { item.evidence.forEach((ev) => void deleteEvidenceFile(ev.id)); setState((st) => removeItems(st, [item.id])); nav('/tasks', { replace: true }); toast('Deleted'); }}>Delete</Button>
          <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>Keep it</Button>
        </div>
      </Sheet>
    </div>
  );
}

function Row({ term, children, last }: { term: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={`flex min-h-12 items-center justify-between gap-3 py-1.5 ${last ? '' : 'border-b border-line-soft'}`}>
      <dt className="text-sm text-ink-2">{term}</dt>
      <dd className="text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

function EvidenceTile({ ev, onRemove }: { ev: Evidence; onRemove: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let u = '';
    void readEvidenceFile(ev.id).then((b) => {
      if (b) {
        u = URL.createObjectURL(b);
        setUrl(u);
      }
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [ev.id]);
  const isImage = ev.mime.startsWith('image/');
  return (
    <div className="relative h-24 overflow-hidden rounded-card border border-line bg-subtle">
      {isImage && url ? (
        <img src={url} alt={ev.name} className="size-full object-cover" />
      ) : (
        <a href={url || undefined} download={ev.name} className="flex size-full flex-col justify-between p-2 text-xs break-all">
          <FileText size={18} aria-hidden />
          {ev.name}
        </a>
      )}
      <button type="button" onClick={onRemove} aria-label={`Remove ${ev.name}`} className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-ink/70 text-white">
        <Trash2 size={13} aria-hidden />
      </button>
    </div>
  );
}
