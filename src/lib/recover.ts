import { getLeads, updateLead } from '@/lib/supabase';
import { bounceKinds, mailConfig } from '@/lib/mailer';

export interface RecoverResult {
  checked: number;        // leads marked as bounced
  restored: string[];     // names of the leads brought back
  dead: number;           // genuinely dead addresses, left as lost
  unverified: number;     // no bounce message found in the last 45 days, left as lost
}

// Early versions marked a lead "lost" for any bounce, including failures that were never about the lead
// (for example, mail sent while the domain's DNS was down). This reads each bounce message again and brings
// back only the leads whose bounce was NOT a dead address. They return to "To contact", un-opted-out, so
// nothing is sent until you schedule it again.
export async function recoverWronglyBounced(): Promise<RecoverResult> {
  const cfg = mailConfig();
  if (!cfg) throw new Error('Mail is not set up');
  const leads = await getLeads();
  const candidates = leads.filter(l => l.status === 'lost' && l.contactEmail && /^Email bounced/i.test(l.sendError ?? ''));
  const result: RecoverResult = { checked: candidates.length, restored: [], dead: 0, unverified: 0 };
  if (!candidates.length) return result;

  const since = new Date(Date.now() - 45 * 86_400_000);
  const kinds = await bounceKinds(cfg, candidates.map(l => l.contactEmail!), since);
  for (const lead of candidates) {
    const kind = kinds.get(lead.contactEmail!.toLowerCase());
    if (kind === 'dead') { result.dead++; continue; }
    if (kind !== 'other') { result.unverified++; continue; }
    const error = await updateLead(lead.id, {
      status: 'new', opted_out: false, send_error: null,
      contacted_at: null, follow_ups: 0, queued_at: null, auto_sequence: false,
    });
    if (!error) result.restored.push(lead.title);
  }
  return result;
}
