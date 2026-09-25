import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter, Dancing_Script } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const script = Dancing_Script({ subsets: ['latin'], weight: ['700'], variable: '--font-script', display: 'swap' });

export const metadata: Metadata = {
  title: 'Lead Finder',
  description: 'Website leads for Samuel Adefila',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${script.variable}`}>
      <body>{children}</body>
    </html>
  );
}
