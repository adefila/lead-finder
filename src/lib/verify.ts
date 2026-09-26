import { promises as dns } from 'dns';

const cache = new Map<string, Promise<boolean>>();

// True when the address's domain publishes mail servers, so the email won't bounce for that reason.
export function emailDomainAccepts(email: string): Promise<boolean> {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return Promise.resolve(false);
  if (!cache.has(domain)) {
    const lookup = Promise.race([
      dns.resolveMx(domain).then(records => records.some(r => r.exchange && r.exchange !== '.')),
      new Promise<boolean>(resolve => setTimeout(() => resolve(true), 5000)), // don't drop a lead on a slow DNS answer
    ]).catch(() => false);
    cache.set(domain, lookup);
  }
  return cache.get(domain)!;
}
