import Anthropic from '@anthropic-ai/sdk';
import type { Lead } from '@/types/lead';
import type { Post } from '@/types/post';

const MODEL = 'claude-haiku-4-5-20251001';

const SAMUEL = `
Samuel Adefila is a Top-Rated Framer developer (Upwork, 100% Job Success Score, 50+ sites delivered).
He specialises in Figma-to-Framer conversions, landing pages, marketing sites, template customisation.
Typical turnaround: 14 days. Portfolio: adefilasamuel.com.
He works with startups, SaaS companies, agencies, and founders who need polished web presence fast.
`.trim();

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ─── Job lead scoring ────────────────────────────────────────────────────────

export async function scoreJobs(jobs: Lead[]): Promise<Lead[]> {
  if (!jobs.length) return [];
  console.log(`[claude] Scoring ${jobs.length} jobs...`);

  const client = getClient();
  const input = jobs.map(j => ({ id: j.id, title: j.title, description: j.description.slice(0, 300), source: j.source }));

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are helping this person find the best leads:
${SAMUEL}

Score each job 0-100 for fit. High: Framer dev, Figma-to-Framer, landing pages, web design, no-code, UI/UX. Low: mobile apps, backend, unrelated tech.

Return ONLY a JSON array, no commentary: [{"id": "...", "score": 0-100}]

Jobs:
${JSON.stringify(input)}`,
    }],
  });

  let scored: { id: string; score: number }[] = [];
  try {
    const c = msg.content[0];
    if (c.type === 'text') {
      const match = c.text.match(/\[[\s\S]*\]/);
      if (match) scored = JSON.parse(match[0]);
    }
  } catch {
    return jobs.map(j => ({ ...j, score: 50 })).slice(0, 50);
  }

  const map = new Map(scored.map(s => [s.id, s.score]));
  return jobs
    .map(j => ({ ...j, score: map.get(j.id) ?? 0 }))
    .filter(j => (j.score ?? 0) >= 40)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 50);
}

// ─── Cold email drafts ───────────────────────────────────────────────────────

async function draftEmailBatch(batch: Lead[]): Promise<Map<string, string>> {
  const client = getClient();
  const block = batch
    .map((j, i) => `JOB ${i + 1} (ID: ${j.id}):\nTitle: ${j.title}\nCompany: ${j.company}\nSource: ${j.source}\nDescription: ${j.description.slice(0, 400)}`)
    .join('\n\n---\n\n');

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Draft a short cold outreach email from Samuel Adefila for each job below.

About Samuel: ${SAMUEL}

Rules:
- Start with a subject line on the first line: "Subject: ..."
- Then a blank line, then the email body
- Under 150 words total
- Reference something specific from the job/company description
- Conversational and human — not a template
- Never open with "I saw your job posting"
- Soft CTA at the end (e.g. "Worth a quick chat?")
- Sign off as Samuel

Return ONLY valid JSON, no explanation: {"JOB_ID": "Subject: ...\\n\\nBody...", ...}

${block}`,
    }],
  });

  const result = new Map<string, string>();
  try {
    const c = msg.content[0];
    if (c.type === 'text') {
      const match = c.text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as Record<string, string>;
        for (const [id, draft] of Object.entries(parsed)) result.set(id, draft);
      }
    }
  } catch (e) {
    console.error('[claude] Email batch parse error:', e);
  }
  return result;
}

export async function generateColdEmails(jobs: Lead[]): Promise<Lead[]> {
  if (!jobs.length) return [];
  console.log(`[claude] Drafting cold emails for ${jobs.length} leads...`);

  const BATCH = 5;
  const results = [...jobs];

  for (let i = 0; i < jobs.length; i += BATCH) {
    const batch = jobs.slice(i, i + BATCH);
    try {
      const map = await draftEmailBatch(batch);
      for (const job of batch) {
        const idx = results.findIndex(r => r.id === job.id);
        if (idx !== -1 && map.has(job.id)) {
          results[idx] = { ...results[idx], proposal: map.get(job.id) };
        }
      }
    } catch (e) {
      console.error(`[claude] Email batch ${Math.floor(i / BATCH) + 1} failed:`, e);
    }
  }
  return results;
}

// Keep backward compat
export async function generateAllProposals(jobs: Lead[]): Promise<Lead[]> {
  return generateColdEmails(jobs);
}

// ─── Post scoring + reply drafts ─────────────────────────────────────────────

export async function scoreAndDraftPosts(posts: Post[]): Promise<Post[]> {
  if (!posts.length) return [];
  console.log(`[claude] Scoring ${posts.length} posts...`);

  const client = getClient();
  const input = posts.map(p => ({ id: p.id, title: p.title, snippet: p.snippet.slice(0, 300), platform: p.platform }));

  const scoreMsg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Score these posts 0-100 for how good a reply opportunity they are for Samuel Adefila.

Samuel: ${SAMUEL}

High score: founder/startup looking for web design/Framer/landing page help, asking for designer recommendations, sharing a website pain point, launching a product and needs a site.
Low score: unrelated to web design, already has a developer, pure tech discussion, off-topic.

Return ONLY JSON array: [{"id": "...", "score": 0-100}]

Posts:
${JSON.stringify(input)}`,
    }],
  });

  let scored: { id: string; score: number }[] = [];
  try {
    const c = scoreMsg.content[0];
    if (c.type === 'text') {
      const match = c.text.match(/\[[\s\S]*\]/);
      if (match) scored = JSON.parse(match[0]);
    }
  } catch {}

  const map = new Map(scored.map(s => [s.id, s.score]));
  const filtered = posts
    .map(p => ({ ...p, score: map.get(p.id) ?? 0 }))
    .filter(p => (p.score ?? 0) >= 40)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 40);

  console.log(`[claude] ${filtered.length} posts passed filter. Drafting replies...`);

  const BATCH = 5;
  const withReplies = [...filtered];

  for (let i = 0; i < filtered.length; i += BATCH) {
    const batch = filtered.slice(i, i + BATCH);
    const block = batch
      .map((p, n) => `POST ${n + 1} (ID: ${p.id}):\nPlatform: ${p.platform}\nTitle: ${p.title}\nContent: ${p.snippet.slice(0, 350)}`)
      .join('\n\n---\n\n');

    try {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `Write a short, helpful reply Samuel Adefila can post on ${batch[0].platform === 'reddit' ? 'Reddit' : 'Hacker News'} for each post.

Samuel: ${SAMUEL}

Rules:
- 2-4 sentences max
- Lead with genuine insight or value first
- Naturally mention Samuel's work at the end if relevant (not forced)
- Sound like a real person, not marketing
- Don't start with "As a Framer developer..."
- Match the platform's casual tone

Return ONLY JSON, no explanation: {"POST_ID": "reply text", ...}

${block}`,
        }],
      });

      const c = msg.content[0];
      if (c.type === 'text') {
        const match = c.text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]) as Record<string, string>;
          for (const post of batch) {
            const idx = withReplies.findIndex(r => r.id === post.id);
            if (idx !== -1 && parsed[post.id]) {
              withReplies[idx] = { ...withReplies[idx], replyDraft: parsed[post.id] };
            }
          }
        }
      }
    } catch (e) {
      console.error(`[claude] Reply batch error:`, e);
    }
  }

  return withReplies;
}
