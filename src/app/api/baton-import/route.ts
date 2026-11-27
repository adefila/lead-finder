import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { Lead } from '@/types/lead';
import { getLeads, saveLeads, updateLead } from '@/lib/supabase';
import { emailDomainAccepts } from '@/lib/verify';
import { batonDraft } from '@/lib/templatedraft';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Loads developers and agencies (found on GitHub) to pitch Baton. Body: { rows: [...], queue?: boolean }.
// Each row is one line of the prospect list: name, github, website, public_email, twitter, location, company, bio, stacks, why, tier, score.
// Only people who published an email address are imported. Leads are saved with the Baton segment, a template draft (no AI), and queued
// so the outbox sends at least BATON_DAILY_MIN of them a day (see outbox.ts). Already-known emails and GitHub profiles are skipped.
interface Row { name?: string; github?: string; website?: string; public_email?: string; twitter?: string; location?: string; company?: string; bio?: string; stacks?: string; why?: string; tier?: string; score?: string | number }

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Addresses that are not a person or a team that can answer (no-reply, GitHub's own, press and legal desks).
const NOT_A_DESK = /^(no-?reply|noreply|donotreply|abuse|privacy|legal|press|jobs|careers|hr|billing|security)@|@users\.noreply\.github\.com$/i;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { rows?: Row[]; queue?: boolean } | null;
  const rows = Array.isArray(body?.rows) ? body!.rows!.slice(0, 600) : [];
  if (!rows.length) return NextResponse.json({ error: 'Send { rows: [...] }' }, { status: 400 });

  const existing = await getLeads();
  const knownEmails = new Set(existing.map(l => l.contactEmail?.toLowerCase()).filter(Boolean));
  const knownIds = new Set(existing.map(l => l.id));

  const made: Lead[] = [];
  const skipped = { noEmail: 0, badEmail: 0, noMail: 0, known: 0 };
  const seen = new Set<string>();
  for (const r of rows) {
    const email = str(r.public_email, 200).toLowerCase();
    const login = str(r.github, 200).replace(/\/+$/, '').split('/').pop()?.toLowerCase() ?? '';
    if (!email) { skipped.noEmail++; continue; }
    if (!EMAIL.test(email) || NOT_A_DESK.test(email) || !login) { skipped.badEmail++; continue; }
    const id = `gh-${login}`;
    if (knownIds.has(id) || knownEmails.has(email) || seen.has(email)) { skipped.known++; continue; }
    seen.add(email);
    if (!(await emailDomainAccepts(email))) { skipped.noMail++; continue; }

    const title = str(r.name, 80) || login;
    const stacks = str(r.stacks, 80);
    const description = [
      str(r.bio, 280),
      stacks ? `Builds with: ${stacks}.` : '',
      r.location ? `Based in ${str(r.location, 60)}.` : '',
      str(r.why, 160) ? `Why a fit: ${str(r.why, 160)}.` : '',
    ].filter(Boolean).join(' ');
    const lead: Lead = {
      id,
      source: 'github',
      title,
      company: str(r.company, 80).replace(/^@/, '') || title,
      description,
      url: `https://github.com/${login}`,
      postedAt: new Date().toISOString(),
      score: Math.round(Number(r.score) * 5) || (r.tier === 'A' ? 70 : 50),
      contactEmail: email,
      contactName: r.name && !/studio|labs?|agency|technolog|solutions|ltd|inc\b/i.test(r.name) && str(r.name, 80).split(' ').length <= 3 ? str(r.name, 80) : undefined,
      contactLinks: {
        segment: 'baton',
        github: `https://github.com/${login}`,
        ...(str(r.website, 200) ? { website: str(r.website, 200) } : {}),
        ...(str(r.twitter, 200) ? { twitter: str(r.twitter, 200) } : {}),
      },
    };
    lead.proposal = batonDraft(lead);
    made.push(lead);
  }

  await saveLeads(made);
  let queued = 0;
  if (body?.queue !== false) {
    const now = Date.now();
    for (let i = 0; i < made.length; i += 10) {
      const results = await Promise.all(made.slice(i, i + 10).map((l, j) =>
        updateLead(l.id, { status: 'queued', auto_sequence: true, queued_at: new Date(now + (i + j) * 1000).toISOString(), send_error: null })));
      queued += results.filter(e => !e).length;
    }
  }
  return NextResponse.json({ received: rows.length, imported: made.length, queued, skipped, batchId: crypto.randomBytes(3).toString('hex') });
}
