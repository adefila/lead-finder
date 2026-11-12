import type { ReactNode } from 'react';
import { Anybody, Instrument_Sans, Instrument_Serif, Martian_Mono, Inter } from 'next/font/google';
import './demo.css';
import './modern.css';
import './modern-sections.css';

// The same three faces as the Datum concept: a wide heavy display face, a plain body face and a mono for labels.
const display = Anybody({ subsets: ['latin'], axes: ['wdth'], variable: '--font-anybody', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-instrument', display: 'swap' });
const mono = Martian_Mono({ subsets: ['latin'], axes: ['wdth'], variable: '--font-martian', display: 'swap' });

const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: 'italic', variable: '--font-serif', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata = { robots: { index: false, follow: false } };

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <div className={`${display.variable} ${body.variable} ${mono.variable} ${inter.variable} ${serif.variable}`}>{children}</div>;
}
