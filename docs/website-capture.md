# Turning adefilasamuel.com visitors into leads

adefilasamuel.com is a Next.js site (repo `adefila/adefila-portfolio`). It is wired up server to
server, so ad blockers can't stop it:

- `src/app/api/contact/route.ts` forwards every enquiry to Lead Finder's `/api/capture`.
- `src/app/api/visit/route.ts` plus `src/components/VisitBeacon.tsx` (in `layout.tsx`) forward
  each page view, with the visitor's IP, to Lead Finder's `/api/visit`.
- Both send the `x-capture-key` header. Set the same secret as `CAPTURE_SECRET` on the
  lead-finder Vercel project and `LEAD_FINDER_KEY` on the adefila-portfolio project.
- `LEAD_FINDER_URL` on the portfolio defaults to `https://leads.adefilasamuel.com`.

The sections below are for other sites (Framer, plain HTML) that can't forward from a server.

Lead Finder (`https://lead-finder-one-self.vercel.app`, or your `APP_URL`) gets leads from your
website in three ways. They show up in the **From your site** tab.

## 1. Contact form → lead + instant email alert

**Option A: your Framer form (easiest).** In Framer, select the form, open its settings and set
**Send To → Webhook** with this URL:

```
https://lead-finder-one-self.vercel.app/api/capture
```

Name the fields `name`, `email`, `company`, `website`, `budget` and `message` (only `email` is
required; similar names like "Your email" or "Project details" also work).

**Option B: paste a form.** Add an Embed in Framer and paste this HTML:

```html
<form id="lf-form" style="display:grid;gap:10px;font:15px Inter,sans-serif">
  <input name="name" placeholder="Your name" required>
  <input name="email" type="email" placeholder="Email" required>
  <input name="company" placeholder="Company (optional)">
  <textarea name="message" rows="5" placeholder="What do you need?" required></textarea>
  <input name="website_url2" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px">
  <button type="submit">Send</button>
  <p id="lf-done" hidden>Thanks, I'll reply within a day.</p>
</form>
<script>
document.getElementById('lf-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var data = Object.fromEntries(new FormData(this));
  data.page = location.pathname;
  await fetch('https://lead-finder-one-self.vercel.app/api/capture', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  });
  this.querySelector('button').hidden = true;
  document.getElementById('lf-done').hidden = false;
});
</script>
```

Each enquiry becomes a lead with a reply already written, and you get an email right away.

## 2. People you emailed who visit your site

Nothing to set up. The `adefilasamuel.com` link in emails sent by the outbox now goes through a
tracked link. When someone clicks it, the lead gets a **Visited site** tag, shows up under
**Waiting for reply → Visited your site**, and you get an email the first time.

## 3. Companies browsing your site

In Framer: **Site Settings → General → Custom Code → End of `<head>` tag**, paste:

```html
<script defer src="https://lead-finder-one-self.vercel.app/t.js"></script>
```

Each page view is checked against the visitor's network. Office networks of real companies become
leads (with their website and email when it can be found). Home broadband, mobile, clouds and VPNs
are ignored, so most visitors will not show up. That's expected.

## Settings (Vercel → Environment Variables, all optional)

| Variable | What it does |
| --- | --- |
| `IPINFO_TOKEN` | Token from ipinfo.io. Without it, lookups are limited to about 1,000 a day and only give the network name. A paid plan adds the company's domain, which makes the lead much better. |
| `SITE_ORIGINS` | Your site addresses, comma-separated. Default: `https://adefilasamuel.com,https://www.adefilasamuel.com`. |
| `CAPTURE_SECRET` | If set, the form URL must end with `?key=<secret>`. Use it with the Framer webhook (option A) to block fake submissions. Don't use it with option B, where the URL is visible in the page. |

## Privacy

Company lookup uses the visitor's IP address (no cookies). If you get EU visitors, add a line to
your privacy policy saying you use visitor IP addresses to identify businesses that visit your site.
