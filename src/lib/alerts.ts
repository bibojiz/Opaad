import type { AppState, Executive } from './model';
import { FREE_AI_REQUESTS } from './model';
import { dueLabel, isOverdue, parseLocal, todayKey } from './dates';
import { IN_PREVIEW } from './env';

export type AlertKind = 'overdue' | 'due' | 'report' | 'learned' | 'plan';
export type AlertItem = { id: string; kind: AlertKind; title: string; body: string; href: string; at: number };

export function deriveAlerts(s: AppState, exec: Executive | undefined, now: Date = new Date()): AlertItem[] {
  if (!exec) return [];
  const out: AlertItem[] = [];
  const mine = s.items.filter((i) => i.execId === exec.id && !i.done && i.type !== 'note' && i.due);
  for (const i of mine) {
    const d = parseLocal(i.due);
    if (!d) continue;
    if (isOverdue(i.due, now)) {
      out.push({ id: `overdue:${i.id}`, kind: 'overdue', title: `Overdue: ${i.title}`, body: `Was due ${dueLabel(i.due, now)}.`, href: `/tasks/${i.id}`, at: d.getTime() });
    } else if (d.getTime() - now.getTime() <= 2 * 60 * 60 * 1000) {
      out.push({ id: `due:${i.id}`, kind: 'due', title: `${i.type === 'reminder' ? 'Reminder' : 'Due'} ${dueLabel(i.due, now)}: ${i.title}`, body: i.type === 'reminder' ? 'Coming up.' : 'Coming up in the next two hours.', href: `/tasks/${i.id}`, at: d.getTime() });
    }
  }
  const sent = s.reports.find((r) => r.execId === exec.id && r.date === todayKey(now) && r.sentAt);
  if (now.getHours() >= 16 && !sent) {
    out.push({ id: `report:${todayKey(now)}`, kind: 'report', title: "Tonight's report is ready to check", body: `Review it, attach any proof, then send it to ${exec.addressAs}.`, href: '/report', at: new Date(now).setHours(16, 0, 0, 0) });
  }
  exec.learned.slice(-3).forEach((l) => {
    out.push({ id: `learned:${l.id}`, kind: 'learned', title: `Opaad will remember: ${l.text}`, body: 'Remove it from the Executive page if it is wrong.', href: '/executive', at: new Date(l.createdAt).getTime() });
  });
  if (!IN_PREVIEW && s.usage.plan === 'free' && !s.settings.ownKey && s.usage.aiRequests > 0) {
    const left = Math.max(0, FREE_AI_REQUESTS - s.usage.aiRequests);
    out.push({ id: `plan:${s.usage.aiRequests}`, kind: 'plan', title: `${left} of ${FREE_AI_REQUESTS} free AI requests left`, body: 'Tasks, notes, reminders and reports stay free.', href: '/settings', at: now.getTime() - 1 });
  }
  return out.sort((a, b) => b.at - a.at);
}
