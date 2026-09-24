export interface Lead {
  id: string;
  title: string;
  company: string;
  description: string;
  url: string;
  source: 'upwork' | 'remoteok' | 'remotive' | 'weworkremotely';
  postedAt: string;
  score?: number;
  proposal?: string;
  status?: 'new' | 'approved' | 'skipped';
}
