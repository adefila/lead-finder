'use client';

import type { Lead, LeadStatus } from '@/types/lead';
import {
  FIT_HINT, SOURCE_LABEL, STATUS_LABEL, STATUS_TONE, fitOf, headlineOf, nextStep, personOf,
  shortDate, statusOf, type SortKey,
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

function SortHeader({ label, k, sort, onSort, className, title }: {
  label: string; k: SortKey; sort: Props['sort']; onSort: Props['onSort']; className?: string; title?: string;
}) {
  const active = sort.key === k;
  return (
    <th className={className} aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} title={title}>
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
      <table className={`crm${selection.size ? ' selecting' : ''}`}>
        <thead>
          <tr>
            <th className="col-check">
              <Checkbox label="Select all on this page" checked={all} indeterminate={picked > 0 && !all} onChange={onToggleAll} />
            </th>
            <SortHeader label="Business" k="name" sort={sort} onSort={onSort} className="col-lead" />
            <th className="col-contact">Contact</th>
            <th className="col-source">Found on</th>
            <SortHeader label="Fit" k="score" sort={sort} onSort={onSort} className="col-score" title={FIT_HINT} />
            <th className="col-status">Status</th>
            <SortHeader label="Next step" k="next" sort={sort} onSort={onSort} className="col-next" />
            <SortHeader label="Added" k="added" sort={sort} onSort={onSort} className="col-date" />
            <th className="col-actions"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody key={pageKey}>
          {leads.map(l => {
            const status = statusOf(l);
            const person = personOf(l);
            const headline = headlineOf(l);
            const step = nextStep(l);
            const fit = fitOf(l.score);
            return (
              <tr
                key={l.id}
                className={[selectedId === l.id && 'selected', selection.has(l.id) && 'picked'].filter(Boolean).join(' ')}
                onClick={() => onOpen(l.id)}
              >
                <td className="col-check" onClick={e => e.stopPropagation()}>
                  <Checkbox label={`Select ${l.title}`} checked={selection.has(l.id)} onChange={() => onToggle(l.id)} />
                </td>
                <td className="col-lead">
                  <div className="cell-title">{l.title}</div>
                  <div className="cell-sub">
                    {headline && <span className="cell-flag">{headline}</span>}
                    {headline && <span className="sep">·</span>}
                    <span>{l.company}</span>
                  </div>
                </td>
                <td className="col-contact">
                  <div className="cell-title small">
                    {person || <span className="muted">{l.source === 'freelancer' ? 'Client on Freelancer' : 'Name not found'}</span>}
                  </div>
                  <div className="cell-sub">
                    {l.contactEmail
                      ? <><Icon name="mail" size={12} /><span className="ellipsis">{l.contactEmail}</span></>
                      : l.contactPhone
                        ? <><Icon name="phone" size={12} /><span className="ellipsis">{l.contactPhone}</span></>
                        : <span>{l.source === 'freelancer' ? 'Reply on the job post' : l.contactLinks?.linkedin ? 'Reach them on LinkedIn' : 'No email or phone'}</span>}
                  </div>
                </td>
                <td className="col-source"><span className="source">{SOURCE_LABEL[l.source]}</span></td>
                <td className="col-score"><span className={`fit ${fit.tone}`} title={FIT_HINT}>{fit.label}</span></td>
                <td className="col-status"><span className={`status ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span></td>
                <td className={step.urgent ? 'col-next next urgent' : 'col-next next'}>{step.text || <span className="muted">-</span>}</td>
                <td className="col-date muted">{shortDate(l.createdAt)}</td>
                <td className="col-actions" onClick={e => e.stopPropagation()}>
                  <div className="row-actions">
                    {status === 'new' && l.contactEmail && (
                      <button className="row-btn" title="Send this email automatically on the next weekday morning" onClick={() => onStatus(l.id, 'queued')}>
                        Schedule
                      </button>
                    )}
                    {status === 'new' && (
                      <button className="icon-btn quiet" title="Skip this lead" aria-label="Skip" onClick={() => onStatus(l.id, 'skipped')}>
                        <Icon name="x" />
                      </button>
                    )}
                    {(status === 'skipped' || status === 'lost') && (
                      <button className="row-btn" title="Move back to To contact" onClick={() => onStatus(l.id, 'new')}>
                        Bring back
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
