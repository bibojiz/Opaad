import type { AppState, Executive, Item } from './model';
import { addDays, dueLabel, formatLongDay, isOverdue, parseLocal, todayKey } from './dates';

export function doneOn(items: Item[], date: string): Item[] {
  return items.filter((i) => i.done && i.doneAt && todayKey(new Date(i.doneAt)) === date);
}

/** A plain-text end-of-day report the assistant can edit and share. Works without AI. */
export function buildReport(s: AppState, exec: Executive, now: Date = new Date()): string {
  const date = todayKey(now);
  const mine = s.items.filter((i) => i.execId === exec.id);
  const done = doneOn(mine, date).filter((i) => i.type !== 'note');
  const open = mine.filter((i) => !i.done && i.type === 'todo' && (!i.due || parseLocal(i.due)!.getTime() < addDays(now, 1).setHours(0, 0, 0, 0)));
  const tomorrowKey = todayKey(addDays(now, 1));
  const tomorrow = mine.filter((i) => !i.done && i.type !== 'note' && i.due.startsWith(tomorrowKey));
  const toRaise = mine.filter((i) => i.type === 'note' && i.raiseWithExec && !i.done);
  const short = exec.traits.includes('Short messages');

  const lines: string[] = [];
  lines.push(`Good evening ${exec.addressAs},`);
  lines.push('');
  lines.push(short ? `Today's update, ${formatLongDay(now)}:` : `Here is today's update for ${formatLongDay(now)}.`);
  lines.push('');
  lines.push('Done');
  if (done.length) {
    done.forEach((i) => {
      const ev = i.evidence.length ? ` (${i.evidence.length} attached)` : '';
      lines.push(`• ${i.title}${ev}`);
    });
  } else lines.push('• Nothing marked done yet.');
  if (open.length) {
    lines.push('');
    lines.push('Still open');
    open.forEach((i) => lines.push(`• ${i.title}${i.due ? (isOverdue(i.due, now) ? ` (overdue since ${dueLabel(i.due, now)})` : ` (due ${dueLabel(i.due, now)})`) : ''}`));
  }
  if (tomorrow.length) {
    lines.push('');
    lines.push('Tomorrow');
    tomorrow.forEach((i) => lines.push(`• ${i.title} (${dueLabel(i.due, now)})`));
  }
  if (toRaise.length) {
    lines.push('');
    lines.push('For your attention');
    toRaise.forEach((i) => lines.push(`• ${i.title}`));
  }
  lines.push('');
  lines.push('Best regards,');
  lines.push(s.profile.name || 'Your assistant');
  return lines.join('\n');
}

export function briefFor(s: AppState, exec: Executive, now: Date = new Date()): string[] {
  const mine = s.items.filter((i) => i.execId === exec.id && !i.done);
  const overdue = mine.filter((i) => i.type !== 'note' && i.due && isOverdue(i.due, now));
  const todayItems = mine.filter((i) => i.type !== 'note' && i.due && i.due.startsWith(todayKey(now)) && !isOverdue(i.due, now));
  const nextReminder = mine
    .filter((i) => i.type === 'reminder' && i.due && !isOverdue(i.due, now))
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  const toRaise = mine.filter((i) => i.type === 'note' && i.raiseWithExec);
  const plan = s.plan.filter((b) => b.execId === exec.id && b.date === todayKey(now));
  const out: string[] = [];
  if (overdue.length) out.push(`${overdue.length} overdue: ${overdue[0]!.title}${overdue.length > 1 ? ` and ${overdue.length - 1} more` : ''}.`);
  if (todayItems.length) out.push(`${todayItems.length} due today. First: ${todayItems.sort((a, b) => a.due.localeCompare(b.due))[0]!.title} at ${dueLabel(todayItems[0]!.due, now).replace('Today ', '')}.`);
  if (nextReminder) out.push(`Next reminder: ${nextReminder.title}, ${dueLabel(nextReminder.due, now)}.`);
  if (plan.length) out.push(`${plan.length} blocks in today's plan, starting ${plan[0]!.start}.`);
  if (toRaise.length) out.push(`${toRaise.length} thing${toRaise.length > 1 ? 's' : ''} to raise with ${exec.addressAs}.`);
  return out.slice(0, 4);
}
