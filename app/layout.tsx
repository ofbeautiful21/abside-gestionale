import type { Metadata } from 'next';
import { DM_Serif_Display, DM_Sans } from 'next/font/google'; // Importiamo i font
import AppShell from '@/components/layout/AppShell';
import '@/styles/globals.css';

// Configuriamo i font
const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-dm-serif',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
});

export const metadata: Metadata = {
  title: { template: '%s — Bellezza Studio', default: 'Bellezza Studio' },
  description: 'Gestionale centro estetico',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Aggiungiamo le classi variabili al tag html
    <html lang="it" className={`${dmSerif.variable} ${dmSans.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
