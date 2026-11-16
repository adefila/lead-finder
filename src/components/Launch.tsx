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
  { id: 'peerlist', name: 'Peerlist Launchpad', kind: 'Launch board', why: 'Reported as free to launch with a verified personal profile. Paid featured launches start at $29.', tip: 'Use the free launch only and skip the paid featured slot. Fill in your profile first.', url: 'https://peerlist.io/launchpad', checked: true },
];

const PITCH: Spot[] = [
  { id: 'framerexperts', name: 'Framer Experts directory', kind: 'Freelancers and agencies', why: 'Framer lists freelancers and agencies that build client sites in Framer. Handover to a client is exactly their problem.', tip: 'Free to browse. Pick ones with several client sites, email them, and ask them to try Baton on one site and tell you what breaks.', url: 'https://www.framer.com/community/experts/', checked: false },
  { id: 'clutch', name: 'Clutch web developer directory', kind: 'Agencies that build custom sites', why: 'Agencies that build custom sites for clients, with their size, clients and a link to their own site.', tip: 'Free to browse. Look for small agencies, find the owner on their own site, and offer them a free trial on one client project.', url: 'https://clutch.co/web-developers', checked: false },
  { id: 'rframer', name: 'r/Framer', kind: 'Reddit, Framer builders', why: 'People who build client sites in Framer, often asking how to let clients edit them.', tip: 'Answer a real question first. Mention Baton only where it solves what they asked, and read the rules on promotion.', url: 'https://www.reddit.com/r/Framer/', checked: false },
  { id: 'rwebflow', name: 'r/webflow', kind: 'Reddit, Webflow builders', why: 'Webflow freelancers and agencies, who deal with client editing all the time.', tip: 'Same approach as r/Framer: help first, mention Baton where it fits. Read the rules first.', url: 'https://www.reddit.com/r/webflow/', checked: false },
  { id: 'rnocode', name: 'r/nocode', kind: 'Reddit, no-code builders', why: 'People who build sites and apps without much code, and the agencies that sell that work.', tip: 'Read the rules on promotion before you post anything.', url: 'https://www.reddit.com/r/nocode/', checked: false },
  { id: 'cursorforum', name: 'Cursor forum', kind: 'Developers who build with AI', why: 'Developers building client sites with AI tools. A site built with AI still needs a way for the client to edit it.', tip: 'Free to join. Ask a question or share a lesson before you mention Baton.', url: 'https://forum.cursor.com/', checked: false },
  { id: 'linkedinagency', name: 'LinkedIn, agency owners', kind: 'Direct outreach', why: 'Owners of small web and design agencies, found by searching, who can say yes without a committee.', tip: 'Searching and a connection request with a short note are free. Offer a free trial on one client site, not a pitch.', url: 'https://www.linkedin.com/search/results/people/?keywords=web%20agency%20founder', checked: false },
];

const SHOUT: Spot[] = [
  { id: 'hnworking', name: 'Ask HN: What are you working on?', kind: 'Hacker News thread', why: 'A monthly thread where people post what they are building, and one comment is enough.', tip: 'Free. Find the current month\'s thread with the link, then add one plain comment with what Baton does and the link.', url: 'https://hn.algolia.com/?dateRange=pastMonth&query=%22what%20are%20you%20working%20on%22&sort=byDate&type=story', checked: false },
  { id: 'ihworking', name: 'Indie Hackers: what are you working on', kind: 'Community thread', why: 'Founders post what they are working on in recurring threads and reply to each other.', tip: 'Free. Find the latest "What are you working on" thread on the site and leave a comment.', url: 'https://www.indiehackers.com/', checked: false },
  { id: 'showoffsat', name: 'r/webdev Showoff Saturday', kind: 'Reddit weekly thread', why: 'Developers share what they made in a weekly thread.', tip: 'Free. Post only in the weekly thread. Sources disagree on whether commercial tools are allowed, so read the sidebar first.', url: 'https://www.reddit.com/r/webdev/', checked: false },
  { id: 'rstartups', name: 'r/startups share thread', kind: 'Reddit thread', why: 'A thread for founders to share what they are building.', tip: 'Free. New accounts may be blocked, so check the rules and the age and karma limits first.', url: 'https://www.reddit.com/r/startups/', checked: false },
  { id: 'buildinpublic', name: '#buildinpublic on X', kind: 'Social, replies', why: 'Founders reply to each other\'s updates under the tag, and a useful reply gets noticed.', tip: 'Free. Reply to builders with something helpful, and post your own short update with a clip of the editor.', url: 'https://x.com/search?q=%23buildinpublic&f=live', checked: false },
];

const POST: Spot[] = [
  { id: 'betalist', name: 'BetaList', kind: 'Directory for early products', why: 'Reported as a free place to list a product before launch and collect early sign-ups.', tip: 'Use the free submission only. It is slower, and the paid fast lane is not needed.', url: 'https://betalist.com/', checked: true },
  { id: 'saashub', name: 'SaaSHub', kind: 'Software directory', why: 'A software directory where people compare alternatives. Reported as slow but steady for organic leads.', tip: 'Use the free listing only. List Baton against the tools clients use now, such as page builders with editors.', url: 'https://www.saashub.com/', checked: true },
  { id: 'microlaunch', name: 'Microlaunch', kind: 'Launch board for small products', why: 'Reported as a free launch board aimed at indie and micro-SaaS products.', tip: 'Not checked in detail. Read the current rules before you submit.', url: 'https://microlaunch.net/', checked: false },
  { id: 'stackshare', name: 'StackShare', kind: 'Developer tool directory', why: 'Developers look here to see which tools teams use.', tip: 'Add Baton as a tool and list the stack it sits on.', url: 'https://stackshare.io/', checked: false },
  { id: 'altto', name: 'AlternativeTo', kind: 'Software directory', why: 'People searching for an alternative to a tool find it here.', tip: 'Pick the closest tools, and word the listing around what clients can edit without a developer.', url: 'https://alternativeto.net/', checked: false },
  { id: 'sideproject', name: 'r/SideProject', kind: 'Reddit community', why: 'People share what they built and give direct feedback.', tip: 'Read the subreddit rules first. Show what it does, do not just link it.', url: 'https://www.reddit.com/r/SideProject/', checked: false },
  { id: 'saasreddit', name: 'r/SaaS', kind: 'Reddit community', why: 'Founders compare notes on pricing, launches and early customers.', tip: 'Read the rules on self-promotion before you post.', url: 'https://www.reddit.com/r/SaaS/', checked: false },
  { id: 'devto', name: 'DEV Community', kind: 'Write-up', why: 'Developers read build stories here, and agencies are among them.', tip: 'Write how Baton works under the hood, not a sales post. Link to the site at the end.', url: 'https://dev.to/', checked: false },
  { id: 'hashnode', name: 'Hashnode', kind: 'Write-up', why: 'Another developer blogging platform with its own audience.', tip: 'Post the same story as DEV with a different opening, so the two do not read as copies.', url: 'https://hashnode.com/', checked: false },
];

const EVENTS: Spot[] = [
  { id: 'devpost', name: 'Devpost hackathons', kind: 'Hackathon listings, free to enter', why: 'The main place to find online hackathons you can enter alone or with a team.', tip: 'Filter for online and for open dates. Judges and sponsors see your project page.', url: 'https://devpost.com/hackathons', checked: true },
  { id: 'devweek', name: 'DeveloperWeek 2027 Hackathon', kind: 'Online hackathon', why: 'Reported as online from 25 January to 11 February 2027, with awards in Santa Clara.', tip: 'You must register on Devpost before it starts. Check the challenges to see if Baton fits one.', url: 'https://developerweek-2027-hackathon.devpost.com/', checked: true },
  { id: 'lablab', name: 'lablab.ai', kind: 'AI hackathons', why: 'Runs online AI hackathons with sponsor credits. Useful if you add an AI feature to Baton.', tip: 'Not checked. Confirm each hackathon is free to enter before you join.', url: 'https://lablab.ai/', checked: false },
];

const INVEST: Spot[] = [
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
  const doneCount = [...LAUNCH, ...PITCH, ...SHOUT, ...POST, ...EVENTS, ...INVEST].filter(s => marks[s.id] === 'done').length;
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
        <h3>Developers and agencies to pitch</h3>
        <p>People who build custom client sites or use AI to do it. Ask them to try Baton on one real site and tell you what breaks.</p>
        {visible(PITCH).length ? <div className="bl-grid">{visible(PITCH).map(card)}</div> : <p className="bl-empty">All of these are done.</p>}
      </section>

      <section className="bl-sec">
        <h3>Put it out there</h3>
        <p>Threads and tags where a short comment or reply is enough. All free.</p>
        {visible(SHOUT).length ? <div className="bl-grid">{visible(SHOUT).map(card)}</div> : <p className="bl-empty">All of these are done.</p>}
      </section>

      <section className="bl-sec">
        <h3>More places to post</h3>
        <p>Directories, communities and write-ups. Most take an hour or less each.</p>
        {visible(POST).length ? <div className="bl-grid">{visible(POST).map(card)}</div> : <p className="bl-empty">All of these are done.</p>}
      </section>

      <section className="bl-sec">
        <h3>Hackathons</h3>
        <p>Online hackathons that are free to enter. Check each one before you join.</p>
        {visible(EVENTS).length ? <div className="bl-grid">{visible(EVENTS).map(card)}</div> : <p className="bl-empty">All of these are done.</p>}
      </section>

      <section className="bl-sec">
        <h3>Investors and accelerators</h3>
        <p>Approach these after a launch, once there is some traction to show.</p>
        {visible(INVEST).length ? <div className="bl-grid">{visible(INVEST).map(card)}</div> : <p className="bl-empty">All of these are done.</p>}
      </section>

      {doneCount > 0 && (
        <p className="bl-foot"><button className="link-btn" onClick={() => setShowDone(v => !v)}>{showDone ? 'Hide' : 'Show'} the {doneCount} you marked done</button></p>
      )}

      <p className="bl-foot">Everything here is meant to cost nothing. Terms change, so confirm that on each page before you submit, and skip any paid option it offers.</p>
    </div>
  );
}
