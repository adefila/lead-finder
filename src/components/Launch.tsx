'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Check, Bookmark } from 'lucide-react';

type Mark = 'saved' | 'done';
type Spot = { id: string; name: string; kind: string; why: string; tip: string; url: string; checked: boolean };

const KEY = 'lf-launch-marks';

const LAUNCH: Spot[] = [
  { id: 'showhn', name: 'Show HN', kind: 'Hacker News', why: 'Developers and agencies read it, which is who Baton is for.', tip: 'Post a working demo link and a plain description. Expect hard questions and answer fast.', url: 'https://news.ycombinator.com/showhn.html', checked: true },
  { id: 'ph', name: 'Product Hunt', kind: 'Launch day', why: 'Broad launch-day exposure and a developer tools category.', tip: 'Needs a demo video and a real launch plan. A bare listing gets little.', url: 'https://www.producthunt.com/', checked: true },
  { id: 'ih', name: 'Indie Hackers', kind: 'Community', why: 'Founders trade feedback on positioning before a launch.', tip: 'Post before you launch and ask what is unclear.', url: 'https://www.indiehackers.com/', checked: true },
];

const INVEST: Spot[] = [
  { id: 'fi', name: 'Founder Institute', kind: 'Accelerator, Africa', why: 'Takes solo founders and small teams at idea or pre-seed stage.', tip: 'Takes 4% equity to its shared pool. Read the terms first.', url: 'https://allbusiness.africa/programs/founder-institute-africa', checked: true },
  { id: 'swg', name: 'Startup Wise Guys', kind: 'Accelerator, Africa', why: 'B2B SaaS programme for East and West Africa.', tip: 'Wants a strong team and early traction, so launch first.', url: 'https://startupwiseguys.com/location/africa/', checked: true },
  { id: 'yc', name: 'Y Combinator', kind: 'Accelerator', why: 'Biggest name for developer tools, and solo founders can apply.', tip: 'Current batch dates not checked. Traction from a launch helps.', url: 'https://www.ycombinator.com/apply', checked: false },
  { id: 'antler', name: 'Antler', kind: 'Accelerator', why: 'Invests at the earliest stage and has an Africa presence.', tip: 'Current programme and location not checked.', url: 'https://www.antler.co/', checked: false },
  { id: 'techstars', name: 'Techstars', kind: 'Accelerator', why: 'Programmes by region and theme.', tip: 'Current programmes not checked.', url: 'https://www.techstars.com/', checked: false },
];

const CSS = `
  .bl { padding: 20px 20px 8px; }
  .bl-start { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; margin-bottom: 28px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
  .bl-start b { display: block; font-size: 14px; color: var(--fg); margin-bottom: 2px; }
  .bl-start span { font-size: 13px; color: var(--fg-3); line-height: 1.5; }
  .bl-sec { margin-bottom: 32px; }
  .bl-sec h3 { margin: 0 0 4px; font-size: 15px; font-weight: 600; color: var(--fg); }
  .bl-sec > p { margin: 0 0 14px; font-size: 13px; color: var(--fg-3); }
  .bl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
  .bl-card { display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); min-width: 0; }
  .bl-card.done { opacity: 0.55; }
  .bl-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .bl-name { margin: 0; font-size: 15px; font-weight: 600; color: var(--fg); line-height: 1.3; }
  .bl-kind { margin-top: 2px; font-size: 12px; color: var(--fg-3); }
  .bl-pill { flex-shrink: 0; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); font-size: 11px; color: var(--fg-2); background: var(--surface-2); white-space: nowrap; }
  .bl-pill.warn { color: var(--fg-3); }
  .bl-block { display: grid; gap: 2px; }
  .bl-label { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--fg-3); }
  .bl-text { margin: 0; font-size: 13px; line-height: 1.55; color: var(--fg-2); }
  .bl-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto; padding-top: 4px; }
  .bl-foot { margin: 0; padding: 4px 0 20px; font-size: 12px; color: var(--fg-3); }
  @media (max-width: 720px) { .bl { padding: 16px 12px 4px; } .bl-start { flex-direction: column; align-items: flex-start; } .bl-grid { grid-template-columns: minmax(0, 1fr); } }
`;

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

  const card = (s: Spot) => {
    const m = marks[s.id];
    return (
      <article key={s.id} className={`bl-card${m === 'done' ? ' done' : ''}`}>
        <div className="bl-top">
          <div>
            <h4 className="bl-name">{s.name}</h4>
            <div className="bl-kind">{s.kind}</div>
          </div>
          {m ? <span className="bl-pill">{m === 'saved' ? 'Saved' : 'Done'}</span> : !s.checked && <span className="bl-pill warn" title="Current dates and terms were not checked">Not checked</span>}
        </div>
        <div className="bl-block">
          <span className="bl-label">Why it fits</span>
          <p className="bl-text">{s.why}</p>
        </div>
        <div className="bl-block">
          <span className="bl-label">Before you go</span>
          <p className="bl-text">{s.tip}</p>
        </div>
        <div className="bl-actions">
          <a className="btn btn-sm btn-primary" href={s.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} />Open</a>
          <button className="btn btn-sm" aria-pressed={m === 'saved'} onClick={() => mark(s.id, 'saved')}><Bookmark size={13} />{m === 'saved' ? 'Saved' : 'Save'}</button>
          <button className="btn btn-sm" aria-pressed={m === 'done'} onClick={() => mark(s.id, 'done')}><Check size={13} />{m === 'done' ? 'Done' : 'Mark done'}</button>
        </div>
      </article>
    );
  };

  return (
    <div className="bl">
      <style>{CSS}</style>
      <div className="bl-start">
        <div>
          <b>Start with Show HN</b>
          <span>It needs no application and no equity, and the traction it brings is what the accelerators below ask for.</span>
        </div>
      </div>

      <section className="bl-sec">
        <h3>Get Baton noticed</h3>
        <p>Places to launch, in the order I would use them.</p>
        <div className="bl-grid">{LAUNCH.map(card)}</div>
      </section>

      <section className="bl-sec">
        <h3>Investors and accelerators</h3>
        <p>Approach these after a launch, once there is some traction to show.</p>
        <div className="bl-grid">{INVEST.map(card)}</div>
      </section>

      <p className="bl-foot">Dates, terms and deadlines change. Confirm everything on each official page before you apply.</p>
    </div>
  );
}
