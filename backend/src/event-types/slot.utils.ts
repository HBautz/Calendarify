import { addMinutes, eachDayOfInterval, eachMinuteOfInterval } from 'date-fns';

export interface SlotOptions {
  from: Date;
  to: Date;
  duration: number; // minutes
  timezone: string;
  rules: { dayOfWeek: number; startMinute: number; endMinute: number }[];
  overrides: { date: Date; startMinute?: number; endMinute?: number; isBusy?: boolean }[];
  busy: { start: Date; end: Date }[];
}

export function generateSlots(opts: SlotOptions): string[] {
  const days = eachDayOfInterval({ start: opts.from, end: opts.to });
  let slots: Date[] = [];

  for (const day of days) {
    const dow = day.getUTCDay();
    const ruleSlots = opts.rules.filter(r => r.dayOfWeek === dow);
    for (const rule of ruleSlots) {
      const dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, rule.startMinute));
      const dayEnd = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, rule.endMinute));
      const chunked = eachMinuteOfInterval({ start: dayStart, end: dayEnd }, { step: opts.duration });
      slots = slots.concat(chunked);
    }
  }

  // apply overrides
  for (const o of opts.overrides) {
    const date = o.date.toISOString().split('T')[0];
    slots = slots.filter(s => {
      const sDate = s.toISOString().split('T')[0];
      if (sDate !== date) return true;
      if (o.isBusy) return false;
      const minute = s.getUTCHours() * 60 + s.getUTCMinutes();
      if (o.startMinute != null && minute < o.startMinute) return false;
      if (o.endMinute != null && minute >= o.endMinute) return false;
      return true;
    });
  }

  // subtract busy ranges
  slots = slots.filter(s => {
    return !opts.busy.some(b => s >= addMinutes(b.start, -5) && s <= addMinutes(b.end, 5));
  });

  // dedupe and format
  const iso = Array.from(new Set(slots.map(d => d.toISOString())));
  iso.sort();
  return iso;
}
