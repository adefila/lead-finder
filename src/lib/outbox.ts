import type { Lead } from '@/types/lead';
import { getLeads, countFirstSentSince, countFollowUpsSince, lastSentAt, updateLead, logSend, claimOutboxRun, sendsSince } from '@/lib/supabase';
import { followUpState } from '@/lib/followup';
import { draftFollowUp } from '@/lib/claude';
import { splitDraft, toHtml, withCheckLink, withSignature } from '@/lib/compose';
import { hasCheck, isBusinessPitch, isJobLead, leadLanguage } from '@/lib/leadview';
import { noteCopy } from '@/lib/notecopy';
import { noteLink, siteLink } from '@/lib/tracking';
import { checkReplies, mailConfig, sendMail, sentFolderSince } from '@/lib/mailer';
import { emailDomainAccepts } from '@/lib/verify';

// Limits count first emails only. Follow-ups to people already contacted go out on top.
export const DAILY_LIMIT = Number(process.env.MAIL_DAILY_LIMIT ?? 20);
export const WEEKLY_LIMIT = Number(process.env.MAIL_WEEKLY_LIMIT ?? 100);
// At most one email (first or follow-up) every MIN_GAP minutes. The timer runs every 15 minutes,
// so 10 means one per run: about 28 emails in a 7-hour business day, spaced like a person typing.
const MIN_GAP_MIN = Number(process.env.MAIL_MIN_GAP_MINUTES ?? 10);
const WINDOW_START_H = 9;
const WINDOW_END_H = 16;
// The timer wakes the outbox every 15 minutes (MAIL_TIMER_MINUTES) and each run sends at most one email.
const TIMER_MIN = Number(process.env.MAIL_TIMER_MINUTES ?? 15);
// A first email that keeps failing is retried this many times, then handed back to you.
const MAX_TRIES = 3;
// MAIL_TEST_MODE=true: every run sends the next queued email to your own inbox, any day or hour,
// and leaves the lead untouched so the real send still happens later.
const TEST_MODE = process.env.MAIL_TEST_MODE === 'true';
// MAIL_PAUSED=true: no new emails and no follow-ups go out. Replies are still checked, lead
// searches keep running, and scheduled leads wait in the queue until it is switched off.
const PAUSED = process.env.MAIL_PAUSED === 'true';
const WINDOW_START = WINDOW_START_H;
const WINDOW_END = WINDOW_END_H;

// City hints from Google Places ("Dentist · Austin, TX") to the lead's timezone.
const TZ_HINTS: [RegExp, string][] = [
  [/, (TX|TN|IL|MN|MO|WI|LA|OK|KS|AL|MS|IA|NE)\b/, 'America/Chicago'],
  [/, (CO|UT|AZ|NM|MT|ID|WY)\b/, 'America/Denver'],
  [/, (CA|WA|OR|NV)\b/, 'America/Los_Angeles'],
  [/, (FL|NY|MA|GA|NC|SC|VA|PA|NJ|OH|MI|MD|CT|DC)\b/, 'America/New_York'],
  [/Calgary|Edmonton|Alberta/i, 'America/Edmonton'],
  [/Vancouver|British Columbia/i, 'America/Vancouver'],
  [/Toronto|Ottawa|Montreal|Canada/i, 'America/Toronto'],
  [/Dublin|Ireland/i, 'Europe/Dublin'],
  [/Germany|Berlin|Munich|Hamburg/i, 'Europe/Berlin'],
  [/Netherlands|Amsterdam|Luxembourg|Belgium|Brussels|Denmark|Sweden|Austria|Switzerland|Spain|Poland|Czechia|Malta/i, 'Europe/Amsterdam'],
  [/Portugal|Lisbon/i, 'Europe/Lisbon'],
  [/Finland|Estonia|Cyprus/i, 'Europe/Helsinki'],
  [/\bUK\b|London|Manchester|Leeds|Birmingham|United Kingdom/i, 'Europe/London'],
  [/Perth|Western Australia/i, 'Australia/Perth'],
  [/Adelaide|South Australia/i, 'Australia/Adelaide'],
  [/Brisbane|Gold Coast|Queensland/i, 'Australia/Brisbane'],
  [/Sydney|Melbourne|Canberra|Australia/i, 'Australia/Sydney'],
  [/Singapore/i, 'Asia/Singapore'],
  [/Netherlands|Amsterdam|Rotterdam|Utrecht|The Hague|Eindhoven/i, 'Europe/Amsterdam'],
  [/Norway|Oslo|Bergen|Trondheim|Stavanger/i, 'Europe/Oslo'],
  [/Luxembourg/i, 'Europe/Luxembourg'],
  [/Auckland|New Zealand/i, 'Pacific/Auckland'],
];

export function timezoneFor(lead: Lead): string {
  const text = `${lead.company} ${lead.description.slice(0, 200)}`;
  return TZ_HINTS.find(([re]) => re.test(text))?.[1] ?? 'America/New_York';
}

// ─── A fair share of the daily limit for each time zone ─────────────────────
// Each lead only gets email 9am to 4pm on weekdays in its own time zone, and those windows open at
// different times on your clock: Sydney around your midnight, Singapore at 2am, Europe at 8am, the
// US in your afternoon. With one shared count, the zones that open first used all 20 before Europe
// or the US started their day. So every time zone with emails waiting gets its own share of the
// limit, counted over the last 24 hours and spread evenly over its own window.
export function zoneShares(queued: Lead[], limit = DAILY_LIMIT): Map<string, number> {
  const waiting = new Map<string, number>();
  for (const l of queued) waiting.set(timezoneFor(l), (waiting.get(timezoneFor(l)) ?? 0) + 1);
  const zones = [...waiting.entries()].sort((a, b) => b[1] - a[1]);
  const shares = new Map(zones.map(([z]) => [z, 0]));
  let left = limit;
  // Every zone with someone waiting gets at least one a day (biggest queues first).
  for (const [z] of zones) { if (left <= 0) break; shares.set(z, 1); left--; }
  // The rest go one at a time to the zone with the most waiting per email it already has.
  while (left > 0) {
    const open = zones.filter(([z, n]) => shares.get(z)! < n);
    if (!open.length) break;
    const [z] = open.reduce((best, cur) => cur[1] / (shares.get(cur[0])! + 1) > best[1] / (shares.get(best[0])! + 1) ? cur : best);
    shares.set(z, shares.get(z)! + 1);
    left--;
  }
  return shares;
}

// Minutes between new emails in one zone, so its share is spread over its 7-hour window. Rounded
// down to whole timer ticks, minus a minute for timer drift (a share of 20 gives 14 minutes).
export function zoneGap(share: number): number {
  const raw = ((WINDOW_END_H - WINDOW_START_H) * 60) / Math.max(1, share);
  return Math.max(MIN_GAP_MIN, Math.max(1, Math.floor(raw / TIMER_MIN)) * TIMER_MIN - 1);
}

const zoneName = (zone: string) => zone.split('/').pop()!.replace(/_/g, ' ');

export function inSendWindow(lead: Lead, now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezoneFor(lead), weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0) % 24;
  return !['Sat', 'Sun'].includes(weekday) && hour >= WINDOW_START && hour < WINDOW_END;
}

// Gmail's "try again later" answers (4xx, e.g. 421 or 451 4.3.0): it wants us to slow down.
// Such failures are saved as "Temporary (<time>): ..." on the lead, which is all the state the
// back-off needs: after one, nothing is sent for an hour, and new emails go out half as often
// for a day.
const BACKOFF_PAUSE_MIN = 60;
const BACKOFF_SLOW_HOURS = 24;
const isTemporary = (message: string) => /^\s*4\d\d\b|\b4\d\d[ -]4\.\d\.\d|\b4\.\d\.\d\b/.test(message);
const TEMP_MARK = /^Temporary \((\S+)\)/;

export function lastTemporaryFailure(leads: Lead[]): Date | null {
  let latest = 0;
  for (const l of leads) {
    const at = Date.parse(l.sendError?.match(TEMP_MARK)?.[1] ?? '');
    if (!isNaN(at) && at > latest) latest = at;
  }
  return latest ? new Date(latest) : null;
}

export function backoffState(leads: Lead[], now = Date.now()): { pausedUntil: Date | null; slowed: boolean } {
  const last = lastTemporaryFailure(leads);
  if (!last) return { pausedUntil: null, slowed: false };
  const until = last.getTime() + BACKOFF_PAUSE_MIN * 60_000;
  return {
    pausedUntil: until > now ? new Date(until) : null,
    slowed: now - last.getTime() < BACKOFF_SLOW_HOURS * 3600_000,
  };
}

// "Today" is your calendar day, in MAIL_TIMEZONE (default Africa/Lagos): the daily count goes
// back to 0 at your midnight, so "x of 20 new today" means today on your clock.
const HOME_TZ = process.env.MAIL_TIMEZONE || 'Africa/Lagos';

export function startOfDay(now = new Date(), timeZone = HOME_TZ): Date {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(now).map(p => [p.type, p.value]));
  const localAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = localAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day) - offset);
}

function todayStart(now = new Date()): string {
  return startOfDay(now).toISOString();
}

// The daily limit is counted over the last 24 hours, so time zones on either side of your
// midnight (Australia) can't get a double share across two of your calendar days.
function dayAgo(now = Date.now()): string {
  return new Date(now - 86_400_000).toISOString();
}

// The weekly count resets at Sunday 00:00 UTC. Emails only go out Monday to Friday, 9am to 4pm
// in each lead's own time zone, and no country is in those hours at that moment: the last
// sends of the week (US west coast, Friday 4pm) end around Saturday 00:00 UTC, and the first
// (New Zealand, Monday 9am) start around Sunday 20:00 UTC. So every country's Monday to Friday
// falls inside the same week.
export function startOfWeek(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

function nextWeekStart(now = new Date()): Date {
  const d = startOfWeek(now);
  d.setUTCDate(d.getUTCDate() + 7);
  return d;
}

export interface OutboxResult {
  configured: boolean;
  sentToday: number;
  limit: number;
  sentWeek: number;
  weekLimit: number;
  queued: number;
  replies: number;
  optOuts: number;
  bounced: number;
  sent?: { id: string; title: string; kind: 'first' | 'follow-up' | 'test' };
  skipped?: string;
  error?: string;
}

export async function outboxStatus(): Promise<Pick<OutboxResult, 'configured' | 'sentToday' | 'limit' | 'sentWeek' | 'weekLimit' | 'queued'> & { followUpsToday: number; lastSent: string | null; pausedUntil: string | null; slowed: boolean; paused: boolean }> {
  const [sentToday, sentWeek, followUpsToday, leads, last] = await Promise.all([countFirstSentSince(dayAgo()), countFirstSentSince(startOfWeek().toISOString()), countFollowUpsSince(todayStart()), getLeads(), lastSentAt()]);
  return {
    followUpsToday,
    paused: PAUSED,
    configured: !!mailConfig(),
    sentToday,
    limit: DAILY_LIMIT,
    sentWeek,
    weekLimit: WEEKLY_LIMIT,
    queued: leads.filter(l => l.status === 'queued').length,
    pausedUntil: backoffState(leads).pausedUntil?.toISOString() ?? null,
    slowed: backoffState(leads).slowed,
    lastSent: last ? last.toISOString() : null,
  };
}

// One run = check replies, then send at most one email. Called every ~15 minutes.
export async function runOutbox(): Promise<OutboxResult> {
  const cfg = mailConfig();
  const leads = await getLeads();
  const queued = leads.filter(l => l.status === 'queued' && l.contactEmail && !l.optedOut);
  const result: OutboxResult = {
    configured: !!cfg,
    sentToday: await countFirstSentSince(dayAgo()),
    limit: DAILY_LIMIT,
    sentWeek: await countFirstSentSince(startOfWeek().toISOString()),
    weekLimit: WEEKLY_LIMIT,
    queued: queued.length,
    replies: 0,
    optOuts: 0,
    bounced: 0,
  };
  if (!cfg) return { ...result, skipped: 'Mail is not configured' };

  // 1. Replies stop everything for that lead.
  // The timer is answered straight away and the work runs after (see /api/outbox), so the inbox check can have
  // 25s of the 60s a run is allowed. If Gmail is slow we skip
  // it this time (the next run, 15 minutes later, checks again) and hold back follow-ups,
  // so nobody who already replied gets chased.
  const watching = leads.filter(l => l.contactEmail && l.status === 'approved' && l.autoSequence && !l.optedOut);
  const noInbox = { replies: new Map<string, { replied: boolean; optedOut: boolean }>(), bounced: new Set<string>(), checked: false };
  const inboxCheck = checkReplies(cfg, watching.map(l => ({
    email: l.contactEmail!,
    since: new Date(l.queuedAt ?? l.contactedAt ?? l.createdAt ?? Date.now()),
  }))).then(r => ({ ...r, checked: true })).catch(e => { console.error('[outbox] inbox check failed:', (e as Error).message); return noInbox; });
  const { replies, bounced, checked: inboxChecked } = await Promise.race([
    inboxCheck,
    new Promise<typeof noInbox>(resolve => setTimeout(() => { console.error('[outbox] inbox check slow, skipped this run'); resolve(noInbox); }, 25_000)),
  ]);
  for (const lead of watching) {
    const address = lead.contactEmail!.toLowerCase();
    if (bounced.has(address) && !replies.has(address)) {
      await updateLead(lead.id, { status: 'lost', opted_out: true, send_error: 'Email bounced: this address does not exist' });
      lead.status = 'lost';
      result.bounced++;
      continue;
    }
    const hit = replies.get(address);
    if (!hit) continue;
    await updateLead(lead.id, { status: hit.optedOut ? 'lost' : 'replied', opted_out: hit.optedOut });
    lead.status = hit.optedOut ? 'lost' : 'replied';
    result.replies++;
    if (hit.optedOut) result.optOuts++;
  }

  if (PAUSED) return { ...result, skipped: 'Sending is paused (MAIL_PAUSED). Replies are still checked' };

  // 2. Limits count new (first) emails only: the last 24 hours, and the week since Sunday
  // 00:00 UTC. Follow-ups are counted separately, never limited, and keep going out.
  const capReason = result.sentWeek >= WEEKLY_LIMIT
    ? `Weekly limit of ${WEEKLY_LIMIT} new emails reached. New emails resume when the week resets (${nextWeekStart().toISOString().slice(0, 10)} 00:00 UTC)`
    : result.sentToday >= DAILY_LIMIT ? `Limit of ${DAILY_LIMIT} new emails in 24 hours reached`
    : null;

  if (TEST_MODE) {
    if (capReason) return { ...result, skipped: capReason };
    const next = [...queued].sort((a, b) => (a.queuedAt ?? '').localeCompare(b.queuedAt ?? ''))[0];
    if (!next) return { ...result, skipped: 'Test mode: queue at least one lead first' };
    const { subject, body } = splitDraft(next.proposal ?? '');
    const testText = withSignature(hasCheck(next) ? withCheckLink(body, noteLink(next), leadLanguage(next)) : body, leadLanguage(next), isJobLead(next), isBusinessPitch(next));
    // Exactly the email the business would get (link and signature included), so you can see
    // how it lands. MAIL_TEST_TO sends it to another inbox, e.g. your personal Gmail.
    await sendMail(cfg, {
      to: process.env.MAIL_TEST_TO?.trim() || cfg.user,
      subject: `[Test] ${subject || `${next.title} website`}`,
      text: testText,
      html: toHtml(testText),
    });
    console.log(`[outbox] test email for ${next.title} (would go to ${next.contactEmail})`);
    return { ...result, sent: { id: next.id, title: next.title, kind: 'test' } };
  }

  // Gmail asked us to slow down recently: send nothing for an hour.
  const backoff = backoffState(leads);
  if (backoff.pausedUntil) {
    return { ...result, skipped: `Gmail asked to slow down, sending paused until ${backoff.pausedUntil.toISOString().slice(11, 16)} UTC` };
  }

  // Space emails out: at most one every MIN_GAP_MIN minutes.
  const last = await lastSentAt();
  if (last && Date.now() - last.getTime() < MIN_GAP_MIN * 60_000) {
    const next = new Date(last.getTime() + MIN_GAP_MIN * 60_000);
    return { ...result, skipped: `Next email can go out after ${next.toISOString().slice(11, 16)} UTC (one every ${MIN_GAP_MIN} minutes)` };
  }

  // Only one run may send at a time (the timer and "Send the next email now" can overlap).
  if (!(await claimOutboxRun())) return { ...result, skipped: 'Another send run started this minute' };

  // 3. Follow-ups first (they keep a conversation going), then new sends. Only inside the lead's business hours.
  const followUp = inboxChecked && leads.find(l =>
    l.status === 'approved' && l.autoSequence && l.contactEmail && !l.optedOut && followUpState(l).due && inSendWindow(l));
  // Each zone: how many new emails it had in the last 24 hours and when the latest went out.
  const zoneOf = new Map(leads.map(l => [l.id, timezoneFor(l)]));
  const recent = new Map<string, { count: number; last: number }>();
  if (!capReason) {
    for (const s of await sendsSince(dayAgo())) {
      const zone = s.kind === 'first' ? zoneOf.get(s.leadId) : undefined;
      if (!zone) continue;
      const r = recent.get(zone) ?? { count: 0, last: 0 };
      recent.set(zone, { count: r.count + 1, last: Math.max(r.last, Date.parse(s.at)) });
    }
  }
  const shares = zoneShares(queued);
  // When each zone may send its next new email (Infinity once its share is used).
  // For a day after Gmail pushed back, new emails go out half as often.
  const nextAt = (zone: string) => {
    const share = shares.get(zone) ?? 0;
    const r = recent.get(zone) ?? { count: 0, last: 0 };
    if (r.count >= share) return Infinity;
    return r.last + zoneGap(share) * (backoff.slowed ? 2 : 1) * 60_000;
  };
  const openNow = capReason ? [] : queued.filter(l => inSendWindow(l));
  const first = openNow
    .filter(l => nextAt(timezoneFor(l)) <= Date.now())
    .sort((a, b) =>
      Number(!!a.sendError) - Number(!!b.sendError)          // failing ones last
      || (b.score ?? 0) - (a.score ?? 0)                     // best fit first
      || (a.queuedAt ?? '').localeCompare(b.queuedAt ?? '')) // then oldest first
    [0];
  const lead = followUp || first;
  if (!lead) {
    const waits = [...new Set(openNow.map(l => timezoneFor(l)))].map(z => ({ z, at: nextAt(z) }));
    const soonest = waits.filter(w => w.at < Infinity).sort((a, b) => a.at - b.at)[0];
    const why = capReason ? `${capReason}, no follow-ups due`
      : soonest ? `Next new email for ${zoneName(soonest.z)} after ${new Date(soonest.at).toISOString().slice(11, 16)} UTC (${shares.get(soonest.z)} a day there, spread over their business hours${backoff.slowed ? ', slowed after Gmail pushed back' : ''})`
      : waits.length ? `Today's share for ${waits.map(w => zoneName(w.z)).join(', ')} is sent. The rest wait for other countries' business hours`
      : 'Nothing due inside business hours right now';
    return { ...result, skipped: why };
  }

  try {
    if (lead === followUp) {
      const text = await draftFollowUp(lead);
      if (!text) throw new Error('Could not draft the follow-up');
      const subject = lead.sendSubject ? (lead.sendSubject.startsWith('Re:') ? lead.sendSubject : `Re: ${lead.sendSubject}`) : `Re: ${lead.title}`;
      const messageId = await sendMail(cfg, { to: lead.contactEmail!, subject, text: withSignature(text, leadLanguage(lead), isJobLead(lead), isBusinessPitch(lead)), html: toHtml(withSignature(text, leadLanguage(lead), isJobLead(lead), isBusinessPitch(lead)), siteLink(lead)), inReplyTo: lead.lastMessageId });
      const now = new Date().toISOString();
      await updateLead(lead.id, {
        follow_ups: (lead.followUps ?? 0) + 1,
        contacted_at: now,
        last_sent_at: now,
        last_message_id: messageId,
        send_error: null,
      });
      await logSend('followup', lead.id, new Date(now));
      result.sent = { id: lead.id, title: lead.title, kind: 'follow-up' };
    } else {
      const { subject, body } = splitDraft(lead.proposal ?? '');
      if (!body) throw new Error('This lead has no draft to send');
      if (!(await emailDomainAccepts(lead.contactEmail!))) {
        // Dead domain: take it out of the queue instead of retrying forever.
        await updateLead(lead.id, { status: 'new', auto_sequence: false, queued_at: null, send_error: "This email address can't receive mail. Try phone or a DM instead." });
        return { ...result, skipped: `${lead.title}: email domain can't receive mail, moved back to To contact` };
      }
      const finalSubject = subject || `${lead.title} website`;
      const text = withSignature(hasCheck(lead) ? withCheckLink(body, noteLink(lead), leadLanguage(lead)) : body, leadLanguage(lead), isJobLead(lead), isBusinessPitch(lead));
      const messageId = await sendMail(cfg, { to: lead.contactEmail!, subject: finalSubject, text, html: toHtml(text, siteLink(lead)) });
      // Translate their one-page note now, so it is ready (and fast) when they open it.
      if (hasCheck(lead) && leadLanguage(lead) !== 'en') await noteCopy(lead).catch(() => undefined);
      const now = new Date().toISOString();
      const sentPatch = {
        status: 'approved',
        contacted_at: now,
        last_sent_at: now,
        follow_ups: 0,
        send_subject: finalSubject,
        last_message_id: messageId,
        send_error: null,
      };
      // If the first_sent_at column is missing, still mark the lead as sent so it is never emailed twice.
      if (await updateLead(lead.id, { ...sentPatch, first_sent_at: now })) await updateLead(lead.id, sentPatch);
      await logSend('first', lead.id, new Date(now));
      result.sent = { id: lead.id, title: lead.title, kind: 'first' };
      result.sentToday++;
      result.sentWeek++;
    }
  } catch (e) {
    // A failing email must never block the rest of the queue.
    const message = (e as Error).message.slice(0, 240);
    const temporary = isTemporary(message);
    const stamp = temporary ? `Temporary (${new Date().toISOString()}): ` : '';
    if (lead === followUp && temporary) {
      // Gmail said "later": keep it automatic, it goes out on a later run once the pause is over.
      await updateLead(lead.id, { send_error: `${stamp}${message}` });
    } else if (lead === followUp) {
      // Hand the follow-up to you: it appears under "Needs a follow-up" with the reason.
      await updateLead(lead.id, { auto_sequence: false, send_error: `Automatic follow-up failed: ${message}. Send it yourself from the lead page.` });
    } else {
      const tries = Number(lead.sendError?.match(/\(try (\d)\)/)?.[1] ?? 0) + 1;
      if (tries >= MAX_TRIES) {
        await updateLead(lead.id, {
          status: 'new', auto_sequence: false, queued_at: null,
          send_error: `Could not send after ${MAX_TRIES} tries: ${message}`,
        });
      } else {
        // Back of the queue, so the next scheduled email goes out instead.
        await updateLead(lead.id, { queued_at: new Date().toISOString(), send_error: `${stamp}${message} (try ${tries})` });
      }
    }
    console.error(`[outbox] send failed for ${lead.title}: ${message}`);
    result.error = message;
  }

  return result;
}

// ─── Audit: what the app counted today vs what is in the mailbox's Sent folder ─

export interface OutboxAudit {
  timeZone: string;
  dayStart: string;
  counted: { newEmails: number; followUps: number; limit: number };
  logged: { at: string; kind: 'first' | 'followup'; lead: string }[];
  sentFolder: { count: number; outreach: number; other: number; messages: { at: string; to: string; subject: string; outreach: boolean }[] } | { error: string };
}

export async function outboxAudit(): Promise<OutboxAudit> {
  const dayStart = startOfDay();
  const since = dayStart.toISOString();
  const [newEmails, followUps, log, leads] = await Promise.all([countFirstSentSince(since), countFollowUpsSince(since), sendsSince(since), getLeads()]);
  const titles = new Map(leads.map(l => [l.id, `${l.title}${l.contactEmail ? ` <${l.contactEmail}>` : ''}`]));
  const leadEmails = new Set(leads.map(l => l.contactEmail?.toLowerCase()).filter(Boolean) as string[]);
  const cfg = mailConfig();
  let sentFolder: OutboxAudit['sentFolder'] = { error: 'Mail is not configured' };
  if (cfg) {
    try {
      const messages = (await sentFolderSince(cfg, dayStart)).map(m => ({ ...m, outreach: leadEmails.has(m.to.toLowerCase()) }));
      const outreach = messages.filter(m => m.outreach).length;
      sentFolder = { count: messages.length, outreach, other: messages.length - outreach, messages };
    } catch (e) {
      sentFolder = { error: (e as Error).message };
    }
  }
  return {
    timeZone: HOME_TZ,
    dayStart: since,
    counted: { newEmails, followUps, limit: DAILY_LIMIT },
    logged: log.map(e => ({ at: e.at, kind: e.kind, lead: titles.get(e.leadId) ?? `${e.leadId} (deleted)` })),
    sentFolder,
  };
}
