import { defineCloudflareConfig } from '@opennextjs/cloudflare';

/* Lead Finder on Cloudflare Workers. No extra cache layer: every page is rendered on request, as it was on Vercel. */
export default defineCloudflareConfig();
