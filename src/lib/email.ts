import { Resend } from 'resend';
import type { Lead } from '@/types/lead';
import { gmailComposeUrl, mailtoUrl, splitDraft } from '@/lib/compose';

const SOURCE_LABEL: Record<Lead['source'], string> = {
  upwork: 'Upwork',
  remoteok: 'RemoteOK',
  remotive: 'Remotive',
  weworkremotely: 'We Work Remotely',
  apollo: 'Apollo',
  freelancer: 'Freelancer',
  places: 'Local business',
};

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
const GREEN = '#00ab4a';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function button(href: string, label: string, primary: boolean): string {
  const style = primary
    ? `background:${GREEN};color:#fff;border:1px solid ${GREEN}`
    : `background:#fff;color:#0f0f0f;border:1px solid #d9d9d9`;
  return `<a href="${esc(href)}" target="_blank" style="display:inline-block;${style};font-size:13px;font-weight:600;padding:9px 16px;text-decoration:none;margin:0 6px 6px 0">${label}</a>`;
}

function actions(lead: Lead): string {
  const draft = lead.proposal ?? '';
  const { subject, body } = splitDraft(draft);
  const links = lead.contactLinks ?? {};
  const out: string[] = [];

  if (lead.contactEmail) {
    const who = lead.contactName?.split(' ')[0] ?? lead.title;
    out.push(button(gmailComposeUrl(lead.contactEmail, subject, body), `Email ${esc(who)} in Gmail`, true));
    out.push(button(mailtoUrl(lead.contactEmail, subject, body), 'Mail app', false));
  } else if (lead.source === 'freelancer') {
    out.push(button(lead.url, 'Open project and bid', true));
  }
  if (lead.contactPhone) out.push(button(`tel:${lead.contactPhone.replace(/\s/g, '')}`, `Call ${esc(lead.contactPhone)}`, !lead.contactEmail));
  for (const [key, label] of [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['linkedin', 'LinkedIn'], ['twitter', 'X']] as const) {
    if (links[key]) out.push(button(links[key]!, label, false));
  }
  if (links.website) out.push(button(links.website, 'Website', false));
  else if (links.maps) out.push(button(links.maps, 'Google Maps', false));
  return out.join('');
}

function leadCard(lead: Lead): string {
  const { subject, body } = splitDraft(lead.proposal ?? '');
  const person = lead.contactName ? `${esc(lead.contactName)}${lead.contactTitle ? `, ${esc(lead.contactTitle)}` : ''}` : '';
  const meta = [SOURCE_LABEL[lead.source], lead.company, person].filter(Boolean).join(' &middot; ');
  const contactLine = lead.contactEmail
    ? `<div style="font-size:13px;color:#0f0f0f;margin-top:6px"><strong>To:</strong> ${esc(lead.contactEmail)}</div>`
    : '';

  return `
  <div style="background:#fff;border:1px solid #e6e6e6;margin-bottom:16px">
    <div style="padding:18px 20px 14px">
      <div style="font-size:12px;color:#6b6b6b;margin-bottom:6px">
        <span style="display:inline-block;background:#eaf7ef;color:#00873b;font-weight:700;padding:2px 7px;margin-right:6px">${lead.score ?? '-'}</span>${meta}
      </div>
      <div style="font-size:17px;font-weight:700;color:#0f0f0f;line-height:1.35">${esc(lead.title)}</div>
      <div style="font-size:13px;color:#545c68;line-height:1.55;margin-top:6px">${esc(lead.description.slice(0, 240))}</div>
      ${contactLine}
    </div>
    <div style="padding:14px 20px;background:#fafafa;border-top:1px solid #eee;font-size:14px;color:#1f1f1f;line-height:1.6">
      ${subject ? `<div style="font-size:12px;color:#6b6b6b;margin-bottom:6px"><strong>Subject:</strong> ${esc(subject)}</div>` : ''}
      ${esc(body).replace(/\n/g, '<br>')}
    </div>
    <div style="padding:14px 20px 10px;border-top:1px solid #eee">${actions(lead)}</div>
  </div>`;
}

function buildEmailHtml(leads: Lead[]): string {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const withEmail = leads.filter(l => l.contactEmail);
  const rest = leads.filter(l => !l.contactEmail);
  const section = (title: string, list: Lead[]) => list.length
    ? `<div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6b6b6b;margin:24px 0 10px">${title} (${list.length})</div>${list.map(leadCard).join('')}`
    : '';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lead Finder</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:${FONT}">
  <div style="max-width:620px;margin:0 auto;padding:24px 12px">
    <div style="background:#0f0f0f;padding:24px">
      <div style="font-size:20px;font-weight:800;color:#fff">${leads.length} new lead${leads.length === 1 ? '' : 's'}</div>
      <div style="font-size:13px;color:#9a9a9a;margin-top:4px">${date} &middot; ${withEmail.length} ready to email</div>
    </div>
    ${section('Ready to email', withEmail)}
    ${section('Bid, call or DM', rest)}
    <div style="text-align:center;padding:16px 0;font-size:12px;color:#9a9a9a">Lead Finder &middot; lead-finder-one-self.vercel.app</div>
  </div>
</body></html>`;
}

export async function sendLeadsEmail(leads: Lead[]): Promise<void> {
  const sorted = [...leads].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const ready = leads.filter(l => l.contactEmail).length;
  const subject = `${leads.length} new leads, ${ready} ready to email`;

  console.log(`[email] Sending digest with ${leads.length} leads...`);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: 'Lead Finder <onboarding@resend.dev>',
    to: 'adefilasamuel929@gmail.com',
    subject,
    html: buildEmailHtml(sorted),
  });

  if (error) {
    console.error('[email] Resend error:', error);
    throw new Error(`Email send failed: ${JSON.stringify(error)}`);
  }
  console.log('[email] Email sent, id:', data?.id);
}
