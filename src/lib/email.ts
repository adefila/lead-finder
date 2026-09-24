import { Resend } from 'resend';
import type { Lead } from '@/types/lead';

function sourceBadge(source: Lead['source']): string {
  const map: Record<Lead['source'], string> = {
    upwork: '#14a800',
    remoteok: '#00c853',
    remotive: '#6200ea',
    weworkremotely: '#0288d1',
    apollo: '#0f0f0f',
    freelancer: '#29b2fe',
    places: '#4285f4',
  };
  const label: Record<Lead['source'], string> = {
    upwork: 'Upwork',
    remoteok: 'RemoteOK',
    remotive: 'Remotive',
    weworkremotely: 'We Work Remotely',
    apollo: 'Apollo',
    freelancer: 'Freelancer',
    places: 'Local business',
  };
  const color = map[source] ?? '#555';
  const text = label[source] ?? source;
  return `<span style="display:inline-block;background:${color};color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;letter-spacing:0.3px">${text}</span>`;
}

function formatPostedAt(raw: string): string {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return raw;
  }
}

function snippet(description: string, maxLen = 180): string {
  if (description.length <= maxLen) return description;
  return description.slice(0, maxLen).trimEnd() + '…';
}

function leadCard(lead: Lead, index: number): string {
  const proposal = lead.proposal ?? 'No proposal generated.';
  const proposalLines = proposal.replace(/\n/g, '<br>');
  return `
  <div style="margin-bottom:28px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
    <!-- card header -->
    <div style="padding:16px 20px 12px;border-bottom:1px solid #f3f4f6">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
        <span style="font-size:12px;color:#9ca3af;font-weight:500">#${index + 1}</span>
        ${sourceBadge(lead.source)}
        ${lead.score !== undefined ? `<span style="font-size:11px;color:#6b7280;background:#f3f4f6;padding:2px 7px;border-radius:10px">Score: ${lead.score}</span>` : ''}
      </div>
      <h3 style="margin:0 0 4px;font-size:17px;font-weight:700;color:#111827;line-height:1.3">${lead.title}</h3>
      <div style="font-size:13px;color:#6b7280;margin-bottom:2px">
        ${lead.company ? `<strong>${lead.company}</strong> &nbsp;·&nbsp; ` : ''}Posted ${formatPostedAt(lead.postedAt)}
      </div>
    </div>
    <!-- job snippet -->
    <div style="padding:12px 20px;background:#f9fafb;font-size:14px;color:#374151;line-height:1.6;border-bottom:1px solid #e5e7eb">
      ${snippet(lead.description)}
    </div>
    <!-- proposal -->
    <div style="padding:14px 20px">
      <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:#9ca3af;margin-bottom:8px;text-transform:uppercase">Your Proposal</div>
      <div style="background:#f8f7ff;border-left:3px solid #6200ea;padding:12px 14px;font-size:14px;color:#1f2937;line-height:1.65;border-radius:0 6px 6px 0">
        ${proposalLines}
      </div>
    </div>
    <!-- link button -->
    <div style="padding:12px 20px 16px">
      <a href="${lead.url}" target="_blank" style="display:inline-block;background:#111827;color:#fff;font-size:13px;font-weight:600;padding:8px 18px;border-radius:7px;text-decoration:none;letter-spacing:0.2px">View Job →</a>
    </div>
  </div>`;
}

function buildEmailHtml(leads: Lead[]): string {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const cards = leads.map((l, i) => leadCard(l, i)).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Framer Leads – ${date}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px 12px">
    <!-- header -->
    <div style="background:linear-gradient(135deg,#111827 0%,#1f2937 100%);border-radius:12px;padding:28px 28px 24px;margin-bottom:24px;text-align:center">
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.3px">Your Framer Leads</h1>
      <p style="margin:0 0 12px;font-size:14px;color:#9ca3af">${date}</p>
      <div style="display:inline-block;background:rgba(255,255,255,0.1);border-radius:20px;padding:6px 16px;font-size:15px;color:#e5e7eb;font-weight:600">
        ${leads.length} fresh lead${leads.length !== 1 ? 's' : ''} with proposals ready
      </div>
    </div>
    <!-- leads -->
    ${cards}
    <!-- footer -->
    <div style="text-align:center;padding:20px 0 8px;font-size:12px;color:#9ca3af;line-height:1.6">
      Sent daily at 7am UTC by Lead Finder · Samuel Adefila<br>
      <span style="color:#d1d5db">adefilasamuel929@gmail.com</span>
    </div>
  </div>
</body>
</html>`;
}

export async function sendLeadsEmail(leads: Lead[]): Promise<void> {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const subject = `Your ${leads.length} Framer leads for ${date}`;
  const html = buildEmailHtml(leads);

  console.log(`[email] Sending email with ${leads.length} leads...`);

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: 'Lead Finder <onboarding@resend.dev>',
    to: 'adefilasamuel929@gmail.com',
    subject,
    html,
  });

  if (error) {
    console.error('[email] Resend error:', error);
    throw new Error(`Email send failed: ${JSON.stringify(error)}`);
  }

  console.log('[email] Email sent, id:', data?.id);
}
