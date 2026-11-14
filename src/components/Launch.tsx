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
  { id: 'devhunt', name: 'DevHunt', kind: 'Launch board for dev tools', why: 'A weekly launch board only for developer tools, voted on by developers who sign in with GitHub or Google.', tip: 'Reported as free. Confirm the current terms on the site.', url: 'https://devhunt.org/', checked: true },
  { id: 'peerlist', name: 'Peerlist Launchpad', kind: 'Launch board', why: 'Reported as free to launch with a verified personal profile. Paid featured launches start at $29.', tip: 'Fill in your profile first. Confirm the current terms on the site.', url: 'https://peerlist.io/launchpad', checked: true },
];

const INVEST: Spot[] = [
  { id: 'fi', name: 'Founder Institute', kind: 'Accelerator, Africa', why: 'Takes solo founders and small teams at idea or pre-seed stage.', tip: 'Takes 4% equity to its shared pool. Read the terms first.', url: 'https://allbusiness.africa/programs/founder-institute-africa', checked: true },
  { id: 'swg', name: 'Startup Wise Guys', kind: 'Accelerator, Africa', why: 'B2B SaaS programme for East and West Africa.', tip: 'Wants a strong team and early traction, so launch first.', url: 'https://startupwiseguys.com/location/africa/', checked: true },
  { id: 'yc', name: 'Y Combinator', kind: 'Accelerator', why: 'Biggest name for developer tools, and solo founders can apply.', tip: 'Current batch dates not checked. Traction from a launch helps.', url: 'https://www.ycombinator.com/apply', checked: false },
  { id: 'antler', name: 'Antler', kind: 'Accelerator', why: 'Invests at the earliest stage and has an Africa presence.', tip: 'Current programme and location not checked.', url: 'https://www.antler.co/', checked: false },
  { id: 'techstars', name: 'Techstars', kind: 'Accelerator', why: 'Programmes by region and theme.', tip: 'Current programmes not checked.', url: 'https://www.techstars.com/', checked: false },
  { id: 'tinyseed', name: 'TinySeed', kind: 'Fund for bootstrapped SaaS', why: 'Backs small SaaS companies that stay independent, which suits a solo founder.', tip: 'It just raised a fourth fund. Application terms not checked.', url: 'https://tinyseed.com/', checked: false },
  { id: 'ng350', name: 'Nigeria $350,000 programme', kind: 'Funding, Nigeria', why: 'A funding programme for early-stage tech startups in Nigeria.', tip: 'Dates and whether software products qualify not checked.', url: 'https://www.techinafrica.com/nigeria-opens-350000-funding-programme-for-early-stage-tech-startups/', checked: false },
  { id: 'seedinvest', name: 'SEEDINVEST 2026', kind: 'Accelerator, Nigeria', why: 'Grants, training, mentorship and investor readiness for young Nigerian entrepreneurs.', tip: 'Reported as open for 2026. Deadline and whether SaaS qualifies not checked.', url: 'https://www.wearetech.africa/en/fils-uk/brief/brief-one/nigeria-s-seedinvest-accelerator-opens-applications-for-2026-cohort', checked: false },
  { id: 'ffvs', name: 'Fast Forward Venture Studio', kind: 'Pre-seed accelerator', why: 'Listed as offering up to $25,000 in equity-free funding at pre-seed.', tip: 'Listing is from an aggregator and has no dates. Check the programme itself.', url: 'https://incubatorlist.com/top-startup-accelerators-incubators-and-vcs-in-nigeria', checked: false },
  { id: 'freshmango', name: 'Freshmango', kind: 'Remote pre-seed accelerator', why: 'Fully remote, for founders with an idea or a minimal product.', tip: 'No 2026 window found. Check the programme itself.', url: 'https://techbuild.africa/freshmango-accelerator-remote-stage-founders/', checked: false },
];

const CSS = `
  .bl { padding: 20px 20px 8px; }
  .bl-start { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; margin-bottom: 28px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
  .bl-start b { display: block; font-size: 14px; color: var(--fg); margin-bottom: 2px; }
  .bl-start span { font-size: 13px; color: var(--fg-3); line-height: 1.5; }
  .bl-sec { margin-bottom: 32px; }
  .bl-sec h3 { margin: 0 0 4px; font-size: 15px; font-weight: 600; color: var(--fg); }
  .bl-sec > p { margin: 0 0 14px; font-size: 13px; color: var(--fg-3); }
  .bl-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  @media (max-width: 1000px) { .bl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
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
  .bl-empty { margin: 0 !important; font-size: 13px; color: var(--fg-3); }
  .bl-foot { margin: 0; padding: 4px 0 20px; font-size: 12px; color: var(--fg-3); }
  @media (max-width: 720px) { .bl { padding: 16px 12px 4px; } .bl-start { flex-direction: column; align-items: flex-start; } .bl-grid { grid-template-columns: minmax(0, 1fr); } }
`;

function load(): Record<string, Mark> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Mark>; } catch { return {}; }
}

// Where to put Baton in front of people: launch venues first, investors and accelerators second.
export function Launch() {
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [showDone, setShowDone] = useState(false);
  useEffect(() => { setMarks(load()); }, []);
  const doneCount = [...LAUNCH, ...INVEST].filter(s => marks[s.id] === 'done').length;
  const visible = (list: Spot[]) => showDone ? list : list.filter(s => marks[s.id] !== 'done');

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
      {marks.showhn !== 'done' && (
        <div className="bl-start">
          <div>
            <b>Start with Show HN</b>
            <span>It needs no application and no equity, and the traction it brings is what the accelerators below ask for.</span>
          </div>
        </div>
      )}

      <section className="bl-sec">
        <h3>Get Baton noticed</h3>
        <p>Places to launch, in the order I would use them.</p>
        {visible(LAUNCH).length ? <div className="bl-grid">{visible(LAUNCH).map(card)}</div> : <p className="bl-empty">All of these are done.</p>}
      </section>

      <section className="bl-sec">
        <h3>Investors and accelerators</h3>
        <p>Approach these after a launch, once there is some traction to show.</p>
        {visible(INVEST).length ? <div className="bl-grid">{visible(INVEST).map(card)}</div> : <p className="bl-empty">All of these are done.</p>}
      </section>

      {doneCount > 0 && (
        <p className="bl-foot"><button className="link-btn" onClick={() => setShowDone(v => !v)}>{showDone ? 'Hide' : 'Show'} the {doneCount} you marked done</button></p>
      )}

      <p className="bl-foot">Dates, terms and deadlines change. Confirm everything on each official page before you apply.</p>
    </div>
  );
}
