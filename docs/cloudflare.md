# Lead Finder on Cloudflare

Lead Finder runs as the Cloudflare Worker `lead-finder` (leads.adefilasamuel.com and notes.adefilasamuel.com). Vercel is no longer used for it.

## Pause and resume sending

Run these in the `lead-finder` folder:

```bash
echo true  | npx wrangler secret put MAIL_PAUSED --name lead-finder   # pause
echo false | npx wrangler secret put MAIL_PAUSED --name lead-finder   # resume
```

Takes effect within a few seconds. While paused, no new emails and no follow-ups go out. Replies are still checked, lead searches keep running, and the queue waits. The dashboard shows it as paused.

Without a terminal: Cloudflare dashboard > Workers & Pages > lead-finder > Settings > Variables and secrets > MAIL_PAUSED > Edit, set the value to `true` (or `false`), then Deploy.

`MAIL_PAUSED` is a secret on purpose. A deploy never resets it. (A plain value in `wrangler.jsonc` would be reset by every deploy.)

To stop the timers completely instead: Workers & Pages > lead-finder > Settings > Triggers > Cron Triggers, delete them. The next deploy puts them back, because they are in `wrangler.jsonc`.

## The timers (in `cloudflare-worker.ts`, set in `wrangler.jsonc`)

| When (UTC) | Route | What it does |
|---|---|---|
| every 15 minutes | `/api/outbox` | checks replies, sends at most one email (a follow-up first, then a new one) |
| 07:00 | `/api/cron` | finds new leads |
| 12:00 | `/api/find-emails` | looks for their email addresses |

Limits: `MAIL_DAILY_LIMIT` (new emails a day), `MAIL_WEEKLY_LIMIT`, `MAIL_FOLLOWUP_DAILY_LIMIT`. They are Worker secrets, so change them in the dashboard or with `wrangler secret put`.

## Deploy

```bash
NEXT_PUBLIC_SUPABASE_URL=https://jfuryksdphcebropwofe.supabase.co npx opennextjs-cloudflare build
npx wrangler deploy
```

Nothing deploys from GitHub. Run the build from the project folder, never from inside `.open-next` (Windows cannot delete a folder a shell is standing in). Secrets stay on the Worker across deploys.

## Notes

- nodemailer must stay on 7.x. Version 10 cannot open mail connections on Workers.
- The dashboard has no protection if `DASHBOARD_PASSWORD` is missing, so never remove that secret.
- The dashboard password and the timer secret are in `C:\Users\HP\Backups\2026-11-25\lead-finder-new-secrets.txt` (not in git).

## Baton mailbox

Baton prospects send from their own Zoho mailbox. `BATON_MAIL_PROVIDER`, `BATON_MAIL_FROM_ADDRESS` and `BATON_MAIL_FROM_NAME` are plain values in `wrangler.jsonc`. The login and password must be Worker **secrets** (type Secret, not Text): `BATON_MAIL_USER`, `BATON_MAIL_PASSWORD`, and `BATON_MAIL_REGION` if the Zoho address ends in .eu, .in, .com.au or .jp. A plain Text variable added in the dashboard is erased by the next `wrangler deploy`; a Secret is not. `/api/baton-test` checks the login without sending.
