import { headers } from 'next/headers';
import type { Lead } from '@/types/lead';
import { updateLead } from '@/lib/supabase';

// Email security tools (Outlook Safe Links, Proofpoint, Mimecast and the like) open every link
// as soon as an email arrives. Those are not people, so they must not count as "opened".
const SCANNER = /bot|crawl|spider|preview|scan|safelinks|proofpoint|mimecast|barracuda|forcepoint|symantec|trendmicro|sophos|curl|wget|python|go-http|java\/|headless|phantom/i;
const SCANNER_WINDOW_MS = 3 * 60_000;

// Records a real person opening a lead's one-page note. Never throws: the page must still show
// even if the database is missing the note columns.
export async function recordNoteView(lead: Lead, isPreview: boolean): Promise<void> {
  try {
    if (isPreview) return;
    const ua = (await headers()).get('user-agent') ?? '';
    if (!ua || SCANNER.test(ua)) return;
    if (lead.lastSentAt && Date.now() - new Date(lead.lastSentAt).getTime() < SCANNER_WINDOW_MS) return;

    const now = new Date().toISOString();
    const error = await updateLead(lead.id, {
      note_opened_at: lead.noteOpenedAt ?? now,
      note_last_viewed_at: now,
      note_views: (lead.noteViews ?? 0) + 1,
    });
    if (error) console.error('[check] could not record the view:', error);
    else console.log(`[check] ${lead.title} opened their note (view ${(lead.noteViews ?? 0) + 1})`);
  } catch (e) {
    console.error('[check] view tracking failed:', (e as Error).message);
  }
}
