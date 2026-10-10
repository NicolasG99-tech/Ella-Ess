import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
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
        {/* Global, damit die Einwilligungsabfrage auf jeder Seite erscheint —
            auch vor dem Login, wo sie rechtlich am relevantesten ist. Siehe
            src/lib/consent/cookieConsent.ts. */}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
