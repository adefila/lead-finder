// @ts-ignore: the OpenNext build writes this file; it does not exist until `opennextjs-cloudflare build` has run
import openNext from './.open-next/worker.js';

/* The Worker Cloudflare runs: Lead Finder itself (the OpenNext build) plus the three timers.
 *
 *   every 15 minutes  /api/outbox       sends the next email (the job cron-job.org used to call)
 *   07:00 UTC daily   /api/cron         finds new leads (was in vercel.json)
 *   12:00 UTC daily   /api/find-emails  looks for their email addresses (was in vercel.json)
 *
 * Each timer calls the same route as before, over the app's own front door and with the same timer secret, so there is one piece of code
 * for each job and the same login check applies. */
type Env = { CRON_SECRET?: string; APP_URL?: string; [k: string]: unknown };

const JOBS: Record<string, string> = {
  '*/15 * * * *': '/api/outbox',
  '0 7 * * *': '/api/cron',
  '0 12 * * *': '/api/find-emails',
};

export default {
  async fetch(req: Request, env: Env, ctx: unknown) {
    return openNext.fetch(req, env, ctx);
  },
  async scheduled(event: { cron: string }, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    const path = JOBS[event.cron];
    if (!path) return;
    const origin = String(env.APP_URL ?? 'https://leads.adefilasamuel.com').replace(/\/+$/, '');
    const req = new Request(`${origin}${path}`, { headers: env.CRON_SECRET ? { authorization: `Bearer ${env.CRON_SECRET}` } : {} });
    ctx.waitUntil(
      openNext.fetch(req, env, ctx)
        .then(async (r: Response) => console.log(`timer ${path}:`, r.status, (await r.text()).slice(0, 200)))
        .catch((e: unknown) => console.error(`timer ${path} failed`, e)),
    );
  },
};
