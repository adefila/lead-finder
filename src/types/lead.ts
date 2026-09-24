export interface ContactLinks {
  maps?: string;
  website?: string;
  linkedin?: string;
  twitter?: string;
  instagram?: string;
  facebook?: string;
}

export interface Lead {
  id: string;
  title: string;
  company: string;
  description: string;
  url: string;
  source: 'upwork' | 'remoteok' | 'remotive' | 'weworkremotely' | 'apollo' | 'freelancer' | 'places';
  postedAt: string;
  score?: number;
  proposal?: string;
  status?: 'new' | 'approved' | 'skipped';
  contactEmail?: string;
  contactName?: string;
  contactTitle?: string;
  contactPhone?: string;
  contactLinks?: ContactLinks;
}
