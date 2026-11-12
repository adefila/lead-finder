import type { Lead } from '@/types/lead';
import { getLeads, saveDemo, updateLead } from '@/lib/supabase';
import { generateDemo } from '@/lib/demogen';
import { isB2B, isBusinessPitch, isJobLead } from '@/lib/leadview';

// Automatic demos: a business lead that has an email gets a demo without anyone pressing a button.
// A site we can read is scanned; no site (or an unreadable one) gets a neutral concept from the name and place.
// An automatic demo goes straight to "approved". If it cannot be built safely, the email keeps the one-page note.

const RETRY_AFTER_MS = 24 * 60 * 60 * 1000;

export function wantsDemo(l: Lead): boolean {
  if (isJobLead(l) || l.source === 'website' || l.source === 'visitor') return false;
  if (!(isBusinessPitch(l) || isB2B(l))) return false;
  if (!l.contactEmail) return false;
  if (l.contactLinks?.demo) return false;
  if (!['new', 'queued', 'approved'].includes(l.status ?? 'new')) return false;
  const tried = l.contactLinks?.demoTried ? Date.parse(l.contactLinks.demoTried) : 0;
  return !(tried && Date.now() - tried < RETRY_AFTER_MS);
}

// Builds one demo. Returns true when the lead now has an approved demo.
export async function ensureDemoFor(lead: Lead): Promise<boolean> {
  if (lead.contactLinks?.demo === 'approved') return true;
  if (!wantsDemo(lead)) return false;
  try {
    const result = await generateDemo(lead, { generic: true });
    if ('error' in result) {
      console.error(`[demoauto] ${lead.title}: ${result.error}`);
      await updateLead(lead.id, { contact_links: { ...lead.contactLinks, demoTried: new Date().toISOString() } });
      return false;
    }
    const saveError = await saveDemo(lead.id, result.demo);
    if (saveError) { console.error(`[demoauto] save failed: ${saveError}`); return false; }
    const links = { ...lead.contactLinks, demo: 'approved' as const, demoLook: result.demo.look, demoSource: result.generic ? 'generic' as const : 'site' as const };
    delete links.demoTried;
    await updateLead(lead.id, { contact_links: links });
    lead.contactLinks = links;
    return true;
  } catch (e) {
    console.error(`[demoauto] ${lead.title}:`, e);
    await updateLead(lead.id, { contact_links: { ...lead.contactLinks, demoTried: new Date().toISOString() } }).catch(() => undefined);
    return false;
  }
}

// Builds demos ahead of time for the leads most likely to be emailed next (queued first), within a time budget.
export async function buildMissingDemos(budgetMs: number, limit = 6, concurrency = 3): Promise<{ built: number; tried: number }> {
  const start = Date.now();
  const all = await getLeads();
  const order = { queued: 0, approved: 1, new: 2 } as Record<string, number>;
  const todo = all.filter(wantsDemo).sort((a, b) => (order[a.status ?? 'new'] ?? 3) - (order[b.status ?? 'new'] ?? 3)).slice(0, limit);
  let built = 0, tried = 0, next = 0;
  const worker = async () => {
    while (next < todo.length && Date.now() - start < budgetMs - 45_000) {
      const lead = todo[next++];
      tried++;
      if (await ensureDemoFor(lead)) built++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker));
  return { built, tried };
}
