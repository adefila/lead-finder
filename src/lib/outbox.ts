import type { Lead } from '@/types/lead';
import { getLeads, countSentSince, updateLead } from '@/lib/supabase';
import { followUpState } from '@/lib/followup';
import { draftFollowUp } from '@/lib/claude';
import { splitDraft } from '@/lib/compose';
import { checkReplies, mailConfig, sendMail } from '@/lib/mailer';

export const DAILY_LIMIT = Number(process.env.MAIL_DAILY_LIMIT ?? 15);
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
  [/Sydney|Melbourne|Australia/i, 'Australia/Sydney'],
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

function startOfUtcDay(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export interface OutboxResult {
  configured: boolean;
  sentToday: number;
  limit: number;
  queued: number;
  replies: number;
  optOuts: number;
  sent?: { id: string; title: string; kind: 'first' | 'follow-up' };
  skipped?: string;
  error?: string;
}

export async function outboxStatus(): Promise<Pick<OutboxResult, 'configured' | 'sentToday' | 'limit' | 'queued'>> {
  const [sentToday, leads] = await Promise.all([countSentSince(startOfUtcDay()), getLeads()]);
  return {
    configured: !!mailConfig(),
    sentToday,
    limit: DAILY_LIMIT,
    queued: leads.filter(l => l.status === 'queued').length,
  };
}

// One run = check replies, then send at most one email. Called every ~15 minutes.
export async function runOutbox(): Promise<OutboxResult> {
  const cfg = mailConfig();
  const leads = await getLeads();
  const queued = leads.filter(l => l.status === 'queued' && l.contactEmail && !l.optedOut);
  const result: OutboxResult = {
    configured: !!cfg,
    sentToday: await countSentSince(startOfUtcDay()),
    limit: DAILY_LIMIT,
    queued: queued.length,
    replies: 0,
    optOuts: 0,
  };
  if (!cfg) return { ...result, skipped: 'Mail is not configured' };

  // 1. Replies stop everything for that lead.
  const watching = leads.filter(l => l.contactEmail && l.status === 'approved' && l.autoSequence && !l.optedOut);
  const replies = await checkReplies(cfg, watching.map(l => ({
    email: l.contactEmail!,
    since: new Date(l.queuedAt ?? l.contactedAt ?? l.createdAt ?? Date.now()),
  })));
  for (const lead of watching) {
    const hit = replies.get(lead.contactEmail!.toLowerCase());
    if (!hit) continue;
    await updateLead(lead.id, { status: hit.optedOut ? 'lost' : 'replied', opted_out: hit.optedOut });
    lead.status = hit.optedOut ? 'lost' : 'replied';
    result.replies++;
    if (hit.optedOut) result.optOuts++;
  }

  // 2. Daily cap.
  if (result.sentToday >= DAILY_LIMIT) return { ...result, skipped: `Daily limit of ${DAILY_LIMIT} reached` };

  // 3. Follow-ups first (they keep a conversation going), then new sends. Only inside the lead's business hours.
  const followUp = leads.find(l =>
    l.status === 'approved' && l.autoSequence && l.contactEmail && !l.optedOut && followUpState(l).due && inSendWindow(l));
  const first = queued
    .filter(l => inSendWindow(l))
    .sort((a, b) => (a.queuedAt ?? '').localeCompare(b.queuedAt ?? ''))[0];
  const lead = followUp ?? first;
  if (!lead) return { ...result, skipped: 'Nothing due inside business hours right now' };

  try {
    if (lead === followUp) {
      const text = await draftFollowUp(lead);
      if (!text) throw new Error('Could not draft the follow-up');
      const subject = lead.sendSubject ? (lead.sendSubject.startsWith('Re:') ? lead.sendSubject : `Re: ${lead.sendSubject}`) : `Re: ${lead.title}`;
      const messageId = await sendMail(cfg, { to: lead.contactEmail!, subject, text, inReplyTo: lead.lastMessageId });
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
      const finalSubject = subject || `${lead.title} website`;
      const messageId = await sendMail(cfg, { to: lead.contactEmail!, subject: finalSubject, text: body });
      const now = new Date().toISOString();
      await updateLead(lead.id, {
        status: 'approved',
        contacted_at: now,
        last_sent_at: now,
        follow_ups: 0,
        send_subject: finalSubject,
        last_message_id: messageId,
        send_error: null,
      });
      result.sent = { id: lead.id, title: lead.title, kind: 'first' };
    }
    result.sentToday++;
  } catch (e) {
    const message = (e as Error).message.slice(0, 300);
    await updateLead(lead.id, { send_error: message });
    result.error = message;
  }

  return result;
}
