// One-time setup for the Baton mailbox over Zoho's web API. Run it on your own computer, in the lead-finder folder:
//   node scripts/zoho-setup.mjs
// It asks for the Self Client's ID and secret and the 10-minute code from api-console.zoho.com, turns the code into a long-lived
// refresh token, finds the mailbox's account id, and stores everything as Worker SECRETS (nothing is written to a file or printed).
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = async q => (await rl.question(q)).trim();
const dc = (await ask('Zoho data centre ending of your sign-in address (com, eu, in, com.au, jp) [com]: ')) || 'com';
const clientId = await ask('Client ID: ');
const clientSecret = await ask('Client Secret: ');
const code = await ask('Code (from Generate Code, valid 10 minutes): ');
rl.close();

const tokenRes = await fetch(`https://accounts.zoho.${dc}/oauth/v2/token`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, code }),
});
const token = await tokenRes.json();
if (!token.refresh_token) {
  console.error('Zoho did not give a refresh token:', token.error ?? JSON.stringify(token).replace(/"(access_token|refresh_token)":"[^"]+"/g, '"$1":"..."'));
  console.error('The code lasts 10 minutes and works once. Generate a new one and run this again.');
  process.exit(1);
}

const acc = await fetch(`https://mail.zoho.${dc}/api/accounts`, { headers: { Authorization: `Zoho-oauthtoken ${token.access_token}` } }).then(r => r.json());
const accounts = acc.data ?? [];
console.log(`Mailboxes found: ${accounts.map(a => a.primaryEmailAddress ?? a.mailboxAddress).join(', ') || 'none'}`);
const account = accounts.find(a => /partners@batonedit\.com/i.test(JSON.stringify(a))) ?? accounts[0];
if (!account) { console.error('No mailbox found for this login. Is the code from the right Zoho account and data centre?'); process.exit(1); }

const secrets = { ZOHO_DC: dc, ZOHO_CLIENT_ID: clientId, ZOHO_CLIENT_SECRET: clientSecret, ZOHO_REFRESH_TOKEN: token.refresh_token, ZOHO_ACCOUNT_ID: String(account.accountId) };
for (const [name, value] of Object.entries(secrets)) {
  const r = spawnSync('npx', ['wrangler', 'secret', 'put', name, '--name', 'lead-finder'], { input: value, shell: true, encoding: 'utf8' });
  console.log(`${r.status === 0 ? 'saved' : 'FAILED'}: ${name}`);
  if (r.status !== 0) console.error((r.stderr || '').split('\n').slice(0, 3).join('\n'));
}
console.log('Done. Tell Claude it is finished.');
