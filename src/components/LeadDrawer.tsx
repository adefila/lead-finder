'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { Lead, LeadStatus } from '@/types/lead';
import { gmailComposeUrl, splitDraft, withCheckLink, withSignature } from '@/lib/compose';
import { followUpState, MAX_FOLLOW_UPS } from '@/lib/followup';
import {
  FIT_HINT, SOURCE_LABEL, STATUS_LABEL, STATUS_TONE, callScript, findEmailUrl, fitOf, leadStory, personOf, shortDate, statusOf, systemsFor,
} from '@/lib/leadview';
import { Btn, CopyButton, Icon, LinkBtn, EASE } from '@/components/ui';
import { useFeedback } from '@/components/feedback';

const LINK_LABELS = [
  ['website', 'Website'],
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['linkedin', 'Find on LinkedIn'],
  ['twitter', 'X'],
  ['maps', 'Map'],
  ['register', 'Company record'],
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
  onQueue: (draft: string) => void;
}

function DrawerContent({ lead, position, onClose, onPrev, onNext, onStatus, onFollowedUp, onUpdate, onDelete, onQueue }: Props) {
  const initial = useMemo(() => splitDraft(lead.proposal ?? ''), [lead.proposal]);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [drafting, setDrafting] = useState(false);
  const [followUpLoaded, setFollowUpLoaded] = useState(false);
  const [redrafting, setRedrafting] = useState(false);
  const [addingEmail, setAddingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  async function saveEmail() {
    const res = await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id, contactEmail: newEmail }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) as { error?: string } : { error: 'Network error, check your connection' };
    if (!res?.ok) { toast(data.error ?? 'Could not save the email', { tone: 'error' }); return; }
    onUpdate({ contactEmail: newEmail.trim().toLowerCase(), sendError: undefined });
    setAddingEmail(false);
    toast('Email saved. Click "Write a new version" to turn the message into an email.', { tone: 'success' });
  }
  const { toast } = useFeedback();

  const status = statusOf(lead);
  const fu = followUpState(lead);
  const isFollowUp = fu.due && !lead.autoSequence;
  const story = useMemo(() => leadStory(lead), [lead]);
  const offers = useMemo(() => systemsFor(lead), [lead]);
  const fit = fitOf(lead.score);
  const links = lead.contactLinks ?? {};
  const email = lead.contactEmail;
  const person = personOf(lead);
  // First emails carry the link to their website check; follow-ups do not repeat it.
  const outgoing = withSignature(isFollowUp ? body : withCheckLink(body, lead.checkUrl));
  const gmail = email ? gmailComposeUrl(email, subject, outgoing) : '';
  const isJob = lead.source === 'freelancer' || lead.source === 'remote';

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
        toast(data.error ?? 'Could not write the follow-up', { tone: 'error' });
      }
    } finally {
      setDrafting(false);
    }
  }, [lead.id, initial.subject, toast]);

  useEffect(() => {
    if (isFollowUp && !followUpLoaded && !drafting) writeFollowUp();
  }, [isFollowUp, followUpLoaded, drafting, writeFollowUp]);

  async function redraft() {
    setRedrafting(true);
    try {
      const res = await fetch('/api/redraft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id }),
      });
      const data = await res.json() as { proposal?: string; contactName?: string; contactTitle?: string; error?: string };
      if (!data.proposal) { toast(data.error ?? 'Could not rewrite the message', { tone: 'error' }); return; }
      toast('Message rewritten', { tone: 'success' });
      const next = splitDraft(data.proposal);
      setSubject(next.subject);
      setBody(next.body);
      onUpdate({ proposal: data.proposal, contactName: data.contactName, contactTitle: data.contactTitle });
    } finally {
      setRedrafting(false);
    }
  }

  const markContacted = () => { if (status === 'new') onStatus('approved'); };
  const composed = () => (subject.trim() ? `Subject: ${subject.trim()}\n\n${body.trim()}` : body.trim());
  const sent = () => (isFollowUp ? onFollowedUp() : markContacted());
  const isLinkedIn = !email && !!links.linkedin && lead.source === 'companies_house';
  // LinkedIn notes are capped at about 300 characters, so they go without the link.
  const copyBody = () => navigator.clipboard.writeText(isLinkedIn || isFollowUp ? body : withCheckLink(body, lead.checkUrl));
  const showScript = !!lead.contactPhone && !email && (status === 'new' || status === 'approved');

  const messageTitle = isFollowUp ? `Follow-up ${fu.sent + 1} of ${MAX_FOLLOW_UPS}`
    : lead.source === 'remote' ? 'Your application note'
    : isJob ? 'Your proposal'
    : email ? 'Your email'
    : links.linkedin && lead.source === 'companies_house' ? 'Your LinkedIn message'
    : 'Your message';

  const timeline = [
    `Found ${shortDate(lead.createdAt)}`,
    lead.contactedAt && `last contacted ${shortDate(lead.contactedAt)}`,
    fu.sent > 0 && `${fu.sent} follow-up${fu.sent > 1 ? 's' : ''} sent`,
    status === 'approved' && !fu.exhausted && fu.dueAt && !fu.due && fu.sent < MAX_FOLLOW_UPS && `next follow-up ${shortDate(fu.dueAt)}`,
  ].filter(Boolean).join(', ');

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
        <div>
          <h2 className="drawer-title">{lead.title}</h2>
          <div className="drawer-sub">{lead.company} · Found on {SOURCE_LABEL[lead.source]}</div>
          <div className="drawer-meta">
            <span className={`status ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
            <span className={`fit ${fit.tone}`} title={FIT_HINT}>{fit.label} fit</span>
            {isFollowUp && <span className="flag">Follow-up due</span>}
            {fu.exhausted && <span className="flag">No reply after {fu.sent} follow-ups</span>}
          </div>
        </div>
      </header>

      <div className="drawer-body">
        <section className="dsec">
          <h3 className="dsec-title">Who to contact</h3>
          {person && <div className="kv"><span>Person</span><span>{person}{lead.contactTitle ? `, ${lead.contactTitle}` : ''}</span></div>}
          <div className="kv">
            <span>Email</span>
            {email ? (
              <span className="kv-value">
                <a className="mono" href={gmail} target="_blank" rel="noreferrer">{email}</a>
                <CopyButton text={email} label="Copy email" />
              </span>
            ) : (
              isJob ? (
                <span className="muted">{lead.source === 'remote' ? 'You apply through the job post.' : 'Hidden by Freelancer. You reply through the job post.'}</span>
              ) : addingEmail ? (
                <form className="kv-value" onSubmit={e => { e.preventDefault(); saveEmail(); }}>
                  <input className="field field-sm" type="email" autoFocus placeholder="name@business.com"
                    value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                  <button className="btn btn-sm btn-primary" type="submit" disabled={!newEmail.trim()}>Save</button>
                  <button className="btn btn-sm btn-quiet" type="button" onClick={() => setAddingEmail(false)}>Cancel</button>
                </form>
              ) : (
                <span className="kv-value">
                  <span className="muted">We could not find one</span>
                  <a className="text-link" href={findEmailUrl(lead)} target="_blank" rel="noreferrer">Search for it</a>
                  <button className="link-btn plain" type="button" onClick={() => setAddingEmail(true)}>Add email</button>
                </span>
              )
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
          {(LINK_LABELS.some(([k]) => links[k]) || isJob) && (
            <div className="kv">
              <span>Links</span>
              <div className="link-row">
                {isJob && <a className="text-link" href={lead.url} target="_blank" rel="noreferrer">Job post</a>}
                {LINK_LABELS.filter(([k]) => links[k]).map(([k, label]) => (
                  <a key={k} className="text-link" href={links[k]} target="_blank" rel="noreferrer">{label}</a>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="dsec">
          <h3 className="dsec-title">{isJob ? 'What they asked for' : 'What you can offer'}</h3>
          {offers.length > 0 && (
            <ul className="offer-list">
              {offers.map(o => <li key={o}>{o}</li>)}
            </ul>
          )}
          {story.problems.length > 0 && (
            <>
              <p className="dsec-sub">Website problems</p>
              <ul className="why-list">
                {story.problems.map(p => <li key={p}>{p}</li>)}
              </ul>
            </>
          )}
          {story.stillOpen && <p className="why-ok"><Icon name="check" size={14} /><span><strong>{lead.source === 'companies_house' ? 'Active.' : 'Still open.'}</strong> {story.stillOpen}</span></p>}
          {story.other.length > 0 && <p className="why">{story.other.join(' ').slice(0, 900)}</p>}
        </section>

        {showScript && (
          <section className="dsec">
            <h3 className="dsec-title field-label-row">
              What to say on the call
              <CopyButton text={callScript(lead)} label="Copy call script" />
            </h3>
            <p className="script">{callScript(lead)}</p>
            <p className="timeline">The goal is their email address. Use "Add email" above, then schedule the email with their one-page note of ideas.</p>
          </section>
        )}

        <section className="dsec">
          <h3 className="dsec-title">{messageTitle}</h3>
          {fu.exhausted && <div className="note">They have not replied after {fu.sent} follow-ups. You can close this one, or mark it as replied if they got back to you.</div>}
          {status === 'new' && lead.sendError && <div className="note error-note">{lead.sendError}</div>}
          {status === 'queued' && (lead.sendError
            ? <div className="note error-note">The last try did not send: {lead.sendError}. It will try again shortly.</div>
            : <div className="note info-note">This email goes out on its own on the next weekday between 9am and 4pm their time. If they do not reply, a short follow-up goes out 3 days later, and one more 4 days after that.</div>)}
          {status === 'approved' && lead.autoSequence && !fu.exhausted && (
            <div className="note info-note">Follow-ups go out on their own from your inbox, and stop as soon as {person || 'they'} reply.</div>
          )}
          {(email || subject) && (
            <label>
              <span className="field-label">Subject</span>
              <input className="field" value={subject} onChange={e => setSubject(e.target.value)} />
            </label>
          )}
          <label>
            <span className="field-label field-label-row">
              {drafting ? 'Writing your follow-up…' : 'Message'}
              <CopyButton text={body} label="Copy message" />
            </span>
            <textarea className="field" rows={11} value={body} disabled={drafting} onChange={e => setBody(e.target.value)} />
          </label>
          {lead.checkUrl && !isFollowUp && !isLinkedIn && (status === 'new' || status === 'queued') && (
            <p className="check-hint">
              <Icon name="check" size={13} />
              <span>A link to their one-page note of ideas is added above your name when this goes out. <a href={lead.checkUrl} target="_blank" rel="noreferrer">See what they will see</a></span>
            </p>
          )}

          <div className="actions">
            {/* One main action, chosen for this lead */}
            {status === 'new' && email && (
              <Btn className="btn btn-primary" onClick={() => onQueue(composed())} disabled={!body.trim()}
                title="Sends from your inbox on the next weekday morning">
                <Icon name="clock" />Schedule email
              </Btn>
            )}
            {status === 'queued' && (
              <Btn className="btn btn-primary" onClick={() => onQueue(composed())} disabled={!body.trim()}>
                <Icon name="check" />Save changes
              </Btn>
            )}
            {isFollowUp && email && (
              <LinkBtn className="btn btn-primary" href={gmail} target="_blank" rel="noreferrer" onClick={sent}>
                <Icon name="send" />Send follow-up in Gmail
              </LinkBtn>
            )}
            {isFollowUp && !email && (
              <Btn className="btn btn-primary" onClick={() => { copyBody(); toast('Message copied'); }}><Icon name="copy" />Copy message</Btn>
            )}
            {status === 'new' && !email && isJob && (
              <LinkBtn className="btn btn-primary" href={lead.url} target="_blank" rel="noreferrer"
                onClick={() => { copyBody(); markContacted(); }}>
                <Icon name="external" />Copy and open job post
              </LinkBtn>
            )}
            {status === 'new' && !email && !isJob && links.linkedin && lead.source === 'companies_house' && (
              <LinkBtn className="btn btn-primary" href={links.linkedin} target="_blank" rel="noreferrer"
                onClick={() => { copyBody(); toast('Message copied. Open their LinkedIn profile from the results, click Connect, add a note and paste. Then come back and click "I have sent it".'); }}>
                <Icon name="external" />Copy message, find them on LinkedIn
              </LinkBtn>
            )}
            {status === 'new' && !email && !isJob && !(links.linkedin && lead.source === 'companies_house') && (
              <Btn className="btn btn-primary" onClick={() => { copyBody(); toast('Message copied'); }}><Icon name="copy" />Copy message</Btn>
            )}

            {/* Everything else is secondary */}
            {status === 'new' && email && (
              <LinkBtn className="btn" href={gmail} target="_blank" rel="noreferrer" onClick={sent}
                title="Opens Gmail with this message filled in, and moves the lead to Waiting for reply">
                Send it myself in Gmail
              </LinkBtn>
            )}
            {status === 'new' && !email && !isJob && <Btn className="btn" onClick={markContacted}>I have sent it</Btn>}
            {isFollowUp && !email && <Btn className="btn" onClick={onFollowedUp}>I have followed up</Btn>}
            {status === 'queued' && <Btn className="btn" onClick={() => onStatus('new')}>Do not send</Btn>}
            {status === 'approved' && !isFollowUp && email && (
              <a className="btn" href={gmail} target="_blank" rel="noreferrer">Open in Gmail</a>
            )}
            {status === 'new' && (
              <Btn className="btn btn-quiet" onClick={redraft} disabled={redrafting}>
                <Icon name="sync" />{redrafting ? 'Rewriting…' : 'Write a new version'}
              </Btn>
            )}
            {isFollowUp && <Btn className="btn btn-quiet" onClick={writeFollowUp} disabled={drafting}><Icon name="sync" />Write a new version</Btn>}
          </div>
        </section>

        <section className="dsec dsec-foot">
          <div className="actions status-actions">
            <span className="field-label" style={{ margin: 0 }}>Move to</span>
            {status === 'approved' && <Btn className="btn btn-sm" onClick={() => onStatus('replied')}>They replied</Btn>}
            {(status === 'approved' || status === 'replied') && <Btn className="btn btn-sm" onClick={() => onStatus('won')}>Won</Btn>}
            {(status === 'approved' || status === 'replied') && <Btn className="btn btn-sm" onClick={() => onStatus('lost')}>Lost</Btn>}
            {status === 'new' && <Btn className="btn btn-sm" onClick={() => onStatus('skipped')}>Skip</Btn>}
            {status !== 'new' && <Btn className="btn btn-sm btn-quiet" onClick={() => onStatus('new')}><Icon name="undo" />Back to To contact</Btn>}
            <span className="spacer" />
            <Btn className="btn btn-sm btn-danger" onClick={onDelete}><Icon name="trash" />Delete</Btn>
          </div>
          <p className="timeline">{timeline}.</p>
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
        transition={{ duration: 0.28, ease: EASE }}
      >
        <DrawerContent key={lead.id} {...props} />
      </motion.aside>
    </>
  );
}
