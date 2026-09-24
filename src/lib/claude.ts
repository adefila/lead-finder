import Anthropic from '@anthropic-ai/sdk';
import type { Lead } from '@/types/lead';

const MODEL = 'claude-haiku-4-5-20251001';

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function scoreJobs(jobs: Lead[]): Promise<Lead[]> {
  if (jobs.length === 0) return [];
  console.log(`[claude] Scoring ${jobs.length} jobs...`);

  const input = jobs.map(j => ({
    id: j.id,
    title: j.title,
    description: j.description.slice(0, 300),
    source: j.source,
  }));

  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are helping Samuel Adefila, a Top-Rated Framer developer on Upwork, find the best job leads. Score each job 0-100 for relevance. High score: Framer development, Figma-to-Framer, web design, UI/UX, no-code tools, landing pages, website builds. Low score: mobile apps, backend, unrelated tech. Return ONLY a JSON array with no extra text: [{\"id\": \"...\", \"score\": 0-100}]

Jobs to score:
${JSON.stringify(input)}`,
      },
    ],
  });

  let scored: { id: string; score: number }[] = [];
  try {
    const content = message.content[0];
    if (content.type === 'text') {
      const text = content.text.trim();
      // Extract JSON array from response
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        scored = JSON.parse(match[0]);
      }
    }
  } catch (e) {
    console.error('[claude] Failed to parse scoring response:', e);
    // Fall back: give all jobs score 50
    return jobs.map(j => ({ ...j, score: 50 })).slice(0, 50);
  }

  const scoreMap = new Map(scored.map(s => [s.id, s.score]));
  const withScores = jobs.map(j => ({ ...j, score: scoreMap.get(j.id) ?? 0 }));

  const filtered = withScores
    .filter(j => (j.score ?? 0) >= 40)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 50);

  console.log(`[claude] ${filtered.length} jobs passed score threshold (>=40)`);
  return filtered;
}

async function generateProposalBatch(jobs: Lead[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  const jobDescriptions = jobs
    .map(
      (j, i) =>
        `JOB ${i + 1} (ID: ${j.id}):
Title: ${j.title}
Company: ${j.company}
Source: ${j.source}
Description: ${j.description.slice(0, 400)}`
    )
    .join('\n\n---\n\n');

  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Generate a personalised Upwork proposal for Samuel Adefila for each job below. Samuel is a Top-Rated Framer developer: 100% Job Success Score, 50+ Framer sites delivered, specialises in Figma-to-Framer, template customisation, landing pages, 14-day delivery turnaround.

Rules:
- Under 200 words each
- Conversational, human, specific to the job details
- Mention specific things from the job description
- Highlight Samuel's relevant experience naturally
- End with a clear call to action
- Never open with "I saw your job posting" or generic openers
- Sound like a real person, not a template

Return ONLY a JSON object with no extra text: {"JOB_ID": "proposal text", ...}

${jobDescriptions}`,
      },
    ],
  });

  try {
    const content = message.content[0];
    if (content.type === 'text') {
      const text = content.text.trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as Record<string, string>;
        for (const [id, proposal] of Object.entries(parsed)) {
          results.set(id, proposal);
        }
      }
    }
  } catch (e) {
    console.error('[claude] Failed to parse proposal batch response:', e);
  }

  return results;
}

export async function generateProposal(job: Lead): Promise<string> {
  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Write a personalised Upwork proposal for Samuel Adefila for this job.

Samuel is a Top-Rated Framer developer: 100% Job Success Score, 50+ Framer sites delivered, specialises in Figma-to-Framer, template customisation, landing pages, 14-day delivery turnaround.

Job:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description.slice(0, 500)}

Rules:
- Under 200 words
- Conversational and specific to this job
- Don't open with "I saw your job posting"
- End with a call to action
- Sound human and genuine`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type === 'text') return content.text.trim();
  return '';
}

export async function generateAllProposals(jobs: Lead[]): Promise<Lead[]> {
  console.log(`[claude] Generating proposals for ${jobs.length} jobs in batches of 5...`);
  const BATCH_SIZE = 5;
  const results: Lead[] = [...jobs];

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    console.log(`[claude] Proposal batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(jobs.length / BATCH_SIZE)}`);

    try {
      const proposalMap = await generateProposalBatch(batch);
      for (const job of batch) {
        const idx = results.findIndex(r => r.id === job.id);
        if (idx !== -1) {
          results[idx] = {
            ...results[idx],
            proposal: proposalMap.get(job.id) ?? await generateProposal(job).catch(() => ''),
          };
        }
      }
    } catch (e) {
      console.error(`[claude] Batch ${Math.floor(i / BATCH_SIZE) + 1} failed, falling back to individual:`, e);
      const settled = await Promise.allSettled(batch.map(generateProposal));
      for (let j = 0; j < batch.length; j++) {
        const idx = results.findIndex(r => r.id === batch[j].id);
        const s = settled[j];
        if (idx !== -1 && s.status === 'fulfilled') {
          results[idx] = { ...results[idx], proposal: s.value };
        }
      }
    }
  }

  return results;
}
