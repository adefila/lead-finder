import type { Lead } from '@/types/lead';
import { getLeads, countFirstSentSince, lastFirstSentAt, lastSentAt, updateLead } from '@/lib/supabase';
import { followUpState } from '@/lib/followup';
import { draftFollowUp } from '@/lib/claude';
import { splitDraft, toHtml, withCheckLink, withSignature } from '@/lib/compose';
import { hasCheck } from '@/lib/leadview';
import { noteLink } from '@/lib/tracking';
import { checkReplies, mailConfig, sendMail } from '@/lib/mailer';
import { emailDomainAccepts } from '@/lib/verify';

// Limits count first emails only. Follow-ups to people already contacted go out on top.
export const DAILY_LIMIT = Number(process.env.MAIL_DAILY_LIMIT ?? 20);
export const WEEKLY_LIMIT = Number(process.env.MAIL_WEEKLY_LIMIT ?? 100);
// At most one email (first or follow-up) every MIN_GAP minutes. The timer runs every 15 minutes,
// so 10 means one per run: about 28 emails in a 7-hour business day, spaced like a person typing.
const MIN_GAP_MIN = Number(process.env.MAIL_MIN_GAP_MINUTES ?? 10);
// New emails are spread across the whole day instead of going out in one burst: with a limit of
// 20, one new email about every 72 minutes, so each time zone's business hours get some.
const FIRST_GAP_MIN = Math.max(MIN_GAP_MIN, Math.floor((24 * 60) / Math.max(1, DAILY_LIMIT)));
// A first email that keeps failing is retried this many times, then handed back to you.
const MAX_TRIES = 3;
// MAIL_TEST_MODE=true: every run sends the next queued email to your own inbox, any day or hour,
// and leaves the lead untouched so the real send still happens later.
const TEST_MODE = process.env.MAIL_TEST_MODE === 'true';
const WINDOW_START = 9;
const WINDOW_END = 16;

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
  [/\bUK\b|London|Manchester|Leeds|Birmingham|United Kingdom/i, 'Europe/London'],
  [/Perth|Western Australia/i, 'Australia/Perth'],
  [/Adelaide|South Australia/i, 'Australia/Adelaide'],
  [/Brisbane|Gold Coast|Queensland/i, 'Australia/Brisbane'],
  [/Sydney|Melbourne|Canberra|Australia/i, 'Australia/Sydney'],
  [/Singapore/i, 'Asia/Singapore'],
  [/Auckland|New Zealand/i, 'Pacific/Auckland'],
];

export function timezoneFor(lead: Lead): string {
  const text = `${lead.company} ${lead.description.slice(0, 200)}`;
  return TZ_HINTS.find(([re]) => re.test(text))?.[1] ?? 'America/New_York';
}

export function inSendWindow(lead: Lead, now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezoneFor(lead), weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0) % 24;
  return !['Sat', 'Sun'].includes(weekday) && hour >= WINDOW_START && hour < WINDOW_END;
}

function last24h(now = new Date()): string {
  return new Date(now.getTime() - 24 * 3600_000).toISOString();
}

function last7d(now = new Date()): string {
  return new Date(now.getTime() - 7 * 24 * 3600_000).toISOString();
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

export async function outboxStatus(): Promise<Pick<OutboxResult, 'configured' | 'sentToday' | 'limit' | 'sentWeek' | 'weekLimit' | 'queued'> & { lastSent: string | null }> {
  const [sentToday, sentWeek, leads, last] = await Promise.all([countFirstSentSince(last24h()), countFirstSentSince(last7d()), getLeads(), lastSentAt()]);
  return {
    configured: !!mailConfig(),
    sentToday,
    limit: DAILY_LIMIT,
    sentWeek,
    weekLimit: WEEKLY_LIMIT,
    queued: leads.filter(l => l.status === 'queued').length,
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
    sentToday: await countFirstSentSince(last24h()),
    limit: DAILY_LIMIT,
    sentWeek: await countFirstSentSince(last7d()),
    weekLimit: WEEKLY_LIMIT,
    queued: queued.length,
    replies: 0,
    optOuts: 0,
    bounced: 0,
  };
  if (!cfg) return { ...result, skipped: 'Mail is not configured' };

  // 1. Replies stop everything for that lead.
  // The timer gives up after 30s, so the inbox check gets 12s at most. If Gmail is slow we skip
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
    new Promise<typeof noInbox>(resolve => setTimeout(() => { console.error('[outbox] inbox check slow, skipped this run'); resolve(noInbox); }, 12_000)),
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

  // 2. Limits on first emails: rolling 24 hours and rolling 7 days, so neither can be doubled
  // around a reset. Follow-ups are not limited here.
  const capReason = result.sentToday >= DAILY_LIMIT ? `Limit of ${DAILY_LIMIT} new emails in 24 hours reached`
    : result.sentWeek >= WEEKLY_LIMIT ? `Limit of ${WEEKLY_LIMIT} new emails in 7 days reached`
    : null;

  if (TEST_MODE) {
    if (capReason) return { ...result, skipped: capReason };
    const next = [...queued].sort((a, b) => (a.queuedAt ?? '').localeCompare(b.queuedAt ?? ''))[0];
    if (!next) return { ...result, skipped: 'Test mode: queue at least one lead first' };
    const { subject, body } = splitDraft(next.proposal ?? '');
    const testText = withSignature(hasCheck(next) ? withCheckLink(body, noteLink(next)) : body);
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

  // Space emails out: at most one every MIN_GAP_MIN minutes.
  const last = await lastSentAt();
  if (last && Date.now() - last.getTime() < MIN_GAP_MIN * 60_000) {
    const next = new Date(last.getTime() + MIN_GAP_MIN * 60_000);
    return { ...result, skipped: `Next email can go out after ${next.toISOString().slice(11, 16)} UTC (one every ${MIN_GAP_MIN} minutes)` };
  }

  // 3. Follow-ups first (they keep a conversation going), then new sends. Only inside the lead's business hours.
  const followUp = inboxChecked && leads.find(l =>
    l.status === 'approved' && l.autoSequence && l.contactEmail && !l.optedOut && followUpState(l).due && inSendWindow(l));
  const lastFirst = capReason ? null : await lastFirstSentAt();
  const firstWait = lastFirst ? lastFirst.getTime() + FIRST_GAP_MIN * 60_000 - Date.now() : 0;
  const first = capReason || firstWait > 0 ? undefined : queued
    .filter(l => inSendWindow(l))
    .sort((a, b) =>
      Number(!!a.sendError) - Number(!!b.sendError)          // failing ones last
      || (b.score ?? 0) - (a.score ?? 0)                     // best fit first
      || (a.queuedAt ?? '').localeCompare(b.queuedAt ?? '')) // then oldest first
    [0];
  const lead = followUp || first;
  if (!lead) {
    const why = capReason ? `${capReason}, no follow-ups due`
      : firstWait > 0 ? `Next new email after ${new Date(Date.now() + firstWait).toISOString().slice(11, 16)} UTC (one every ${FIRST_GAP_MIN} minutes, spread over the day)`
      : 'Nothing due inside business hours right now';
    return { ...result, skipped: why };
  }

  try {
    if (lead === followUp) {
      const text = await draftFollowUp(lead);
      if (!text) throw new Error('Could not draft the follow-up');
      const subject = lead.sendSubject ? (lead.sendSubject.startsWith('Re:') ? lead.sendSubject : `Re: ${lead.sendSubject}`) : `Re: ${lead.title}`;
      const messageId = await sendMail(cfg, { to: lead.contactEmail!, subject, text: withSignature(text), html: toHtml(withSignature(text)), inReplyTo: lead.lastMessageId });
      const now = new Date().toISOString();
      await updateLead(lead.id, {
        follow_ups: (lead.followUps ?? 0) + 1,
        contacted_at: now,
        last_sent_at: now,
        last_message_id: messageId,
        send_error: null,
      });
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
      const text = withSignature(hasCheck(lead) ? withCheckLink(body, noteLink(lead)) : body);
      const messageId = await sendMail(cfg, { to: lead.contactEmail!, subject: finalSubject, text, html: toHtml(text) });
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
      result.sent = { id: lead.id, title: lead.title, kind: 'first' };
      result.sentToday++;
      result.sentWeek++;
    }
  } catch (e) {
    // A failing email must never block the rest of the queue.
    const message = (e as Error).message.slice(0, 240);
    if (lead === followUp) {
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
        await updateLead(lead.id, { queued_at: new Date().toISOString(), send_error: `${message} (try ${tries})` });
      }
    }
    console.error(`[outbox] send failed for ${lead.title}: ${message}`);
    result.error = message;
  }

  return result;
}
