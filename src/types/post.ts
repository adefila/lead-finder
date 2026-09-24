export interface Post {
  id: string;
  platform: 'reddit' | 'hackernews';
  url: string;
  title: string;
  snippet: string;
  author?: string;
  score?: number;
  replyDraft?: string;
  status?: 'new' | 'open' | 'done';
  createdAt?: string;
}
