'use client';

import { motion } from 'motion/react';
import { Check, Search } from 'lucide-react';
import { EASE } from '@/components/DemoSite';

// Small interface cards drawn from the business's own words (service names and the phrases from its site), the way the
// Ordina reference shows its product. Nothing here is a claim: it is the business's own list, laid out as a screen.

export type MockVariant = 'list' | 'steps' | 'chips' | 'search';
export interface MockProps { variant: MockVariant; title: string; tag?: string; items: string[]; active?: number; reduce: boolean }

export const MOCK_VARIANTS: MockVariant[] = ['list', 'steps', 'chips', 'search'];

// Up to three short lines for a card: the phrases if there are any, otherwise cut from the sentence.
export function mockItems(pins: string[], body: string, name: string): string[] {
  if (pins.length) return pins.slice(0, 4);
  const parts = body.split(/[,;]| and /).map(s => s.trim().replace(/\.$/, '')).filter(s => s.length > 3 && s.length < 44);
  return (parts.length > 1 ? parts : [name]).slice(0, 4);
}

export function Mock({ variant, title, tag, items, active = 0, reduce }: MockProps) {
  const row = (i: number) => reduce ? {} : ({ initial: { opacity: 0, x: -10 }, whileInView: { opacity: 1, x: 0 }, viewport: { once: true, margin: '0px 0px -10% 0px' }, transition: { duration: 0.55, delay: 0.15 + i * 0.12, ease: EASE } } as const);
  return (
    <div className={`mm-mock mm-mock-${variant}`}>
      <p className="mm-mock-head">{tag && <span>{tag}</span>}{title}</p>
      {variant === 'list' && (
        <ul>{items.map((t, i) => <motion.li key={t} {...row(i)}><span className="mm-tick"><Check size={12} strokeWidth={3} aria-hidden /></span>{t}</motion.li>)}</ul>
      )}
      {variant === 'steps' && (
        <ol>{items.map((t, i) => <motion.li key={t} className={i === active ? 'on' : ''} {...row(i)}><b>{i + 1}</b>{t}</motion.li>)}</ol>
      )}
      {variant === 'chips' && (
        <>
          <div className="mm-mock-tags">{items.map((t, i) => <motion.span key={t} {...row(i)}>{t}</motion.span>)}</div>
          <div className="mm-mock-lines" aria-hidden><i /><i /><i /></div>
        </>
      )}
      {variant === 'search' && (
        <>
          <div className="mm-mock-bar"><Search size={14} aria-hidden /><span>Search {title.toLowerCase()}</span></div>
          <ul>{items.map((t, i) => <motion.li key={t} {...row(i)}>{t}</motion.li>)}</ul>
        </>
      )}
    </div>
  );
}
