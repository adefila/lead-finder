import type { Lead } from '@/types/lead';

// Days to wait after the first message, then after the first follow-up.
export const FOLLOW_UP_GAPS = [3, 4];
export const MAX_FOLLOW_UPS = FOLLOW_UP_GAPS.length;

export interface FollowUpState {
  due: boolean;
  exhausted: boolean;
  dueAt: Date | null;
  sent: number;
}

export function followUpState(lead: Lead, now = new Date()): FollowUpState {
  const sent = lead.followUps ?? 0;
  if ((lead.status ?? 'new') !== 'approved') return { due: false, exhausted: false, dueAt: null, sent };
  const last = new Date(lead.contactedAt ?? lead.createdAt ?? now.toISOString());
  if (sent >= MAX_FOLLOW_UPS) {
    const closeAt = new Date(last.getTime() + FOLLOW_UP_GAPS[MAX_FOLLOW_UPS - 1] * 86400000);
    return { due: false, exhausted: now >= closeAt, dueAt: closeAt, sent };
  }

  const dueAt = new Date(last.getTime() + FOLLOW_UP_GAPS[sent] * 86400000);
  return { due: now >= dueAt, exhausted: false, dueAt, sent };
}

export function needsAttention(lead: Lead): boolean {
  const s = followUpState(lead);
  return s.due || s.exhausted;
}
