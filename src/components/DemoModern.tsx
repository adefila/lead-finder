'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import {
  ArrowRight, ArrowUp, ArrowUpRight, BarChart3, Check, CircleAlert, CircleHelp, Clock, ListChecks, Globe, Handshake, Layers, Link2, MapPin, MessageSquareQuote,
  Minus, Newspaper, Plus, Puzzle, Quote, Route, Trophy, type LucideIcon,
} from 'lucide-react';
import { MOCK_VARIANTS, Mock, mockItems } from '@/components/DemoMock';
import Lenis from 'lenis';
import type { DemoContent } from '@/lib/demo';
import { EASE, Count, Line, Picture, Pins, pad, reveal } from '@/components/DemoSite';

// The Modern look: calm, centred, rounded. Flat colour, faint patterns instead of gradients, soft shadows, lucide icons.
// A deep shade of the brand colour for the hero, services, call-to-action and footer, a light tint for soft sections, and
// buttons with white text on a dark shade of the brand colour. Optional sections appear only when the site gives the material.

function Fact({ value, reduce }: { value: string; reduce: boolean }) {
  const m = value.match(/^(\d{1,3})(.*)$/);
  return m ? <><Count to={Number(m[1])} reduce={reduce} />{m[2]}</> : <>{value}</>;
}

const Badge = ({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) => <span className="mm-badge"><Icon size={14} aria-hidden />{children}</span>;
const FLAT_PNG = /\.png(\?|$)/i;
const PAIN_ICONS: LucideIcon[] = [Clock, Puzzle, CircleAlert];
// How many of the six columns each service card takes, so the grid always fills its rows.
const bentoSpans = (n: number): number[] => (n <= 2 ? [3, 3] : n === 3 ? [3, 3, 6] : n === 4 ? [4, 2, 2, 4] : [3, 3, 2, 2, 2]);

// A card that floats at its own pace as the statement scene scrolls past.
function Float({ p, from, to, reduce, className, children }: { p: MotionValue<number>; from: number; to: number; reduce: boolean; className: string; children: React.ReactNode }) {
  const y = useTransform(p, [0, 1], [from, to]);
  return <motion.div className={`mm-float ${className}`} style={{ y: reduce ? 0 : y }}>{children}</motion.div>;
}

export function DemoModern({ c, yesHref, waHref }: { c: DemoContent; yesHref: string | null; waHref: string | null }) {
  const reduce = !!useReducedMotion();
  const b = c.brand;
  const style = {
    ['--accent' as string]: b.accent, ['--ink' as string]: b.accentInk, ['--lit' as string]: b.accentLit, ['--deep' as string]: b.deep, ['--deep2' as string]: b.deep2,
    ['--tint' as string]: b.tint, ['--btn' as string]: b.btn, ['--btn-hover' as string]: b.btnHover,
  } as React.CSSProperties;
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '-');
  const img = (k: 'hero' | 'band' | 'side') => c.images[k] ?? c.images.hero ?? c.images.band ?? c.images.side;
  const photos = [c.images.hero, c.images.side, c.images.band].filter((u): u is string => !!u && !FLAT_PNG.test(u));
  const photo = (i: number) => (photos.length ? photos[i % photos.length] : null);
  const quote = c.quotes[0];
  const first = c.levels[0];

  useEffect(() => {
    if (reduce) return;
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    let raf = requestAnimationFrame(function loop(t) { lenis.raf(t); raf = requestAnimationFrame(loop); });
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, [reduce]);

  // hero
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: hp } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroCardY = useTransform(hp, [0, 1], ['0%', '-8%']);

  // statement scene
  const sceneRef = useRef<HTMLElement>(null);
  const { scrollYProgress: sp } = useScroll({ target: sceneRef, offset: ['start start', 'end end'] });
  const words = c.statement.split(' ');
  const hi = c.highlight.toLowerCase().replace(/[^a-z]/g, '');

  // workflow
  const [wf, setWf] = useState(0);
  const wfRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (!c.process.length) return;
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setWf(Number((e.target as HTMLElement).dataset.i)); }), { rootMargin: '-45% 0px -45% 0px' });
    wfRefs.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, [c.process.length]);

  const [need, setNeed] = useState(0);
  const [voice, setVoice] = useState(0);
  const [open, setOpen] = useState<number | null>(0);
  const coverRef = useRef<HTMLDivElement>(null);
  const coverSeen = useInView(coverRef, { once: true, margin: '0px 0px -20% 0px' });
  const goTop = () => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  const reassure = c.micro ? c.micro.split('·').map(s => s.trim()).filter(Boolean) : [];

  return (
    <div className="mm" style={style}>
      <header className="mm-nav">
        <div className="mm-wrap mm-nav-in">
          <a className="mm-logo" href="#top"><span className="mm-logo-mark" aria-hidden>{b.word.charAt(0)}</span>{b.word}</a>
          <nav aria-label="Sections">{c.nav.map(n => <a key={n} href={`#${slug(n)}`}>{n}</a>)}</nav>
          <a className="mm-btn mm-btn-white" href="#contact">Get in touch</a>
        </div>
      </header>

      <section className="mm-hero" id="top" ref={heroRef}>
        <div className="mm-vlines" aria-hidden />
        <div className="mm-wrap mm-hero-in">
          {c.trust && <motion.p className="mm-chip" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1, ease: EASE }}>{c.trust}</motion.p>}
          <h1 className="mm-h1">{c.hero.lines.map((l, i) => <Line key={l} text={l} delay={0.2 + i * 0.2} reduce={reduce} />)}</h1>
          <motion.p className="mm-sub" initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.8, ease: EASE }}>{c.hero.sub}</motion.p>
          <motion.div className="mm-btns" initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.95, ease: EASE }}>
            <a className="mm-btn mm-btn-primary" href="#contact">{c.hero.cta}<ArrowRight size={16} className="mm-arrow" aria-hidden /></a>
            <a className="mm-btn mm-btn-ghost" href="#services">{c.hero.secondary}</a>
          </motion.div>
          {reassure.length > 0 && (
            <motion.ul className="mm-reassure" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 1.15 }}>
              {reassure.map(r => <li key={r}><Check size={14} aria-hidden />{r}</li>)}
            </motion.ul>
          )}
        </div>

        <motion.div className="mm-wrap mm-hero-cards" style={{ y: reduce ? 0 : heroCardY }} initial={reduce ? false : { opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 1.2, ease: EASE }}>
          <div className={`mm-card-big${img('hero') && !FLAT_PNG.test(img('hero') ?? '') ? '' : ' has-mock'}`}>
            {img('hero') && !FLAT_PNG.test(img('hero') ?? '')
              ? <Picture src={img('hero')} alt={b.name} reduce={reduce} className="mm-card-pic" />
              : <div className="mm-card-mock mm-pat-dots-dark" aria-hidden><Mock variant="list" title={c.names.levels} items={c.levels.slice(0, 4).map(l => l.name)} reduce={reduce} /></div>}
            <div className="mm-card-cap"><h2>{c.levelsTitle}</h2>{first && <p>{first.body}</p>}</div>
          </div>
          <div className="mm-card-glass">
            {quote ? (
              <>
                <Quote size={26} className="mm-qicon" aria-hidden />
                <blockquote>{quote.text}</blockquote>
                <p className="mm-who"><b>{quote.name}</b><span>{quote.company}</span></p>
              </>
            ) : c.facts[0] ? (
              <>
                <span className="mm-fact-label">{c.facts[0].label}</span>
                <p className="mm-fact-big"><Fact value={c.facts[0].value} reduce={reduce} /></p>
                <p className="mm-fact-note">{c.facts[0].note}</p>
              </>
            ) : null}
          </div>
        </motion.div>
      </section>

      {c.clients.length > 0 && (
        <section className="mm-clients" aria-label="Clients">
          <p>Clients include</p>
          <div className="mm-marquee" aria-hidden>
            <div className="mm-marquee-track">{[...c.clients, ...c.clients, ...c.clients, ...c.clients].map((n, i) => <span key={i}>{n}</span>)}</div>
          </div>
        </section>
      )}

      {/* The problem: what the customer is up against, three plain points, then a line that leads into the services */}
      {c.problem?.points.length > 0 && c.problem.title && (
        <section className="mm-sec">
          <div className="mm-wrap">
            <div className="mm-center"><Badge icon={CircleAlert}>{c.problem.badge}</Badge></div>
            <motion.h2 className="mm-h2 mm-center" {...reveal(reduce)}>{c.problem.title}</motion.h2>
            {c.problem.body && <motion.p className="mm-lead mm-center" {...reveal(reduce, 0.06)}>{c.problem.body}</motion.p>}
            <div className="mm-pains">
              {c.problem.points.map((p, i) => {
                const Icon = PAIN_ICONS[i % PAIN_ICONS.length];
                return (
                  <motion.div key={p.title} className="mm-pain" {...reveal(reduce, i * 0.1)} whileHover={reduce ? undefined : { y: -6 }}>
                    <span className="mm-pain-icon"><Icon size={20} aria-hidden /></span>
                    <span className="mm-pain-n">{pad(i + 1)}</span>
                    <h3>{p.title}</h3>
                    <p>{p.body}</p>
                  </motion.div>
                );
              })}
            </div>
            {c.problem.bridge && <motion.p className="mm-bridge mm-center" {...reveal(reduce, 0.1)}>{c.problem.bridge}</motion.p>}
          </div>
        </section>
      )}

      {/* The picker: the visitor chooses what they need, and the page answers in the business's own words */}
      {c.levels.length > 1 && (
        <section className="mm-sec mm-soft mm-pat-grid" id="need">
          <div className="mm-wrap">
            <div className="mm-center"><Badge icon={ListChecks}>Try it</Badge></div>
            <motion.h2 className="mm-h2 mm-center" {...reveal(reduce)}>What do you need?</motion.h2>
            <motion.p className="mm-lead mm-center" {...reveal(reduce, 0.06)}>Pick one and see how {b.word} answers it.</motion.p>
            <motion.div className="mm-pick" {...reveal(reduce, 0.1)}>
              <div className="mm-pick-list" role="tablist" aria-label={c.names.levels}>
                {c.levels.map((l, i) => (
                  <button key={l.name} role="tab" aria-selected={need === i} className={need === i ? 'on' : ''} onClick={() => setNeed(i)}>
                    <span className="mm-pick-n">{pad(i + 1)}</span>{l.name}<ArrowRight size={16} aria-hidden />
                  </button>
                ))}
              </div>
              <div className="mm-pick-card" role="tabpanel">
                <AnimatePresence mode="wait">
                  <motion.div key={need} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: EASE }}>
                    <span className="mm-tag">{c.names.prefix}{need + 1}</span>
                    <h3>{c.levels[need].name}</h3>
                    <p>{c.levels[need].body}</p>
                    <ul>{mockItems(c.levels[need].pins.map(p => p.label), c.levels[need].body, c.levels[need].name).slice(0, 4).map(t => <li key={t}><span className="mm-tick"><Check size={12} strokeWidth={3} aria-hidden /></span>{t}</li>)}</ul>
                    <a className="mm-btn mm-btn-primary" href="#contact">Ask about {c.levels[need].name.toLowerCase()}<ArrowRight size={16} className="mm-arrow" aria-hidden /></a>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {c.facts.length > 0 && (
        <section className="mm-sec mm-soft mm-pat-grid" id={slug(c.nav[0] ?? 'about')}>
          <div className="mm-wrap">
            <div className="mm-center"><Badge icon={BarChart3}>At a glance</Badge></div>
            <motion.h2 className="mm-h2 mm-center" {...reveal(reduce)}>{c.factsTitle || c.whyTitle}</motion.h2>
            {c.factsSub && <motion.p className="mm-lead mm-center" {...reveal(reduce, 0.06)}>{c.factsSub}</motion.p>}
            <div className="mm-facts">
              {c.facts.map((f, i) => (
                <motion.div key={f.label} className="mm-fact" style={{ marginTop: i === 1 ? 28 : i === 2 ? 56 : 0 }} {...reveal(reduce, i * 0.1)} whileHover={reduce ? undefined : { y: -6 }}>
                  <span className="mm-tag">{f.label}</span>
                  <p className="mm-num"><Fact value={f.value} reduce={reduce} /></p>
                  <p className="mm-note">{f.note}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* The scene: one sentence in the middle, cards from the business's own material drifting round it as you scroll */}
      {c.statement && (
        <section className="mm-scene" ref={sceneRef}>
          <div className="mm-scene-stage">
            <p className="mm-scene-text">
              {words.map((w, i) => <span key={i} className={w.toLowerCase().replace(/[^a-z]/g, '') === hi ? 'mm-hi' : ''}>{w} </span>)}
            </p>
            {photo(0) && <Float p={sp} from={50} to={-80} reduce={reduce} className="mm-f1"><div className="mm-fphoto">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={photo(0)!} alt="" referrerPolicy="no-referrer" loading="lazy" /></div></Float>}
            {c.levels.length > 1 && (
              <Float p={sp} from={90} to={-60} reduce={reduce} className="mm-f2">
                <div className="mm-fcard">
                  <p className="mm-fcard-head">{c.names.levels}</p>
                  <ul>{c.levels.slice(0, 3).map(l => <li key={l.name}><span className="mm-tick"><Check size={12} strokeWidth={3} aria-hidden /></span>{l.name}</li>)}</ul>
                </div>
              </Float>
            )}
            {c.facts[0] && (
              <Float p={sp} from={30} to={-110} reduce={reduce} className="mm-f3">
                <div className="mm-fdark"><span>{c.facts[0].label}</span><p><Fact value={c.facts[0].value} reduce={reduce} /></p><small>{c.facts[0].note}</small></div>
              </Float>
            )}
            {photo(1) && (
              <Float p={sp} from={70} to={-70} reduce={reduce} className="mm-f4">
                <div className="mm-fphoto mm-fphoto-wide">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={photo(1)!} alt="" referrerPolicy="no-referrer" loading="lazy" />
                  {first && <div className="mm-fchips">{first.pins.slice(0, 2).map(p => <span key={p.label}>{p.label}</span>)}</div>}
                </div>
              </Float>
            )}
            <Float p={sp} from={10} to={-40} reduce={reduce} className="mm-f5">
              <a className="mm-finput" href="#contact"><span>{c.closing.cta}</span><span className="mm-finput-go"><ArrowRight size={16} aria-hidden /></span></a>
            </Float>
          </div>
        </section>
      )}

      {/* Services as alternating rows with ticked points */}
      {c.levels.length > 0 && (
        <section className="mm-sec mm-deep" id="services">
          <div className="mm-wrap">
            <div className="mm-center"><Badge icon={Layers}>{c.names.levels}</Badge></div>
            <motion.h2 className="mm-h2 mm-center" {...reveal(reduce)}>{c.levelsTitle}</motion.h2>
            <div className="mm-bento">
              {c.levels.map((l, i) => (
                <motion.article key={l.name} className={`mm-bcard mm-span-${bentoSpans(c.levels.length)[i] ?? 3}`} {...reveal(reduce, (i % 2) * 0.08)} whileHover={reduce ? undefined : { y: -6 }}>
                  <div className="mm-bcard-vis">
                    {img(l.image) && !FLAT_PNG.test(img(l.image) ?? '') && /* eslint-disable-next-line @next/next/no-img-element */ <img src={img(l.image)!} alt="" referrerPolicy="no-referrer" loading="lazy" />}
                    <Mock variant={MOCK_VARIANTS[i % MOCK_VARIANTS.length]} title={l.name} tag={`${c.names.prefix}${i + 1}`} items={mockItems(l.pins.map(p => p.label), l.body, l.name)} reduce={reduce} />
                  </div>
                  <div className="mm-bcard-copy">
                    <h3>{l.name}</h3>
                    <p>{l.body}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* The workflow: steps scroll past a picture that stays in view and changes with the step */}
      {c.process.length > 0 && (
        <section className="mm-sec mm-soft" id={slug(c.nav[1] ?? 'process')}>
          <div className="mm-wrap">
            <div className="mm-center"><Badge icon={Route}>{c.names.process}</Badge></div>
            <motion.h2 className="mm-h2 mm-center" {...reveal(reduce)}>{c.processTitle}</motion.h2>
            <div className="mm-wf">
              <div className="mm-wf-steps">
                {c.process.map((s, i) => (
                  <div key={s.title} className={`mm-wf-step${wf === i ? ' on' : ''}`} data-i={i} ref={el => { wfRefs.current[i] = el; }}>
                    <span className="mm-wf-n">{pad(i + 1)}</span>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                ))}
              </div>
              <div className="mm-wf-pic" aria-hidden>
                <AnimatePresence mode="wait">
                  <motion.div key={wf} className="mm-wf-frame" initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE }}>
                    {photo(wf)
                      ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={photo(wf)!} alt="" referrerPolicy="no-referrer" loading="lazy" />
                      : <div className="mm-wf-mock mm-pat-dots-dark"><Mock variant="steps" title={c.names.process} items={c.process.map(s => s.title)} active={wf} reduce={reduce} /></div>}
                    <span className="mm-wf-tag"><b>{pad(wf + 1)}</b>{c.process[wf]?.title}</span>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>
      )}

      {c.why.length > 0 && (
        <section className="mm-sec" id={slug(c.nav[2] ?? 'clients')}>
          <div className="mm-wrap">
            <motion.h2 className="mm-h2 mm-center" {...reveal(reduce)}>{c.whyTitle}</motion.h2>
            <div className="mm-why">
              {c.why.map((w, i) => (
                <motion.div key={w.title} className="mm-why-item" {...reveal(reduce, i * 0.08)}>
                  <span className="mm-dot" aria-hidden><Check size={16} strokeWidth={2.6} /></span>
                  <div><h3>{w.title}</h3><p>{w.body}</p></div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Client voices: tall cards, the chosen one opens wide */}
      {c.quotes.length > 0 && (
        <section className="mm-sec mm-soft">
          <div className="mm-wrap">
            <div className="mm-center"><Badge icon={MessageSquareQuote}>In their words</Badge></div>
            <motion.h2 className="mm-h2 mm-center" {...reveal(reduce)}>What clients say.</motion.h2>
            <motion.div className="mm-voices" {...reveal(reduce, 0.1)}>
              {c.quotes.map((q, i) => (
                <button key={q.name} className={`mm-voice${voice === i ? ' on' : ''}`} onClick={() => setVoice(i)} onMouseEnter={() => setVoice(i)} onFocus={() => setVoice(i)} aria-pressed={voice === i}>
                  {photo(i + 1) && /* eslint-disable-next-line @next/next/no-img-element */ <img className="mm-voice-bg" src={photo(i + 1)!} alt="" referrerPolicy="no-referrer" loading="lazy" />}
                  <span className="mm-voice-co">{q.company || q.name}</span>
                  <span className="mm-voice-body">
                    <Quote size={22} aria-hidden />
                    <span className="mm-voice-q">{q.text}</span>
                    <span className="mm-voice-who"><b>{q.name}</b>{q.company && <i>{q.company}</i>}</span>
                  </span>
                </button>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Optional: results the business publishes */}
      {c.results.length > 0 && (
        <section className="mm-sec mm-deep">
          <div className="mm-wrap">
            <div className="mm-center"><Badge icon={Trophy}>Results</Badge></div>
            <motion.h2 className="mm-h2 mm-center" {...reveal(reduce)}>Outcomes, in numbers.</motion.h2>
          </div>
          <div className="mm-results">
            {c.results.map((r, i) => (
              <motion.div key={r.label} className="mm-result" {...reveal(reduce, i * 0.08)}>
                {photo(i) && /* eslint-disable-next-line @next/next/no-img-element */ <img src={photo(i)!} alt="" referrerPolicy="no-referrer" loading="lazy" />}
                <span className="mm-result-client">{r.client}</span>
                <p className="mm-result-num">{r.value}</p>
                <p className="mm-result-label">{r.label}</p>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Optional: partners the business lists */}
      {c.partners.length > 0 && (
        <section className="mm-sec">
          <div className="mm-wrap">
            <div className="mm-center"><Badge icon={Handshake}>Partners</Badge></div>
            <motion.h2 className="mm-h2 mm-center" {...reveal(reduce)}>Works with the people you already use.</motion.h2>
            <div className="mm-partners">
              {c.partners.map((p, i) => <motion.span key={`${p}-${i}`} className="mm-partner" {...reveal(reduce, (i % 6) * 0.05)}>{p}</motion.span>)}
            </div>
          </div>
        </section>
      )}

      {c.coverage.length > 0 && c.coverageTitle && img('band') && (
        <section className="mm-sec mm-soft mm-tight">
          <div className="mm-wrap" ref={coverRef}>
            <div className="mm-cover">
              <Picture src={img('band')} alt={c.coverageTitle} reduce={reduce} className="mm-cover-pic"><Pins pins={c.coverage} show={coverSeen} /></Picture>
              <motion.h2 className="mm-cover-title" {...reveal(reduce, 0.15)}>{c.coverageTitle}</motion.h2>
            </div>
          </div>
        </section>
      )}

      {/* Optional: articles the business has published */}
      {c.posts.length > 0 && (
        <section className="mm-sec mm-deep">
          <div className="mm-wrap">
            <div className="mm-center"><Badge icon={Newspaper}>From the blog</Badge></div>
            <motion.h2 className="mm-h2 mm-center" {...reveal(reduce)}>Recent reading.</motion.h2>
            <div className="mm-posts">
              {c.posts.map((p, i) => (
                <motion.a key={p.title} className="mm-post" href={p.url || '#'} target={p.url ? '_blank' : undefined} rel="noreferrer" {...reveal(reduce, i * 0.08)} whileHover={reduce ? undefined : { y: -6 }}>
                  <div className="mm-post-pic">{photo(i) ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={photo(i)!} alt="" referrerPolicy="no-referrer" loading="lazy" /> : <div className="dm-pattern" />}</div>
                  <h3>{p.title}</h3>
                  <span className="mm-post-go">Read<ArrowUpRight size={15} aria-hidden /></span>
                </motion.a>
              ))}
            </div>
          </div>
        </section>
      )}

      {c.faq.length > 0 && (
        <section className="mm-sec" id="faq">
          <div className="mm-wrap mm-faq">
            <div>
              <Badge icon={CircleHelp}>{c.names.faq}</Badge>
              <motion.h2 className="mm-h2" {...reveal(reduce)}>{c.faqTitle}</motion.h2>
            </div>
            <div className="mm-acc">
              {c.faq.map((f, i) => (
                <motion.div key={f.q} className={`mm-acc-item${open === i ? ' open' : ''}`} {...reveal(reduce, i * 0.06)}>
                  <button aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}><span>{f.q}</span>{open === i ? <Minus size={18} aria-hidden /> : <Plus size={18} aria-hidden />}</button>
                  <AnimatePresence initial={false}>
                    {open === i && <motion.div className="mm-acc-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }}><p>{f.a}</p></motion.div>}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mm-cta mm-pat-dots-dark" id="contact">
        <span className="mm-shape mm-shape-a" aria-hidden />
        <span className="mm-shape mm-shape-b" aria-hidden />
        <div className="mm-wrap mm-cta-in">
          <motion.h2 className="mm-h2 mm-h2-xl mm-center" {...reveal(reduce)}>{c.closing.title}</motion.h2>
          {c.closing.body && <motion.p className="mm-lead mm-center" {...reveal(reduce, 0.08)}>{c.closing.body}</motion.p>}
          <motion.form className="mm-form" onSubmit={e => e.preventDefault()} {...reveal(reduce, 0.14)}>
            {c.closing.fields.slice(0, 2).map(f => <label key={f}><span>{f}</span><input type={/mail/i.test(f) ? 'email' : 'text'} placeholder={f} /></label>)}
            <button type="submit" className="mm-btn mm-btn-primary mm-btn-xl">{c.closing.cta}<ArrowRight size={18} className="mm-arrow" aria-hidden /></button>
          </motion.form>
          {reassure.length > 0 && <ul className="mm-reassure mm-center-row">{reassure.map(r => <li key={r}><Check size={14} aria-hidden />{r}</li>)}</ul>}
          <p className="mm-micro">This is a concept, so the form does not send anywhere.</p>
        </div>
      </section>

      <footer className="mm-foot">
        <div className="mm-wrap">
          <div className="mm-foot-top">
            <div className="mm-foot-brand">
              <a className="mm-logo" href="#top"><span className="mm-logo-mark" aria-hidden>{b.word.charAt(0)}</span>{b.name}</a>
              {(c.footer.blurb || c.hero.sub) && <p className="mm-foot-blurb">{c.footer.blurb || c.hero.sub}</p>}
              <a className="mm-btn mm-btn-primary" href="#contact">{c.closing.cta}<ArrowRight size={16} className="mm-arrow" aria-hidden /></a>
            </div>
            <nav aria-label="Company">
              <p className="mm-foot-h">Company</p>
              <ul>{c.nav.map(n => <li key={n}><a href={`#${slug(n)}`}>{n}</a></li>)}<li><a href="#contact">Contact</a></li></ul>
            </nav>
            {c.levels.length > 0 && (
              <nav aria-label={c.names.levels}>
                <p className="mm-foot-h">{c.names.levels}</p>
                <ul>{c.levels.slice(0, 5).map(l => <li key={l.name}><a href="#services">{l.name}</a></li>)}</ul>
              </nav>
            )}
            <div>
              <p className="mm-foot-h">Contact</p>
              <ul className="mm-foot-contact">
                {c.footer.place && <li><MapPin size={16} aria-hidden />{c.footer.place}</li>}
                {c.footer.site && <li><Globe size={16} aria-hidden />{c.footer.site}</li>}
                {c.socials.map(s => <li key={s.name}><Link2 size={16} aria-hidden /><a href={s.url} target="_blank" rel="noreferrer" style={{ textTransform: 'capitalize' }}>{s.name}</a></li>)}
              </ul>
            </div>
          </div>
          <div className="mm-foot-base">
            <span>© {new Date().getFullYear()} {b.name}</span>
            <span>Concept by Samuel Adefila</span>
            <button className="mm-top" onClick={goTop}>Back to top<ArrowUp size={16} aria-hidden /></button>
          </div>
        </div>
      </footer>

      <div className="mm-concept" role="note">
        <span><b>Concept</b> for {b.name}, by Samuel Adefila. Not live.</span>
        <span className="mm-concept-actions">
          {yesHref && <a className="mm-pill" href={yesHref}>Reply YES</a>}
          {waHref && <a className="mm-pill mm-pill-ghost" href={waHref} target="_blank" rel="noreferrer">WhatsApp</a>}
        </span>
      </div>
    </div>
  );
}
