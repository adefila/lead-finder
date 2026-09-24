export interface Lead {
  id: string;
  title: string;
  company: string;
  description: string;
  url: string;
  source: 'upwork' | 'remoteok' | 'remotive' | 'weworkremotely' | 'apollo' | 'freelancer';
  postedAt: string;
  score?: number;
  proposal?: string;
  status?: 'new' | 'approved' | 'skipped';
  // Apollo-sourced contacts only
  contactEmail?: string;
  contactName?: string;
  contactTitle?: string;
}
