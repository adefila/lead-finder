'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { Lead, LeadStatus } from '@/types/lead';
import { gmailComposeUrl, mailtoUrl, splitDraft } from '@/lib/compose';
import { followUpState, MAX_FOLLOW_UPS } from '@/lib/followup';
import {
  SOURCE_LABEL, STATUS_LABEL, STATUS_TONE, headlineOf, personOf, scoreClass,
  shortDate, statusOf, whyText,
} from '@/lib/leadview';
import { Btn, CopyButton, Icon, LinkBtn, EASE } from '@/components/ui';
import { useFeedback } from '@/components/feedback';

const LINK_LABELS = [
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['linkedin', 'LinkedIn'],
  ['twitter', 'X'],
  ['website', 'Website'],
  ['maps', 'Google Maps'],
] as const;

interface Props {
  lead: Lead;
  position: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onStatus: (status: LeadStatus) => void;
  onFollowedUp: () => void;
  onUpdate: (patch: Partial<Lead>) => void;
  onDelete: () => void;
}

function DrawerContent({ lead, position, onClose, onPrev, onNext, onStatus, onFollowedUp, onUpdate, onDelete }: Props) {
  const initial = useMemo(() => splitDraft(lead.proposal ?? ''), [lead.proposal]);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [drafting, setDrafting] = useState(false);
  const [followUpLoaded, setFollowUpLoaded] = useState(false);
  const { toast } = useFeedback();

  const status = statusOf(lead);
  const fu = followUpState(lead);
  const isFollowUp = fu.due;
  const headline = headlineOf(lead);
  const links = lead.contactLinks ?? {};
  const email = lead.contactEmail;
  const person = personOf(lead);
  const gmail = email ? gmailComposeUrl(email, subject, body) : '';


  const writeFollowUp = useCallback(async () => {
    setDrafting(true);
    try {
      const res = await fetch('/api/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (data.message) {
        setBody(data.message);
        if (initial.subject) setSubject(initial.subject.startsWith('Re:') ? initial.subject : `Re: ${initial.subject}`);
        setFollowUpLoaded(true);
      } else {
        toast(data.error ?? 'Could not draft the follow-up', { tone: 'error' });
      }
    } finally {
      setDrafting(false);
    }
  }, [lead.id, initial.subject, toast]);

  useEffect(() => {
    if (isFollowUp && !followUpLoaded && !drafting) writeFollowUp();
  }, [isFollowUp, followUpLoaded, drafting, writeFollowUp]);

  const [redrafting, setRedrafting] = useState(false);
  async function redraft() {
    setRedrafting(true);
    try {
      const res = await fetch('/api/redraft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id }),
      });
      const data = await res.json() as { proposal?: string; contactName?: string; contactTitle?: string; error?: string };
      if (!data.proposal) { toast(data.error ?? 'Could not rewrite the draft', { tone: 'error' }); return; }
      toast('Draft rewritten', { tone: 'success' });
      const next = splitDraft(data.proposal);
      setSubject(next.subject);
      setBody(next.body);
      onUpdate({ proposal: data.proposal, contactName: data.contactName, contactTitle: data.contactTitle });
    } finally {
      setRedrafting(false);
    }
  }

  const markContacted = () => { if (status === 'new') onStatus('approved'); };
  const sent = () => (isFollowUp ? onFollowedUp() : markContacted());

  return (
    <>
        <header className="drawer-head">
          <div className="drawer-nav">
            <span className="muted">{position}</span>
            <button className="icon-btn" onClick={onPrev} disabled={!onPrev} aria-label="Previous lead" title="Previous (↑)"><Icon name="up" /></button>
            <button className="icon-btn" onClick={onNext} disabled={!onNext} aria-label="Next lead" title="Next (↓)"><Icon name="down" /></button>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close" title="Close (Esc)"><Icon name="x" /></button>
          </div>
          <motion.div key={lead.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: EASE }}>
            <div className="drawer-title-row">
              <span className={scoreClass(lead.score ?? 0)}>{lead.score ?? '-'}</span>
              <div style={{ minWidth: 0 }}>
                <h2 className="drawer-title">{lead.title}</h2>
                <div className="cell-sub">
                  <span>{SOURCE_LABEL[lead.source]}</span>
                  <span className="sep">/</span>
                  <span>{lead.company}</span>
                </div>
              </div>
            </div>
            <div className="drawer-tags">
              <span className={`status ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
              {headline && <span className="tag warn">{headline}</span>}
              {isFollowUp && <span className="tag warn">Follow-up {fu.sent + 1} due</span>}
              {fu.exhausted && <span className="tag warn">No reply after {fu.sent} follow-ups</span>}
            </div>
          </motion.div>
        </header>

        <div className="drawer-body">
          <section className="card">
            <span className="card-title">Contact</span>
            {person && <div className="kv"><span>Person</span><span>{person}{lead.contactTitle ? `, ${lead.contactTitle}` : ''}</span></div>}
            <div className="kv">
              <span>Email</span>
              {email ? (
                <span className="kv-value">
                  <a className="mono" href={gmail} target="_blank" rel="noreferrer">{email}</a>
                  <CopyButton text={email} label="Copy email" />
                </span>
              ) : (
                <span className="muted">{lead.source === 'freelancer' ? 'Hidden by Freelancer, reply through a bid' : 'None found on their site'}</span>
              )}
            </div>
            {lead.contactPhone && (
              <div className="kv">
                <span>Phone</span>
                <span className="kv-value">
                  <a className="mono" href={`tel:${lead.contactPhone.replace(/\s/g, '')}`}>{lead.contactPhone}</a>
                  <CopyButton text={lead.contactPhone} label="Copy phone number" />
                </span>
              </div>
            )}
            {LINK_LABELS.some(([k]) => links[k]) && (
              <div className="kv">
                <span>Links</span>
                <div className="link-row">
                  {LINK_LABELS.filter(([k]) => links[k]).map(([k, label]) => (
                    <a key={k} className="btn btn-sm" href={links[k]} target="_blank" rel="noreferrer">{label}</a>
                  ))}
                </div>
              </div>
            )}
            {lead.source === 'freelancer' && (
              <div className="kv"><span>Project</span><a href={lead.url} target="_blank" rel="noreferrer">Open on Freelancer</a></div>
            )}
            <div className="kv">
              <span>Timeline</span>
              <span>
                Added {shortDate(lead.createdAt)}
                {lead.contactedAt && `. Last contacted ${shortDate(lead.contactedAt)}`}
                {fu.sent > 0 && `, ${fu.sent} follow-up${fu.sent > 1 ? 's' : ''} sent`}
                {status === 'approved' && !fu.exhausted && fu.dueAt && !fu.due && fu.sent < MAX_FOLLOW_UPS && `. Next follow-up ${shortDate(fu.dueAt)}`}
              </span>
            </div>
          </section>

          <section className="card">
            <span className="card-title">
              {isFollowUp ? `Follow-up ${fu.sent + 1} of ${MAX_FOLLOW_UPS}` : lead.source === 'freelancer' ? 'Bid proposal' : email ? 'Email' : 'Message (DM, call notes or contact form)'}
            </span>
            {fu.exhausted && <div className="note">No reply after {fu.sent} follow-ups. Close it out, or mark it if they got back to you.</div>}
            {(email || subject) && (
              <label>
                <span className="field-label">Subject</span>
                <input className="field" value={subject} onChange={e => setSubject(e.target.value)} />
              </label>
            )}
            <label>
              <span className="field-label field-label-row">
                {drafting ? 'Writing follow-up…' : 'Message'}
                <CopyButton text={body} label="Copy message" />
              </span>
              <textarea className="field" rows={11} value={body} disabled={drafting} onChange={e => setBody(e.target.value)} />
            </label>

            <div className="actions">
              {(status === 'new' || isFollowUp) && email && (
                <>
                  <LinkBtn className="btn btn-primary" href={gmail} target="_blank" rel="noreferrer" onClick={sent}>
                    <Icon name="send" />{isFollowUp ? 'Send follow-up in Gmail' : 'Send in Gmail'}
                  </LinkBtn>
                  <LinkBtn className="btn" href={mailtoUrl(email, subject, body)} onClick={sent}>Mail app</LinkBtn>
                </>
              )}
              {status === 'new' && !email && lead.source === 'freelancer' && (
                <LinkBtn className="btn btn-primary" href={lead.url} target="_blank" rel="noreferrer"
                  onClick={() => { navigator.clipboard.writeText(body); markContacted(); }}>
                  <Icon name="external" />Copy and open bid
                </LinkBtn>
              )}
              {status === 'new' && !email && lead.source !== 'freelancer' && (
                <Btn className="btn btn-dark" onClick={markContacted}>Mark contacted</Btn>
              )}
              {status === 'new' && (email || lead.source === 'freelancer') && (
                <Btn className="btn" onClick={markContacted}><Icon name="check" />Mark as sent</Btn>
              )}
              {isFollowUp && !email && <Btn className="btn btn-dark" onClick={onFollowedUp}>Mark followed up</Btn>}
              {isFollowUp && <Btn className="btn" onClick={writeFollowUp} disabled={drafting}>Rewrite</Btn>}
              {status === 'new' && (
                <Btn className="btn" onClick={redraft} disabled={redrafting}>
                  <Icon name="sparkle" />{redrafting ? 'Rewriting…' : 'Rewrite draft'}
                </Btn>
              )}
              {status === 'approved' && !isFollowUp && email && (
                <a className="btn" href={gmail} target="_blank" rel="noreferrer">Open in Gmail</a>
              )}
            </div>

            <div className="actions status-actions">
              <span className="field-label" style={{ margin: 0 }}>Move to</span>
              {status === 'approved' && <Btn className="btn btn-sm" onClick={() => onStatus('replied')}>Replied</Btn>}
              {(status === 'approved' || status === 'replied') && <Btn className="btn btn-sm" onClick={() => onStatus('won')}>Won</Btn>}
              {(status === 'approved' || status === 'replied') && <Btn className="btn btn-sm" onClick={() => onStatus('lost')}>Lost</Btn>}
              {status === 'new' && <Btn className="btn btn-sm" onClick={() => onStatus('skipped')}>Skipped</Btn>}
              {status !== 'new' && <Btn className="btn btn-sm btn-quiet" onClick={() => onStatus('new')}><Icon name="undo" />To contact</Btn>}
              <span className="spacer" />
              <Btn className="btn btn-sm btn-danger" onClick={onDelete}><Icon name="trash" />Delete</Btn>
            </div>
          </section>

          <section className="card">
            <span className="card-title">Why this lead</span>
            <p className="why">{whyText(lead).slice(0, 900)}</p>
          </section>
        </div>
    </>
  );
}

export function LeadDrawer(props: Props) {
  const { lead, onClose, onNext, onPrev } = props;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && !!e.target.closest('input, textarea, select');
      if (e.key === 'Escape') onClose();
      if (!typing && e.key === 'ArrowDown' && onNext) { e.preventDefault(); onNext(); }
      if (!typing && e.key === 'ArrowUp' && onPrev) { e.preventDefault(); onPrev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNext, onPrev]);

  return (
    <>
      <motion.div className="scrim" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
      <motion.aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={lead.title}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.32, ease: EASE }}
      >
        <DrawerContent key={lead.id} {...props} />
      </motion.aside>
    </>
  );
}
