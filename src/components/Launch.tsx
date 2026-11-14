'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';

type Mark = 'saved' | 'done';
type Spot = { id: string; name: string; kind: string; why: string; tip: string; url: string; checked: boolean };

const KEY = 'lf-launch-marks';

const LAUNCH: Spot[] = [
  { id: 'showhn', name: 'Show HN (Hacker News)', kind: 'Get noticed', why: 'Developers and agencies read it, which is who Baton is for.', tip: 'Post a working demo link and a plain description. Expect hard questions and answer fast.', url: 'https://news.ycombinator.com/showhn.html', checked: true },
  { id: 'ph', name: 'Product Hunt', kind: 'Get noticed', why: 'Broad launch-day exposure and a developer tools category.', tip: 'Needs a demo video and a real launch plan. A bare listing gets little.', url: 'https://www.producthunt.com/', checked: true },
  { id: 'ih', name: 'Indie Hackers', kind: 'Get noticed', why: 'Founders trade feedback on positioning before a launch.', tip: 'Post before launch and ask what is unclear.', url: 'https://www.indiehackers.com/', checked: true },
];

const INVEST: Spot[] = [
  { id: 'fi', name: 'Founder Institute (Africa)', kind: 'Accelerator', why: 'Takes solo founders and small teams at idea or pre-seed stage.', tip: 'Takes 4% equity to its shared pool. Read the terms first.', url: 'https://allbusiness.africa/programs/founder-institute-africa', checked: true },
  { id: 'swg', name: 'Startup Wise Guys (Africa)', kind: 'Accelerator', why: 'B2B SaaS programme for East and West Africa.', tip: 'Wants a strong team and early traction, so launch first.', url: 'https://startupwiseguys.com/location/africa/', checked: true },
  { id: 'yc', name: 'Y Combinator', kind: 'Accelerator', why: 'Biggest name for developer tools, solo founders can apply.', tip: 'Current batch dates not checked. Traction from a launch helps.', url: 'https://www.ycombinator.com/apply', checked: false },
  { id: 'antler', name: 'Antler', kind: 'Accelerator', why: 'Invests at the earliest stage and has an Africa presence.', tip: 'Current programme and location not checked.', url: 'https://www.antler.co/', checked: false },
  { id: 'techstars', name: 'Techstars', kind: 'Accelerator', why: 'Programmes by region and theme.', tip: 'Current programmes not checked.', url: 'https://www.techstars.com/', checked: false },
];

function load(): Record<string, Mark> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Mark>; } catch { return {}; }
}

// Where to put Baton in front of people: launch venues first, investors and accelerators second.
export function Launch() {
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  useEffect(() => { setMarks(load()); }, []);

  const mark = (id: string, m: Mark) => setMarks(prev => {
    const next = { ...prev };
    if (prev[id] === m) delete next[id]; else next[id] = m;
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* not saved */ }
    return next;
  });

  const group = (title: string, spots: Spot[]) => (
    <div className="sc-countries">
      <div className="sc-label">{title}</div>
      <ul className="sc-list">
        {spots.map(s => (
          <li key={s.id} className={`sc-item${marks[s.id] === 'done' ? ' dim' : ''}`}>
            <div className="sc-body" style={{ display: 'block' }}>
              <div className="sc-head" style={{ cursor: 'default' }}>
                <span className="sc-name">{s.name}<span className="sc-sub">{s.kind}{s.checked ? '' : ' · status not checked'}</span></span>
                {marks[s.id] && <span className="sc-mark">{marks[s.id] === 'saved' ? 'Saved' : 'Done'}</span>}
              </div>
              <p>{s.why}</p>
              <p className="sc-cnote">{s.tip}</p>
              <div className="sc-actions">
                <a className="btn btn-sm btn-primary" href={s.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} />Open</a>
                <button className="btn btn-sm" aria-pressed={marks[s.id] === 'saved'} onClick={() => mark(s.id, 'saved')}>{marks[s.id] === 'saved' ? 'Saved' : 'Save'}</button>
                <button className="btn btn-sm" aria-pressed={marks[s.id] === 'done'} onClick={() => mark(s.id, 'done')}>{marks[s.id] === 'done' ? 'Done' : 'Mark done'}</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="sc">
      {group('Get Baton noticed', LAUNCH)}
      {group('Investors and accelerators', INVEST)}
      <p className="sc-foot">Dates, terms and deadlines change. Confirm everything on each official page before you apply. Best first move: a Show HN with the demo film.</p>
    </div>
  );
}
