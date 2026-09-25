import { Resend } from 'resend';
import type { Lead } from '@/types/lead';
import { splitDraft } from '@/lib/compose';
import { APP_URL, sendLink } from '@/lib/tracking';

const SOURCE_LABEL: Record<Lead['source'], string> = {
  upwork: 'Upwork',
  remoteok: 'RemoteOK',
  remotive: 'Remotive',
  weworkremotely: 'We Work Remotely',
  apollo: 'Apollo',
  freelancer: 'Freelancer',
  places: 'Local business',
};

const HEADLINES = ['No website', 'Outdated website', 'Website broken'];

// Same tokens as the dashboard (globals.css)
const C = {
  bg: '#F7F7F7',
  surface: '#ffffff',
  surface2: '#fafafa',
  fg: '#111111',
  fg2: '#4b5159',
  fg3: '#8a8f98',
  border: '#e8e8e8',
  borderStrong: '#d9d9d9',
  green: '#00ab4a',
  greenInk: '#00803a',
  greenTint: '#eaf7ef',
  purple: '#5b3fd6',
  purpleTint: '#f2f0ff',
  warnInk: '#9a5b00',
  warnTint: '#fff4e5',
  dark: '#0f0f0f',
};
const FONT = `Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

type Variant = 'primary' | 'secondary' | 'quiet';

function button(href: string, label: string, variant: Variant): string {
  const look = {
    primary: `background:${C.green};color:#ffffff;border:1px solid ${C.green}`,
    secondary: `background:${C.surface};color:${C.fg};border:1px solid ${C.borderStrong}`,
    quiet: `background:${C.surface2};color:${C.fg2};border:1px solid ${C.border}`,
  }[variant];
  const size = variant === 'quiet' ? 'font-size:12px;padding:6px 11px' : 'font-size:13px;padding:9px 15px';
  return `<a href="${esc(href)}" target="_blank" style="display:inline-block;${look};${size};font-weight:600;line-height:1.2;border-radius:6px;text-decoration:none;margin:0 6px 8px 0;white-space:nowrap">${label}</a>`;
}

function pill(text: string, fg: string, bg: string): string {
  return `<span style="display:inline-block;font-size:11px;font-weight:600;line-height:1;padding:5px 8px;border-radius:4px;color:${fg};background:${bg};white-space:nowrap">${text}</span>`;
}

function scoreBadge(score: number): string {
  const [fg, bg] = score >= 75 ? [C.greenInk, C.greenTint] : score >= 55 ? [C.purple, C.purpleTint] : [C.fg2, '#f0f0f0'];
  return `<span style="display:inline-block;min-width:26px;text-align:center;font-size:12px;font-weight:700;line-height:1;padding:7px 6px;border-radius:6px;color:${fg};background:${bg}">${score}</span>`;
}

function actions(lead: Lead): string {
  const links = lead.contactLinks ?? {};
  const primary: string[] = [];
  const quiet: string[] = [];

  if (lead.contactEmail) {
    const who = lead.contactName?.split(' ')[0] ?? lead.title;
    primary.push(button(sendLink(lead.id, 'gmail'), `Email ${esc(who)} in Gmail`, 'primary'));
    primary.push(button(sendLink(lead.id, 'mail'), 'Mail app', 'secondary'));
  } else if (lead.source === 'freelancer') {
    primary.push(button(sendLink(lead.id, 'bid'), 'Open project and bid', 'primary'));
  }
  if (lead.contactPhone) {
    primary.push(button(`tel:${lead.contactPhone.replace(/\s/g, '')}`, `Call ${esc(lead.contactPhone)}`, lead.contactEmail ? 'secondary' : 'primary'));
  }
  for (const [key, label] of [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['linkedin', 'LinkedIn'], ['twitter', 'X']] as const) {
    if (links[key]) quiet.push(button(links[key]!, label, 'quiet'));
  }
  if (links.website) quiet.push(button(links.website, 'Website', 'quiet'));
  else if (links.maps) quiet.push(button(links.maps, 'Google Maps', 'quiet'));

  return `${primary.join('')}${quiet.length ? `<div style="margin-top:2px">${quiet.join('')}</div>` : ''}`;
}

function leadCard(lead: Lead): string {
  const { subject, body } = splitDraft(lead.proposal ?? '');
  const first = lead.description.split('. ')[0];
  const headline = lead.source === 'places' && HEADLINES.includes(first) ? first : '';
  const why = headline ? lead.description.slice(headline.length + 2) : lead.description;
  const person = lead.contactName && lead.contactName !== lead.title
    ? `${esc(lead.contactName)}${lead.contactTitle ? `, ${esc(lead.contactTitle)}` : ''}`
    : '';

  return `
  <div style="background:${C.surface};border:1px solid ${C.border};border-radius:8px;margin-bottom:14px;overflow:hidden">
    <div style="padding:18px 20px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse"><tr>
        <td style="width:46px;vertical-align:top;padding-top:2px">${scoreBadge(lead.score ?? 0)}</td>
        <td style="vertical-align:top">
          <div style="font-size:16px;font-weight:700;color:${C.fg};line-height:1.35">${esc(lead.title)}</div>
          <div style="font-size:12px;color:${C.fg3};margin-top:4px">${SOURCE_LABEL[lead.source]} &middot; ${esc(lead.company)}</div>
          ${headline ? `<div style="margin-top:8px">${pill(headline, C.warnInk, C.warnTint)}</div>` : ''}
        </td>
      </tr></table>
      <div style="font-size:13px;color:${C.fg2};line-height:1.6;margin-top:12px">${esc(why.slice(0, 220))}</div>
      ${person || lead.contactEmail ? `
      <div style="margin-top:12px;font-size:13px;color:${C.fg};line-height:1.7">
        ${person ? `<div><span style="color:${C.fg3};display:inline-block;width:52px">Person</span>${person}</div>` : ''}
        ${lead.contactEmail ? `<div><span style="color:${C.fg3};display:inline-block;width:52px">Email</span><strong>${esc(lead.contactEmail)}</strong></div>` : ''}
      </div>` : ''}
    </div>
    <div style="margin:0 20px;padding:14px 16px;background:${C.surface2};border:1px solid ${C.border};border-radius:6px;font-size:14px;color:${C.fg};line-height:1.65">
      ${subject ? `<div style="font-size:12px;color:${C.fg3};margin-bottom:8px"><strong style="color:${C.fg2}">Subject</strong>&nbsp; ${esc(subject)}</div>` : ''}
      ${esc(body).replace(/\n/g, '<br>')}
    </div>
    <div style="padding:16px 20px 10px">${actions(lead)}</div>
  </div>`;
}

function statTile(value: number, label: string, tone: string, pad: string): string {
  return `<td style="width:33.33%;padding:${pad}">
    <div style="background:${C.surface};border:1px solid ${C.border};border-radius:6px;padding:14px 14px 12px">
      <div style="font-size:24px;font-weight:700;color:${tone};line-height:1.1">${value}</div>
      <div style="font-size:12px;color:${C.fg3};margin-top:4px">${label}</div>
    </div>
  </td>`;
}

function buildEmailHtml(leads: Lead[], followUpsDue: number): string {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const withEmail = leads.filter(l => l.contactEmail);
  const rest = leads.filter(l => !l.contactEmail);
  const section = (title: string, list: Lead[]) => list.length
    ? `<div style="font-size:11px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:${C.fg3};margin:26px 0 10px">${title} &middot; ${list.length}</div>${list.map(leadCard).join('')}`
    : '';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Lead Finder</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:${FONT};-webkit-font-smoothing:antialiased">
  <div style="max-width:640px;margin:0 auto;padding:24px 12px 32px">
    <div style="background:${C.dark};border-radius:8px;padding:18px 20px">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse"><tr>
        <td style="vertical-align:middle"><img src="${APP_URL}/email-logo.png" width="162" height="36" alt="Lead Finder" style="display:block;border:0;color:#ffffff;font-size:20px;font-weight:700"></td>
        <td style="vertical-align:middle;text-align:right;font-size:12px;color:#9a9a9a">${date}</td>
      </tr></table>
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:12px;border-collapse:collapse"><tr>
      ${statTile(leads.length, 'new leads', C.fg, '0 6px 0 0')}
      ${statTile(withEmail.length, 'ready to email', C.greenInk, '0 3px')}
      ${statTile(followUpsDue, 'follow-ups due', followUpsDue ? C.warnInk : C.fg, '0 0 0 6px')}
    </tr></table>

    ${followUpsDue ? `
    <div style="margin-top:12px;padding:14px 16px;background:${C.warnTint};border:1px solid #f3d9b1;border-radius:6px;font-size:13px;color:#6b4000">
      <strong>${followUpsDue} follow-up${followUpsDue === 1 ? ' is' : 's are'} due.</strong> Claude has drafted them for you.
      <div style="margin-top:10px">${button(`${APP_URL}`, 'Open the Follow up tab', 'secondary')}</div>
    </div>` : ''}

    ${section('Ready to email', withEmail)}
    ${section('Bid, call or DM', rest)}

    <div style="text-align:center;margin-top:24px">${button(APP_URL, 'Open Lead Finder', 'primary')}</div>
    <div style="text-align:center;padding:8px 0 0;font-size:12px;color:${C.fg3};line-height:1.6">
      Send and bid buttons mark the lead as contacted in Lead Finder.
    </div>
  </div>
</body></html>`;
}

export async function sendLeadsEmail(leads: Lead[], followUpsDue = 0): Promise<void> {
  const sorted = [...leads].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const ready = leads.filter(l => l.contactEmail).length;
  const parts = [
    leads.length ? `${leads.length} new leads, ${ready} ready to email` : '',
    followUpsDue ? `${followUpsDue} follow-up${followUpsDue === 1 ? '' : 's'} due` : '',
  ].filter(Boolean);
  const subject = parts.join(' · ');

  console.log(`[email] Sending digest with ${leads.length} leads...`);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: 'Lead Finder <onboarding@resend.dev>',
    to: 'adefilasamuel929@gmail.com',
    subject,
    html: buildEmailHtml(sorted, followUpsDue),
  });

  if (error) {
    console.error('[email] Resend error:', error);
    throw new Error(`Email send failed: ${JSON.stringify(error)}`);
  }
  console.log('[email] Email sent, id:', data?.id);
}

