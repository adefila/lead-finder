'use client';

import { motion, AnimatePresence } from 'motion/react';
import type { Lead, LeadStatus } from '@/types/lead';
import {
  SOURCE_LABEL, STATUS_LABEL, STATUS_TONE, headlineOf, nextStep, personOf,
  scoreClass, shortDate, statusOf, type SortKey,
} from '@/lib/leadview';
import { Checkbox, Icon } from '@/components/ui';
import { EmptyState, type EmptyKind } from '@/components/EmptyState';

interface Props {
  leads: Lead[];
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (key: SortKey) => void;
  selectedId: string | null;
  onOpen: (id: string) => void;
  onStatus: (id: string, status: LeadStatus) => void;
  emptyKind: EmptyKind;
  pageKey: number;
  selection: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}

function SortHeader({ label, k, sort, onSort, className }: {
  label: string; k: SortKey; sort: Props['sort']; onSort: Props['onSort']; className?: string;
}) {
  const active = sort.key === k;
  return (
    <th className={className} aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className={`th-sort${active ? ' active' : ''}`} onClick={() => onSort(k)}>
        {label}
        <span className="th-arrow"><Icon name={active && sort.dir === 1 ? 'up' : 'down'} size={12} /></span>
      </button>
    </th>
  );
}

export function LeadTable({ leads, sort, onSort, selectedId, onOpen, onStatus, emptyKind, pageKey, selection, onToggle, onToggleAll }: Props) {
  const picked = leads.filter(l => selection.has(l.id)).length;
  const all = leads.length > 0 && picked === leads.length;

  if (!leads.length) return <EmptyState kind={emptyKind} />;
  return (
    <div className="table-wrap">
      <table className="crm">
        <thead>
          <tr>
            <th className="col-check">
              <Checkbox label="Select all leads" checked={all} indeterminate={picked > 0 && !all} onChange={onToggleAll} />
            </th>
            <SortHeader label="Score" k="score" sort={sort} onSort={onSort} className="col-score" />
            <SortHeader label="Lead" k="name" sort={sort} onSort={onSort} className="col-lead" />
            <th className="col-contact">Contact</th>
            <th className="col-source">Source</th>
            <th className="col-status">Status</th>
            <SortHeader label="Next step" k="next" sort={sort} onSort={onSort} className="col-next" />
            <SortHeader label="Added" k="added" sort={sort} onSort={onSort} className="col-date" />
            <th className="col-actions"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody key={pageKey}>
          <AnimatePresence initial={false}>
            {leads.map((l, i) => {
              const status = statusOf(l);
              const person = personOf(l);
              const headline = headlineOf(l);
              const step = nextStep(l);
              return (
                <motion.tr
                  key={l.id}
                  className={[selectedId === l.id && 'selected', selection.has(l.id) && 'picked'].filter(Boolean).join(' ')}
                  onClick={() => onOpen(l.id)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.25, delay: Math.min(i, 12) * 0.02 } }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                >
                  <td className="col-check" onClick={e => e.stopPropagation()}>
                    <Checkbox label={`Select ${l.title}`} checked={selection.has(l.id)} onChange={() => onToggle(l.id)} />
                  </td>
                  <td className="col-score"><span className={scoreClass(l.score ?? 0)}>{l.score ?? '-'}</span></td>
                  <td className="col-lead">
                    <div className="cell-title">{l.title}</div>
                    <div className="cell-sub">
                      {l.description.includes('Verified active') && <span className="tag good" title="Open on Google and recently reviewed">Active</span>}
                      {headline && <span className="tag warn">{headline}</span>}
                      <span>{l.company}</span>
                    </div>
                  </td>
                  <td className="col-contact">
                    <div className="cell-title small">{person || <span className="muted">{l.source === 'freelancer' ? 'Via Freelancer' : 'No name'}</span>}</div>
                    <div className="contact-icons">
                      <span className={`ci${l.contactEmail ? ' on' : ''}`} title={l.contactEmail ?? 'No email'}><Icon name="mail" size={13} /></span>
                      <span className={`ci${l.contactPhone ? ' on' : ''}`} title={l.contactPhone ?? 'No phone'}><Icon name="phone" size={13} /></span>
                      {l.contactEmail && <span className="ci-text">{l.contactEmail}</span>}
                      {!l.contactEmail && l.contactPhone && <span className="ci-text">{l.contactPhone}</span>}
                    </div>
                  </td>
                  <td className="col-source"><span className="source">{SOURCE_LABEL[l.source]}</span></td>
                  <td className="col-status"><span className={`status ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span></td>
                  <td className={step.urgent ? 'col-next next urgent' : 'col-next next'}>{step.text || <span className="muted">-</span>}</td>
                  <td className="col-date muted">{shortDate(l.createdAt)}</td>
                  <td className="col-actions" onClick={e => e.stopPropagation()}>
                    <div className="row-actions">
                      {status === 'new' && l.contactEmail && (
                        <button className="icon-btn" title="Queue to send automatically" aria-label="Queue to send"
                          onClick={() => onStatus(l.id, 'queued')}>
                          <Icon name="clock" />
                        </button>
                      )}
                      {status === 'new' && (
                        <button className="icon-btn" title="Mark as sent" aria-label="Mark as sent" onClick={() => onStatus(l.id, 'approved')}>
                          <Icon name="check" />
                        </button>
                      )}
                      {status === 'new' && (
                        <button className="icon-btn" title="Skip" aria-label="Skip" onClick={() => onStatus(l.id, 'skipped')}>
                          <Icon name="x" />
                        </button>
                      )}
                      {(status === 'skipped' || status === 'lost') && (
                        <button className="icon-btn" title="Restore to To contact" aria-label="Restore" onClick={() => onStatus(l.id, 'new')}>
                          <Icon name="undo" />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
