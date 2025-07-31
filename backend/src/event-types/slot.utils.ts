import { addMinutes, eachDayOfInterval, eachMinuteOfInterval } from 'date-fns';

export interface SlotOptions {
  from: Date;
  to: Date;
  duration: number; // minutes
  timezone: string;
  rules: { dayOfWeek: number; startMinute: number; endMinute: number }[];
  overrides: { date: Date; startMinute?: number; endMinute?: number; isBusy?: boolean }[];
  busy: { start: Date; end: Date }[];
  bufferBefore?: number; // minutes
  bufferAfter?: number; // minutes
  slotInterval?: number; // minutes (optional, defaults to duration)
}

export function generateSlots(opts: SlotOptions): string[] {
  const days = eachDayOfInterval({ start: opts.from, end: opts.to });
  let slots: Date[] = [];

  const step = opts.slotInterval || opts.duration;

  for (const day of days) {
    const dow = day.getUTCDay();
    const ruleSlots = opts.rules.filter(r => r.dayOfWeek === dow);
    for (const rule of ruleSlots) {
      const dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, rule.startMinute));
      const dayEnd = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, rule.endMinute));
      const chunked = eachMinuteOfInterval({ start: dayStart, end: dayEnd }, { step });
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

  // SUPER ROBUST BUFFER LOGIC
  const bufferBefore = opts.bufferBefore || 0;
  const bufferAfter = opts.bufferAfter || 0;
  
  // Only log buffer analysis if there are busy periods and buffers are configured
  if (opts.busy.length > 0 && (bufferBefore > 0 || bufferAfter > 0)) {
    console.log('[BUFFER-DEBUG] Processing', opts.busy.length, 'busy periods with buffers:', {
      bufferBefore: `${bufferBefore}min`,
      bufferAfter: `${bufferAfter}min`
    });
  }
  
  const originalSlotsCount = slots.length;
  let blockedSlotsCount = 0;
  
  slots = slots.filter(s => {
    let isBlocked = false;
    
    for (const b of opts.busy) {
      const busyStart = addMinutes(b.start, -bufferBefore);
      const busyEnd = addMinutes(b.end, bufferAfter);
      
      if (s >= busyStart && s <= busyEnd) {
        isBlocked = true;
        break;
      }
    }
    
    if (isBlocked) {
      blockedSlotsCount++;
    }
    
    return !isBlocked;
  });
  
  // Only log results if slots were actually blocked
  if (blockedSlotsCount > 0) {
    console.log('[BUFFER-DEBUG] Buffer filtering:', {
      available: slots.length,
      blocked: blockedSlotsCount,
      total: originalSlotsCount
    });
  }

  // dedupe and format
  const iso = Array.from(new Set(slots.map(d => d.toISOString())));
  iso.sort();
  return iso;
}
