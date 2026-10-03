'use client';

import type { ReactNode } from 'react';
export type EmptyKind =
  | 'new' | 'queued' | 'approved' | 'followup' | 'replied' | 'done' | 'won' | 'lost' | 'skipped' | 'all' | 'search' | 'history' | 'remote';

const COPY: Record<EmptyKind, { title: string; body: string }> = {
  new: { title: 'Nobody waiting', body: 'Click Find new leads and we will look for businesses that need a website.' },
  queued: { title: 'Nothing scheduled', body: 'Open a lead with an email and click Schedule email. It goes out from your inbox on a weekday morning.' },
  approved: { title: 'No one to hear back from yet', body: 'People you email or message show up here while you wait for a reply.' },
  followup: { title: 'No follow-ups needed', body: 'If someone does not reply within 3 days, they show up here.' },
  replied: { title: 'No replies yet', body: 'When someone writes back, they move here on their own.' },
  done: { title: 'Nothing finished yet', body: 'Leads you win, lose or skip end up here.' },
  won: { title: 'No wins yet', body: 'Projects you close show up here.' },
  lost: { title: 'Nothing lost', body: 'Leads that say no, or never reply, end up here.' },
  skipped: { title: 'Nothing skipped', body: 'Leads you skip show up here. You can bring them back anytime.' },
  all: { title: 'No leads yet', body: 'Click Find new leads to get started.' },
  search: { title: 'No matches', body: 'Try a different business name, person or email.' },
  history: { title: 'Nothing here yet', body: 'Each search for new leads shows up here, grouped by day.' },
  remote: { title: 'No remote roles yet', body: 'Each search checks the job boards for web roles open to you. New ones show up here.' },
};

// Shared stroke styles live in globals.css (.ill-*), so every drawing matches the dashboard.
const ART: Record<EmptyKind, ReactNode> = {
  new: (
    <>
      <rect className="ill-card" x="54" y="46" width="72" height="54" rx="8" transform="rotate(-6 90 73)" />
      <rect className="ill-card" x="62" y="40" width="72" height="54" rx="8" />
      <path className="ill-soft" d="M74 56h30M74 66h44M74 76h24" />
      <circle className="ill-line ill-fill" cx="128" cy="92" r="15" />
      <path className="ill-accent" d="M139 103l12 12" />
      <path className="ill-accent-thin" d="M122 92h12M128 86v12" />
    </>
  ),
  all: (
    <>
      <rect className="ill-card" x="58" y="56" width="84" height="50" rx="8" />
      <rect className="ill-card" x="64" y="46" width="72" height="12" rx="4" />
      <rect className="ill-card" x="70" y="38" width="60" height="10" rx="4" />
      <path className="ill-soft" d="M72 74h40M72 86h56" />
      <circle className="ill-dot" cx="128" cy="74" r="4" />
    </>
  ),
  queued: (
    <>
      <path className="ill-trail" d="M40 108c18-6 30-18 44-34" />
      <path className="ill-line ill-fill" d="M84 72l66-28-24 68-14-26z" />
      <path className="ill-line" d="M112 86l38-42" />
      <circle className="ill-line ill-fill" cx="64" cy="54" r="14" />
      <path className="ill-accent-thin" d="M64 46v8l6 4" />
    </>
  ),
  approved: (
    <>
      <rect className="ill-card" x="52" y="48" width="84" height="58" rx="8" />
      <path className="ill-line" d="M54 52l40 30 40-30" />
      <circle className="ill-badge" cx="136" cy="50" r="15" />
      <path className="ill-check" d="M129 50l5 5 9-10" />
    </>
  ),
  followup: (
    <>
      <rect className="ill-card" x="54" y="46" width="80" height="62" rx="8" />
      <path className="ill-line" d="M54 64h80M74 38v14M114 38v14" />
      <path className="ill-soft" d="M68 78h10M86 78h10M104 78h10M68 92h10M86 92h10" />
      <rect className="ill-accent-box" x="102" y="86" width="14" height="12" rx="3" />
    </>
  ),
  replied: (
    <>
      <path className="ill-card" d="M50 48h60a8 8 0 0 1 8 8v26a8 8 0 0 1-8 8H74l-14 12v-12h-10a8 8 0 0 1-8-8V56a8 8 0 0 1 8-8z" />
      <path className="ill-soft" d="M58 62h44M58 74h30" />
      <path className="ill-badge-shape" d="M150 70h-40a8 8 0 0 0-8 8v18a8 8 0 0 0 8 8h24l12 10v-10h4a8 8 0 0 0 8-8V78a8 8 0 0 0-8-8z" />
      <path className="ill-on-accent" d="M114 84h30M114 94h18" />
    </>
  ),
  done: (
    <>
      <rect className="ill-card" x="58" y="40" width="84" height="66" rx="8" />
      <path className="ill-soft" d="M90 58h36M90 74h36M90 90h24" />
      <path className="ill-accent" d="M70 58l4 4 7-8M70 74l4 4 7-8" />
      <circle className="ill-ghost" cx="75" cy="90" r="5" />
    </>
  ),
  won: (
    <>
      <path className="ill-line ill-fill" d="M72 42h56v18a28 28 0 0 1-56 0z" />
      <path className="ill-line" d="M72 50H60a10 10 0 0 0 12 16M128 50h12a10 10 0 0 1-12 16M100 88v10M84 108h32M88 98h24v10H88z" />
      <path className="ill-accent" d="M100 50l4 8 8 1-6 6 2 8-8-4-8 4 2-8-6-6 8-1z" />
      <path className="ill-spark" d="M52 32v8M48 36h8M150 30v6M147 33h6" />
    </>
  ),
  lost: (
    <>
      <path className="ill-card" d="M56 62h88v38a8 8 0 0 1-8 8H64a8 8 0 0 1-8-8z" />
      <rect className="ill-card" x="50" y="46" width="100" height="18" rx="5" />
      <path className="ill-accent" d="M88 80h24" />
    </>
  ),
  skipped: (
    <>
      <rect className="ill-card" x="46" y="50" width="64" height="48" rx="8" />
      <path className="ill-soft" d="M58 66h36M58 78h24" />
      <path className="ill-trail" d="M114 74h22" />
      <path className="ill-accent" d="M128 64l12 10-12 10" />
      <rect className="ill-ghost" x="146" y="52" width="16" height="44" rx="6" />
    </>
  ),
  search: (
    <>
      <circle className="ill-line ill-fill" cx="92" cy="70" r="26" />
      <path className="ill-line" d="M111 89l22 22" />
      <path className="ill-accent" d="M84 62l16 16M100 62L84 78" />
    </>
  ),
  remote: (
    <>
      <circle className="ill-line ill-fill" cx="100" cy="72" r="32" />
      <path className="ill-soft" d="M68 72h64M100 40c-10 9-14 20-14 32s4 23 14 32M100 40c10 9 14 20 14 32s-4 23-14 32" />
      <circle className="ill-dot" cx="128" cy="50" r="6" />
    </>
  ),
  history: (
    <>
      <rect className="ill-card" x="52" y="44" width="96" height="66" rx="8" />
      <path className="ill-line" d="M52 62h96" />
      <path className="ill-soft" d="M66 76h12M86 76h12M106 76h12M126 76h8M66 92h12M86 92h12" />
      <circle className="ill-dot" cx="112" cy="92" r="5" />
    </>
  ),
};

export function EmptyState({ kind }: { kind: EmptyKind }) {
  const { title, body } = COPY[kind];
  return (
    <div className="empty-state" role="status">
      <svg className="empty-art" viewBox="0 0 200 140" aria-hidden>
        <ellipse className="ill-shadow" cx="100" cy="126" rx="56" ry="6" />
        <circle className="ill-halo" cx="100" cy="72" r="58" />
        {ART[kind]}
      </svg>
      <strong className="empty-title">{title}</strong>
      <p className="empty-body">{body}</p>
    </div>
  );
}
