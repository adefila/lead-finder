'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useTransform, animate, type MotionValue } from 'motion/react';
import { ArrowLeft, ArrowRight, Diamond, Minus, Plus, Square, Triangle } from 'lucide-react';
import Lenis from 'lenis';
import type { DemoContent, Pin } from '@/lib/demo';

export const EASE = [0.22, 1, 0.36, 1] as const;
export const pad = (n: number) => String(n).padStart(2, '0');
// A PNG is usually a drawing or infographic on a transparent background: it is shown whole on a light panel, never cropped.
export const isPng = (u: string | null) => !!u && /\.png(\?|$)/i.test(u);

// Which sections sit on dark and which on paper, for each look. The page alternates so it never reads as one long slab.
const TONES = {
  console: { strip: 'dark', nav: 'dark', hero: 'dark', ticker: 'dark', statement: 'dark', levels: 'light', process: 'dark', why: 'light', cover: 'dark', faq: 'white', cta: 'dark', footer: 'dark' },
  blueprint: { strip: 'light', nav: 'light', hero: 'light', ticker: 'dark', statement: 'light', levels: 'dark', process: 'light', why: 'dark', cover: 'dark', faq: 'white', cta: 'dark', footer: 'dark' },
} as const;

export const reveal = (reduce: boolean, delay = 0) => ({
  initial: reduce ? false as const : { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-10% 0px' },
  transition: { duration: 0.8, delay, ease: EASE },
});

export function Line({ text, delay, reduce }: { text: string; delay: number; reduce: boolean }) {
  return (
    <span className="dm-line">
      {text.split(' ').map((w, i) => (
        <span className="dm-mask" key={i}>
          <motion.span className="dm-word" initial={reduce ? false : { y: '112%' }} animate={{ y: 0 }} transition={{ duration: 0.95, delay: delay + i * 0.07, ease: EASE }}>{w}&nbsp;</motion.span>
        </span>
      ))}
    </span>
  );
}

export function Count({ to, reduce }: { to: number; reduce: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const [n, setN] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!seen || reduce) return;
    const c = animate(0, to, { duration: 1.6, ease: EASE, onUpdate: v => setN(Math.round(v)) });
    return () => c.stop();
  }, [seen, to, reduce]);
  return <span ref={ref}>{n}</span>;
}

// A picture, uncovered as it scrolls into view, then drifting. The outer box is watched and the inner one clipped,
// because a clipped element is never "in view" to the browser. With no picture it shows a drawn pattern instead.
export function Picture({ src, alt, className, reduce, ratio, children }: { src: string | null; alt: string; className?: string; reduce: boolean; ratio?: string; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-7%', '7%']);
  const seen = useInView(ref, { once: true, margin: '0px 0px -8% 0px' });
  return (
    <div ref={ref} className={`dm-pic ${className ?? ''}`} style={ratio ? { aspectRatio: ratio } : undefined}>
      <motion.div className="dm-pic-in" initial={reduce ? false : { clipPath: 'inset(0 0 100% 0)' }} animate={{ clipPath: seen || reduce ? 'inset(0 0 0% 0)' : 'inset(0 0 100% 0)' }} transition={{ duration: 1.1, ease: EASE }}>
        {src
          ? /* eslint-disable-next-line @next/next/no-img-element */ <motion.img className={isPng(src) ? 'dm-contain' : undefined} src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" style={{ y: reduce || isPng(src) ? 0 : y }} />
          : <div className="dm-pattern" aria-hidden />}
      </motion.div>
      {children}
    </div>
  );
}

export function Pins({ pins, show }: { pins: Pin[]; show: boolean }) {
  return (
    <>
      {pins.map((p, i) => (
        <motion.span key={p.label} className="dm-pin" style={{ left: `${p.x}%`, top: `${p.y}%` }}
          initial={{ opacity: 0, scale: 0.6 }} animate={show ? { opacity: 1, scale: 1 } : {}} transition={{ duration: 0.6, delay: 0.5 + i * 0.18, ease: EASE }}>
          <i /><b>{p.label}</b>
        </motion.span>
      ))}
    </>
  );
}

function Glow({ word, i, n, p }: { word: string; i: number; n: number; p: MotionValue<number> }) {
  const start = (i / n) * 0.7;
  const opacity = useTransform(p, [start, start + 0.14], [0.16, 1]);
  return <motion.span style={{ opacity }} className="dm-glow-word">{word} </motion.span>;
}

function Statement({ text, idx, tone, reduce }: { text: string; idx: string; tone: string; reduce: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 55%'] });
  const words = text.split(' ');
  return (
    <section className={`dm-statement t-${tone}`} ref={ref}>
      <div className="dm-wrap">
        <p className="dm-idx">{idx}</p>
        <p className="dm-display dm-statement-text">
          {words.map((w, i) => reduce ? <span key={i}>{w} </span> : <Glow key={i} word={w} i={i} n={words.length} p={scrollYProgress} />)}
        </p>
      </div>
    </section>
  );
}

function SplitButton({ label, href, variant = 'solid' }: { label: string; href: string; variant?: 'solid' | 'outline' }) {
  return (
    <a className={`dm-split dm-split-${variant}`} href={href}>
      <span>{label}</span><span className="dm-split-arrow" aria-hidden><ArrowRight size={16} /></span>
    </a>
  );
}

export function DemoSite({ c, yesHref, waHref }: { c: DemoContent; yesHref: string | null; waHref: string | null }) {
  const reduce = !!useReducedMotion();
  const T = TONES[c.look === 'blueprint' ? 'blueprint' : 'console'];
  const years = c.since ? new Date().getFullYear() - c.since : null;
  const style = { ['--accent' as string]: c.brand.accent, ['--accent-ink' as string]: c.brand.accentInk, ['--accent-lit' as string]: c.brand.accentLit, ['--on-accent' as string]: c.brand.onAccent, ['--btn' as string]: c.brand.btn, ['--btn-hover' as string]: c.brand.btnHover } as React.CSSProperties;
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '-');
  const N = c.names;
  const photo = (u: string | null) => (u && !isPng(u) ? u : null);
  const firstImage = photo(c.images.hero) ?? photo(c.images.band) ?? photo(c.images.side) ?? c.images.hero ?? c.images.band ?? c.images.side;
  const imgOf = (k: 'hero' | 'band' | 'side') => c.images[k] ?? firstImage;
  const idx = (n: number, name: string) => `[${pad(n)}] ${name}`;
  let sec = 0; const next = () => ++sec;

  // Smooth scrolling, the live clock and how far down the page you are
  const [clock, setClock] = useState('');
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const fmt = c.tz ? new Intl.DateTimeFormat('en-GB', { timeZone: c.tz, hour: '2-digit', minute: '2-digit', hour12: false }) : null;
    const tick = () => setClock(fmt ? fmt.format(new Date()) : '');
    tick();
    const t = setInterval(tick, 15000);
    const onScroll = () => { const max = document.documentElement.scrollHeight - innerHeight; setProgress(max > 0 ? Math.min(1, scrollY / max) : 0); };
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    let lenis: Lenis | null = null; let raf = 0;
    if (!reduce) { lenis = new Lenis({ lerp: 0.1, smoothWheel: true }); const loop = (time: number) => { lenis?.raf(time); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); }
    return () => { clearInterval(t); removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); lenis?.destroy(); };
  }, [c.tz, reduce]);
  const meter = c.meter === 'page' ? `p. ${pad(1 + Math.floor(progress * 11))} / 12` : `Ascent ${pad(Math.round(progress * 100))}%`;

  const [lv, setLv] = useState(0);
  useEffect(() => {
    if (reduce || !c.levels.length) return;
    const t = setInterval(() => setLv(v => (v + 1) % c.levels.length), 4200);
    return () => clearInterval(t);
  }, [reduce, c.levels.length]);

  const [tab, setTab] = useState(0);
  const levelsRef = useRef<HTMLDivElement>(null);
  const levelsSeen = useInView(levelsRef, { once: true, margin: '0px 0px -20% 0px' });
  const procRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: procP } = useScroll({ target: procRef, offset: ['start 70%', 'end 70%'] });
  const procH = useTransform(procP, [0, 1], ['0%', '100%']);
  const [q, setQ] = useState(0);
  const [open, setOpen] = useState<number | null>(0);
  const coverRef = useRef<HTMLDivElement>(null);
  const coverSeen = useInView(coverRef, { once: true, margin: '0px 0px -20% 0px' });

  const lvl = c.levels[Math.min(tab, c.levels.length - 1)];
  const bp = c.look === 'blueprint';

  return (
    <div className={`dm dm-look-${c.look}`} style={style}>
      <div className={`dm-strip t-${T.strip}`} role="status">
        <div className="dm-wrap dm-strip-in">
          <span className="dm-strip-l"><i />{c.status}</span>
          <span className="dm-strip-c">{[c.centre, clock && `${clock}`].filter(Boolean).join(' ')}</span>
          <span className="dm-strip-r">{meter}</span>
        </div>
      </div>

      <header className={`dm-nav t-${T.nav}`}>
        <div className="dm-wrap dm-nav-in">
          <a className="dm-logo" href="#top"><span className="dm-logo-mark" aria-hidden>{bp ? <Square size={11} fill="currentColor" /> : <Triangle size={12} fill="currentColor" />}</span>{c.brand.word}</a>
          <nav aria-label="Sections">{c.nav.map(n => <a key={n} href={`#${slug(n)}`}>{n}</a>)}</nav>
          <SplitButton label="Get in touch" href="#contact" />
        </div>
      </header>

      <section className={`dm-hero dm-hero-${c.look} t-${T.hero}`} id="top">
        {!bp && photo(firstImage) && <div className="dm-hero-bg" aria-hidden><Picture src={imgOf('hero')} alt="" reduce={reduce} className="dm-hero-pic" /></div>}
        {!bp && <div className="dm-hero-grid-bg" aria-hidden />}
        <div className="dm-wrap dm-hero-wrap">
          <div className="dm-hero-in">
            <motion.p className="dm-idx" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.1 }}>{c.hero.kicker}</motion.p>
            <h1 className="dm-display dm-h1">{c.hero.lines.map((l, i) => <Line key={l} text={l} delay={0.25 + i * 0.25} reduce={reduce} />)}</h1>
            <div className="dm-hero-row">
              <motion.p className="dm-sub" initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.95, ease: EASE }}>{c.hero.sub}</motion.p>
              <motion.div className="dm-cta" initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 1.1, ease: EASE }}>
                <SplitButton label={c.hero.cta} href="#contact" />
                <SplitButton label={c.hero.secondary} href="#levels" variant="outline" />
              </motion.div>
            </div>
          </div>
          {bp && (
            <div className="dm-bp-fig">
              <div className="dm-bp-ruler" aria-hidden />
              <Picture src={imgOf('hero')} alt={c.brand.name} reduce={reduce} className="dm-bp-pic" ratio="4 / 5" />
              <p className="dm-bp-cap"><span>Fig. 01</span>{c.brand.name}</p>
              <div className="dm-badges" aria-hidden>
                {c.badges.map((b, i) => (
                  <motion.span key={b} className="dm-badge" initial={reduce ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 1.3 + i * 0.18, ease: EASE }}><i />{b}</motion.span>
                ))}
              </div>
            </div>
          )}
          {c.levels.length > 0 && (
            <motion.div className="dm-index" style={{ ['--cols' as string]: Math.min(c.levels.length, 4) } as React.CSSProperties} initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 1.3, ease: EASE }}>
              {c.levels.map((l, i) => (
                <button key={l.name} className={i === lv ? 'on' : ''} onClick={() => { setLv(i); setTab(i); }} aria-label={`${N.prefix}${i + 1}: ${l.name}`}>
                  <span className="dm-idx">{N.prefix}{i + 1}</span>
                  <strong>{l.name}</strong>
                  <span className="dm-bar-track"><motion.span key={`${i}-${lv === i}`} className="dm-bar-fill" initial={{ scaleX: lv === i && !reduce ? 0 : lv > i ? 1 : 0 }} animate={{ scaleX: lv === i ? 1 : lv > i ? 1 : 0 }} transition={lv === i && !reduce ? { duration: 4.2, ease: 'linear' } : { duration: 0 }} /></span>
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {c.ticker.length > 0 && (
        <div className={`dm-ticker t-${T.ticker}`} aria-hidden>
          <div className="dm-ticker-track">{[...c.ticker, ...c.ticker, ...c.ticker, ...c.ticker].map((t, i) => <span key={i}>{t}<Diamond size={8} fill="currentColor" /></span>)}</div>
        </div>
      )}

      {c.statement && <Statement text={c.statement} idx={idx(next(), N.idea)} tone={T.statement} reduce={reduce} />}

      {c.levels.length > 0 && (
        <section className={`dm-sec t-${T.levels}`} id="levels">
          <div className="dm-wrap">
            <motion.p className="dm-idx" {...reveal(reduce)}>{idx(next(), N.levels)}</motion.p>
            <motion.h2 className="dm-display dm-h2" {...reveal(reduce, 0.05)}>{c.levelsTitle}</motion.h2>
            <div className="dm-tabs" role="tablist">
              {c.levels.map((l, i) => <button key={l.name} role="tab" aria-selected={tab === i} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>{N.prefix}{i + 1} · {l.name}</button>)}
            </div>
            <div className="dm-levels" ref={levelsRef}>
              <div className="dm-levels-pic">
                <AnimatePresence mode="wait">
                  <motion.div key={tab} className="dm-levels-frame" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.55, ease: EASE }}>
                    {imgOf(lvl.image)
                      ? /* eslint-disable-next-line @next/next/no-img-element */ <img className={isPng(imgOf(lvl.image)) ? 'dm-contain' : undefined} src={imgOf(lvl.image)!} alt={lvl.name} referrerPolicy="no-referrer" />
                      : <div className="dm-pattern" aria-hidden />}
                    <Pins pins={lvl.pins} show={levelsSeen} />
                  </motion.div>
                </AnimatePresence>
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={tab} className="dm-levels-copy" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5, ease: EASE }}>
                  <span className="dm-bignum" aria-hidden>{N.prefix}{tab + 1}</span>
                  <h3 className="dm-display">{lvl.name}</h3>
                  <p>{lvl.body}</p>
                  <SplitButton label="Ask about this" href="#contact" variant="outline" />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </section>
      )}

      {c.process.length > 0 && (
        <section className={`dm-sec t-${T.process}`} id="process">
          <div className="dm-wrap dm-process" ref={procRef}>
            <div className="dm-process-head">
              <motion.p className="dm-idx" {...reveal(reduce)}>{idx(next(), N.process)}</motion.p>
              <motion.h2 className="dm-display dm-h2" {...reveal(reduce, 0.05)}>{c.processTitle}</motion.h2>
            </div>
            <div className="dm-steps">
              <div className="dm-steps-line" aria-hidden><motion.span style={{ height: reduce ? '100%' : procH }} /></div>
              {c.process.map((s, i) => (
                <motion.div key={s.title} className="dm-step" initial={reduce ? false : { opacity: 0.25 }} whileInView={{ opacity: 1 }} viewport={{ amount: 0.6 }} transition={{ duration: 0.5 }}>
                  <span className="dm-step-n">{pad(i + 1)}</span>
                  <div><h3 className="dm-display">{s.title}</h3><p>{s.body}</p></div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {(c.why.length > 0 || c.quotes.length > 0) && (
        <section className={`dm-sec t-${T.why}`} id="clients">
          <div className="dm-wrap">
            <motion.p className="dm-idx" {...reveal(reduce)}>{idx(next(), N.why)}</motion.p>
            <motion.h2 className="dm-display dm-h2" {...reveal(reduce, 0.05)}>{c.whyTitle}</motion.h2>
            {c.why.length > 0 && (
              <div className="dm-why">
                {c.why.map((w, i) => (
                  <motion.div key={w.title} className="dm-why-item" {...reveal(reduce, i * 0.08)}>
                    <span className="dm-big">{i === 0 && years ? <><Count to={years} reduce={reduce} /><small>yrs</small></> : pad(i + 1)}</span>
                    <h3 className="dm-display">{w.title}</h3>
                    <p>{w.body}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
          {c.quotes.length > 0 && (
            <Picture src={imgOf('side')} alt="" reduce={reduce} className="dm-quote-pic">
              <div className="dm-quote-card">
                <AnimatePresence mode="wait">
                  <motion.div key={q} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.45, ease: EASE }}>
                    <blockquote>&ldquo;{c.quotes[q].text}&rdquo;</blockquote>
                    <p className="dm-who"><b>{c.quotes[q].name}</b><span>{c.quotes[q].company}</span></p>
                  </motion.div>
                </AnimatePresence>
                <div className="dm-quote-nav">
                  <span className="dm-idx">{pad(q + 1)} / {pad(c.quotes.length)}</span>
                  <span>
                    <button onClick={() => setQ((q + c.quotes.length - 1) % c.quotes.length)} aria-label="Previous quote"><ArrowLeft size={16} /></button>
                    <button onClick={() => setQ((q + 1) % c.quotes.length)} aria-label="Next quote"><ArrowRight size={16} /></button>
                  </span>
                </div>
              </div>
            </Picture>
          )}
        </section>
      )}

      {c.coverage.length > 0 && c.coverageTitle && (
        <section className={`dm-cover t-${T.cover}`} ref={coverRef}>
          <Picture src={imgOf('band')} alt={c.coverageTitle} reduce={reduce} className="dm-cover-pic"><Pins pins={c.coverage} show={coverSeen} /></Picture>
          <div className="dm-wrap dm-cover-cap"><motion.h2 className="dm-display" {...reveal(reduce, 0.15)}>{c.coverageTitle}</motion.h2></div>
        </section>
      )}

      {c.faq.length > 0 && (
        <section className={`dm-sec dm-faq t-${T.faq}`} id="faq">
          <div className="dm-wrap dm-faq-grid">
            <div>
              <motion.p className="dm-idx" {...reveal(reduce)}>{idx(next(), N.faq)}</motion.p>
              <motion.h2 className="dm-display dm-h2" {...reveal(reduce, 0.05)}>{c.faqTitle}</motion.h2>
            </div>
            <div className="dm-acc">
              {c.faq.map((f, i) => (
                <motion.div key={f.q} className="dm-acc-item" {...reveal(reduce, i * 0.06)}>
                  <button aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}><span>{f.q}</span>{open === i ? <Minus size={18} aria-hidden /> : <Plus size={18} aria-hidden />}</button>
                  <AnimatePresence initial={false}>
                    {open === i && <motion.div className="dm-acc-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }}><p>{f.a}</p></motion.div>}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className={`dm-cta-sec t-${T.cta}`} id="contact">
        <div className="dm-wrap">
          <div className="dm-frame">
            <div className="dm-ruler" aria-hidden>{[0, 1, 2, 3, 4].map(n => <span key={n}>[{N.prefix || 'S'}{n}]</span>)}</div>
            <div className="dm-frame-in">
              <div>
                <p className="dm-idx">{idx(next(), N.start)}</p>
                <motion.h2 className="dm-display dm-h2 dm-h2-xl" {...reveal(reduce)}>{c.closing.title}</motion.h2>
                {c.closing.body && <motion.p className="dm-sub" {...reveal(reduce, 0.08)}>{c.closing.body}</motion.p>}
              </div>
              <motion.form className="dm-form" onSubmit={e => e.preventDefault()} {...reveal(reduce, 0.14)}>
                {c.closing.fields.map(f => (
                  <label key={f}><span>{f}</span>{/\?|slow|apply|process|what/i.test(f) ? <textarea rows={3} /> : <input type={/mail/i.test(f) ? 'email' : 'text'} />}</label>
                ))}
                <button type="submit" className="dm-split dm-split-solid dm-split-xl"><span>{c.closing.cta}</span><span className="dm-split-arrow" aria-hidden><ArrowRight size={16} /></span></button>
                <small>This is a concept, so the form does not send anywhere.</small>
              </motion.form>
            </div>
          </div>
        </div>
      </section>

      <footer className={`dm-footer t-${T.footer}`}>
        <div className="dm-wrap dm-foot-grid" style={{ ['--fcols' as string]: c.footer.columns.length + 2 } as React.CSSProperties}>
          <div>
            <a className="dm-logo" href="#top"><span className="dm-logo-mark" aria-hidden>{bp ? <Square size={11} fill="currentColor" /> : <Triangle size={12} fill="currentColor" />}</span>{c.brand.word}</a>
            {c.footer.blurb && <p className="dm-foot-blurb">{c.footer.blurb}</p>}
          </div>
          {c.footer.columns.map(col => (
            <nav key={col.title} aria-label={col.title}>
              <p className="dm-idx">{col.title}</p>
              <ul>{col.links.map(l => <li key={l}><a href="#levels">{l}</a></li>)}</ul>
            </nav>
          ))}
          <div>
            <p className="dm-idx">Visit</p>
            <ul>{c.footer.place && <li>{c.footer.place}</li>}{c.footer.site && <li>{c.footer.site}</li>}</ul>
          </div>
        </div>
        <div className="dm-wrap dm-foot-big" aria-hidden>{c.brand.word}</div>
        <div className="dm-wrap dm-foot-base"><span>© {new Date().getFullYear()} {c.brand.name} · Concept by Samuel Adefila</span><span>{c.status}</span></div>
      </footer>

      <div className="dm-concept" role="note">
        <span><b>Concept</b> for {c.brand.name}, by Samuel Adefila. Not live.</span>
        <span className="dm-concept-actions">
          {yesHref && <a className="dm-mini" href={yesHref}>Reply YES</a>}
          {waHref && <a className="dm-mini dm-mini-ghost" href={waHref} target="_blank" rel="noreferrer">WhatsApp</a>}
        </span>
      </div>
    </div>
  );
}
