import type { Lead } from '@/types/lead';
import { SKILLS, type Profile } from '@/lib/profile';

// How well a job fits your profile, from 0 to 100. Plain rules, no AI and no cost: the skills the job names against the
// skills in your CV, whether the job is the kind of role you do, and whether the level is right for your experience.

export interface JobMatch {
  score: number;
  matched: string[];   // skills the job asks for that you have
  missing: string[];   // skills the job asks for that your profile does not show
  at: string;
}

const DESIGN_ROLE = /design/i;
const BUILD_ROLE = /develop|engineer|front[- ]?end|full[- ]?stack|programmer|webflow|framer/i;
const SENIOR = /\b(senior|sr\.?|staff|lead|principal|head)\b/i;
const JUNIOR = /\b(junior|jr\.?|intern|graduate|entry[- ]level|trainee)\b/i;
// A stack you do not work in: a job built around it is a poor fit however well the title reads.
const OTHER_STACK = /\b(ios|swift|kotlin|android|java|unity|unreal|embedded|devops|kubernetes|machine learning|data scientist|gis|salesforce|sap)\b|\.net\b|c\+\+/i;
// Skills that count as covering another one you might not have written out in full.
const COVERS: Record<string, string[]> = {
  'UI/UX design': ['Figma', 'Product design', 'Web design', 'Prototyping', 'Wireframing'],
  'Web design': ['Framer', 'Webflow', 'Landing pages', 'Marketing websites', 'Figma'],
  'Front-end': ['React', 'Next.js', 'JavaScript', 'TypeScript'],
  'HTML/CSS': ['React', 'Next.js', 'Tailwind', 'Framer', 'Webflow'],
  'Responsive design': ['Framer', 'Webflow', 'Tailwind'],
};
const KEY_TOOLS = ['Framer', 'Webflow', 'Next.js', 'Figma', 'React'];

export function matchJob(job: Pick<Lead, 'title' | 'company' | 'description'>, profile: Pick<Profile, 'skills' | 'titles' | 'years'>): JobMatch {
  const title = job.title.toLowerCase();
  const body = `${job.title} ${job.company} ${job.description}`;
  const have = new Set(profile.skills);
  const hasSkill = (name: string) => have.has(name) || (COVERS[name] ?? []).some(c => have.has(c));

  // What the job asks for. A skill named in the title counts double.
  const asked = SKILLS.filter(s => s.re.test(body)).map(s => ({ name: s.name, w: s.weight * (s.re.test(job.title) ? 2 : 1) }));
  const total = asked.reduce((n, s) => n + s.w, 0);
  const got = asked.filter(s => hasSkill(s.name));
  // A job that names only one skill tells us little, so it cannot reach the top on that alone.
  const skillScore = total ? (got.reduce((n, s) => n + s.w, 0) / total) * Math.min(1, 0.55 + 0.15 * asked.length) : 0.35;

  // Is it the kind of role you do?
  const designer = have.has('Figma') || have.has('UI/UX design') || have.has('Product design') || profile.titles.some(t => DESIGN_ROLE.test(t));
  const builder = have.has('Framer') || have.has('Webflow') || have.has('React') || have.has('Next.js') || have.has('Front-end') || profile.titles.some(t => BUILD_ROLE.test(t));
  const wantsDesign = DESIGN_ROLE.test(title), wantsBuild = BUILD_ROLE.test(title);
  const kind = (wantsDesign && wantsBuild && (designer || builder)) ? 1
    : wantsDesign ? (designer ? 1 : 0.15)
    : wantsBuild ? (builder ? 1 : 0.15)
    : 0.1;

  // The level against your years of experience (only when your profile shows them).
  let penalty = 0;
  if (profile.years !== null) {
    if (SENIOR.test(title) && profile.years < 3) penalty = 18;
    else if (SENIOR.test(title) && profile.years < 5) penalty = 8;
    if (JUNIOR.test(title) && profile.years >= 5) penalty = 10;
  }

  if (OTHER_STACK.test(body) && !OTHER_STACK.test(profile.skills.join(' '))) penalty += 25;

  // The tools you are strongest in, named in the job
  const bonus = KEY_TOOLS.some(t => have.has(t) && got.some(g => g.name === t)) ? 8 : 0;

  const score = Math.max(0, Math.min(100, Math.round(100 * (0.5 * skillScore + 0.4 * kind) + bonus - penalty)));
  return {
    score,
    matched: got.sort((a, b) => b.w - a.w).map(s => s.name).slice(0, 8),
    missing: asked.filter(s => !hasSkill(s.name)).sort((a, b) => b.w - a.w).map(s => s.name).slice(0, 5),
    at: new Date().toISOString(),
  };
}

export const STRONG_MATCH = 70;

// Add a match to each job in the list (used for new jobs as they are found).
export function withMatches<T extends Lead>(leads: T[], profile: Pick<Profile, 'skills' | 'titles' | 'years'>): T[] {
  return leads.map(l => (l.source === 'job' || l.source === 'remote')
    ? { ...l, contactLinks: { ...l.contactLinks, match: matchJob(l, profile) } }
    : l);
}
