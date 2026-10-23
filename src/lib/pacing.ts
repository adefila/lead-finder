// How new (first) emails are paced across the day. Pure functions with no database access, so the rules can be tested.
//
// The aim: DAILY_LIMIT new emails on every working day of YOUR calendar (Monday to Friday, in MAIL_TIMEZONE), whatever time
// zones the queued leads are in. A lead can only be emailed during its own 9am to 4pm on a weekday, so the day's emails are
// spread over every timer tick in which at least one queued lead is inside its business hours. The pace is worked out again
// on every tick from what is left to send and how many send slots are left today, so a slow or interrupted stretch (a Gmail
// pause, a follow-up that took a tick, a timer that missed a run) is caught up automatically instead of being lost.

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', hour: 'numeric', hour12: false });
    formatters.set(zone, f);
  }
  return f;
}

function weekdayAndHour(zone: string, at: Date): { weekday: string; hour: number } {
  const parts = formatter(zone).formatToParts(at);
  return {
    weekday: parts.find(p => p.type === 'weekday')?.value ?? '',
    hour: Number(parts.find(p => p.type === 'hour')?.value ?? 0) % 24,
  };
}

// Is it a weekday between startH and endH in this time zone?
export function zoneOpen(zone: string, at: Date, startH = 9, endH = 16): boolean {
  const { weekday, hour } = weekdayAndHour(zone, at);
  return weekday !== 'Sat' && weekday !== 'Sun' && hour >= startH && hour < endH;
}

// The calendar day in the owner's time zone that contains `now`.
export function homeDay(now: Date, tz: string): { start: Date; end: Date; weekday: string } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(now).map(p => [p.type, p.value]));
  const localAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = localAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  const start = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day) - offset);
  return { start, end: new Date(start.getTime() + 86_400_000), weekday: weekdayAndHour(tz, now).weekday };
}

export interface PacingInput {
  now: Date;
  zones: string[];                 // the time zones of the leads waiting in the queue
  sentToday: number;               // new emails already sent today (your calendar day)
  limit: number;                   // new emails per working day
  lastFirstSentAt: Date | null;    // when the last new email went out today
  homeTz: string;
  tickMin: number;                 // minutes between timer runs
  minGapMin: number;               // never closer than this
  slowed: boolean;                 // Gmail asked us to slow down: half the pace
  startHour?: number;
  endHour?: number;
}

export interface PacingPlan {
  send: boolean;
  reason: string;
  slotsLeft: number;               // timer ticks left today in which someone in the queue can be emailed
  spacingMin: number;
  behind: boolean;                 // the day is at risk: every remaining slot is needed, so new emails go before follow-ups
}

export function planNewSend(i: PacingInput): PacingPlan {
  const day = homeDay(i.now, i.homeTz);
  const none = (reason: string, slotsLeft = 0, spacingMin = 0, behind = false): PacingPlan => ({ send: false, reason, slotsLeft, spacingMin, behind });
  if (day.weekday === 'Sat' || day.weekday === 'Sun') return none('Weekend on your calendar: no new emails today. Follow-ups still go out');
  const remaining = i.limit - i.sentToday;
  if (remaining <= 0) return none(`Today's ${i.limit} new emails are done. The count restarts at midnight`);

  const tick = i.tickMin * 60_000;
  const first = Math.floor(i.now.getTime() / tick) * tick;
  let slotsLeft = 0;
  let openNow = false;
  for (let t = first; t < day.end.getTime(); t += tick) {
    const at = t === first ? i.now : new Date(t);
    if (i.zones.some(z => zoneOpen(z, at, i.startHour, i.endHour))) {
      slotsLeft++;
      if (t === first) openNow = true;
    }
  }
  if (!openNow) return none('Nothing due inside business hours right now', slotsLeft);

  // One new email every (slots left / emails left) ticks: an even spread, tightening to one per tick when behind.
  const ticksBetween = Math.max(1, Math.floor(slotsLeft / remaining)) * (i.slowed ? 2 : 1);
  const spacingMin = Math.max(i.minGapMin, ticksBetween * i.tickMin);
  const behind = remaining >= slotsLeft;
  const drift = 90_000; // a timer run can arrive a minute or so early
  const due = i.lastFirstSentAt ? i.lastFirstSentAt.getTime() + spacingMin * 60_000 - drift : 0;
  if (i.now.getTime() < due) {
    return none(`Next new email after ${new Date(due + drift).toISOString().slice(11, 16)} UTC (${remaining} left today, spread over ${slotsLeft} send slots)`, slotsLeft, spacingMin, behind);
  }
  return { send: true, reason: 'due', slotsLeft, spacingMin, behind };
}
