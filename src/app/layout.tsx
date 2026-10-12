import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { CookieConsentBanner } from '@/features/consent/CookieConsentBanner';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Lese-Abenteuer',
  description: 'Eine gamifizierte Lese-Lernapp für Kinder von 7 bis 10 Jahren.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        {/* Impressum muss von jeder Seite aus "unmittelbar erreichbar" sein
            (§ 5 DDG) — daher global im Root-Layout statt nur auf einzelnen
            Seiten verlinkt. */}
        <footer className="flex justify-center gap-4 px-6 py-4 text-xs text-stone-500">
          <Link href="/impressum" className="underline">
            Impressum
          </Link>
          <Link href="/datenschutz" className="underline">
            Datenschutz
          </Link>
        </footer>
        {/* Global, damit die Einwilligungsabfrage auf jeder Seite erscheint —
            auch vor dem Login, wo sie rechtlich am relevantesten ist. Siehe
            src/lib/consent/cookieConsent.ts. */}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
