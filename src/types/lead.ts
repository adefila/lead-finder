export interface ContactLinks {
  maps?: string;
  website?: string;
  linkedin?: string;
  twitter?: string;
  instagram?: string;
  facebook?: string;
}

export const LEAD_STATUSES = ['new', 'approved', 'replied', 'won', 'lost', 'skipped'] as const;
export type LeadStatus = typeof LEAD_STATUSES[number];

export interface Lead {
  id: string;
  title: string;
  company: string;
  description: string;
  url: string;
  source: 'upwork' | 'remoteok' | 'remotive' | 'weworkremotely' | 'apollo' | 'freelancer' | 'places';
  postedAt: string;
  createdAt?: string;
  score?: number;
  proposal?: string;
  // 'approved' means the lead has been contacted
  status?: LeadStatus;
  contactEmail?: string;
  contactName?: string;
  contactTitle?: string;
  contactPhone?: string;
  contactLinks?: ContactLinks;
  // When the lead was last touched (first contact or latest follow-up)
  contactedAt?: string;
  followUps?: number;
  // In-memory only during a cron run: visible text from the business's site, used to find the owner's name
  siteText?: string;
}
