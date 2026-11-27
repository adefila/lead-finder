// Baton's own email design for the pitch to developers and agencies: the same layout as the emails Baton sends itself (see handover/src/lib/mail.ts):
// a black header with the logo, a white card, one title, a few plain lines, one red button and a short note, with a dark mode.
// The header picture is linked from batonedit.com (the Zoho API sends no inline pictures). The plain-text version is the draft itself.

const ORIGIN = 'https://batonedit.com';
// Served by Lead Finder (a public path), so the picture is there without waiting for a Baton deploy.
const STRIP = 'https://leads.adefilasamuel.com/brand/baton-email-banner.jpg';
const FONT = "'Switzer',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// The tracked link in the email: opens Baton's partner page and tells Baton's analytics the visit came from this outreach.
// Baton's own social pages (the same ones its website footer and its other emails link to).
const SOCIALS: [string, string][] = [
  ['TikTok', 'https://www.tiktok.com/@officialbaton0'],
  ['X', 'https://x.com/officialbaton_'],
  ['Instagram', 'https://www.instagram.com/officialbaton_'],
  ['LinkedIn', 'https://www.linkedin.com/company/101325014'],
];

export const BATON_PARTNER_URL = `${ORIGIN}/partners?utm_source=outreach&utm_medium=email&utm_campaign=baton-partners`;

// Turns a Baton draft (greeting, paragraphs, a "Label: link" line for the button, closing lines, signature) into the designed email.
export function batonHtml(subject: string, body: string): string {
  const paras = body.replace(/\r\n/g, '\n').trim().split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  // The sign-off block (name, line, address) is replaced by the footer.
  const sign = paras.findIndex(p => /^Samuel(\s+Adefila)?\b/.test(p) && /batonedit\.com/i.test(p));
  const main = sign >= 0 ? paras.slice(0, sign) : paras;
  const ctaAt = main.findIndex(p => /^[^\n]{3,60}: https:\/\/batonedit\.com\S*$/.test(p));
  const cta = ctaAt >= 0 ? { label: main[ctaAt].split(': ')[0], url: main[ctaAt].split(': ').slice(1).join(': ').trim() } : null;
  const before = ctaAt >= 0 ? main.slice(0, ctaAt) : main;
  const after = ctaAt >= 0 ? main.slice(ctaAt + 1) : [];
  const title = subject.replace(/^\[Test\]\s*/i, '');
  const p = (t: string) => `<p class="m" style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4d4d4d">${esc(t)}</p>`;
  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0"><tr><td bgcolor="#d12e0a" style="background:#d12e0a;border-radius:8px"><a href="${esc(cta.url)}" style="display:inline-block;background:#d12e0a;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;line-height:1;padding:13px 20px;border-radius:8px;font-family:${FONT}">${esc(cta.label)}</a></td></tr></table>`
    : '';
  const note = after.map(t => `<p class="m" style="margin:20px 0 0;font-size:13.5px;line-height:1.55;color:#707070">${esc(t)}</p>`).join('');
  const socials = SOCIALS.map(([n, u]) => `<a class="fl" href="${u}" style="color:#707070;text-decoration:underline">${n}</a>`).join(' &nbsp;·&nbsp; ');
  const preview = (before.find(x => !/^Hi\b/.test(x)) ?? title).slice(0, 110);
  return `<!doctype html><html lang="en" xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(title)}</title>
<link href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700&display=swap" rel="stylesheet">
<style>:root{color-scheme:light dark;supported-color-schemes:light dark}body{margin:0;padding:0}img{border:0;outline:none}table{border-collapse:collapse}
@media (prefers-color-scheme:dark){.bg{background:#0e0f11!important}.card{background:#17181a!important;border-color:#2a2b2e!important}.t{color:#f3f3f5!important}.m{color:#b8b8c1!important}.f{color:#8d8d97!important;border-color:#2a2b2e!important}.fl{color:#8d8d97!important}}
[data-ogsc] .bg{background:#0e0f11!important}[data-ogsc] .card{background:#17181a!important}[data-ogsc] .t{color:#f3f3f5!important}[data-ogsc] .m{color:#b8b8c1!important}</style></head>
<body class="bg" style="margin:0;padding:0;background:#f5f5f5;font-family:${FONT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#f5f5f5">${esc(preview)}</div>
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" class="card" width="480" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;background:#ffffff;border:1px solid #e6e6e6;border-radius:12px;overflow:hidden">
<tr><td bgcolor="#FF3D12" style="padding:0;background:#FF3D12;line-height:0;font-size:0"><img src="${STRIP}" width="478" height="200" alt="Baton" style="display:block;width:100%;max-width:478px;height:auto;border:0;color:#12110F;font:700 28px/200px Arial,Helvetica,sans-serif"></td></tr>
<tr><td style="padding:32px;font-family:${FONT}">
${before.map(p).join('')}${button}${note}
<p class="f" style="margin:28px 0 0;padding-top:16px;border-top:1px solid #efefef;font-size:12.5px;line-height:1.55;color:#707070">${socials}</p>
</td></tr></table>
</td></tr></table></body></html>`;
}
