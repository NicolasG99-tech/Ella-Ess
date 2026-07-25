import { NextResponse } from 'next/server';
import { auth } from '@/lib/server/auth';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/admin',
  '/lesen',
  '/uebungen',
  '/belohnungen',
  '/fachkraft',
  '/lehrer',
];

// Next.js 16: "middleware" heißt jetzt "proxy" und läuft nur noch im Node.js-Runtime
// (kein Edge-Runtime mehr). Das ist UX-Komfort (schnellerer Redirect ohne
// Server-Roundtrip); die eigentliche Sicherheitsgrenze bleibt requireUser() in
// jeder Server Action, da Render-/Routing-Gating allein keine Sicherheitsgrenze ist.
//
// Seit Meilenstein 10 läuft der Proxy auf praktisch jeder Route (siehe
// config.matcher unten), nicht mehr nur auf den geschützten Prefixes — die
// Security-Header unten sollen auch für öffentliche Seiten (/, /login, …)
// gelten. Die Auth-Redirect-Logik bleibt weiterhin auf PROTECTED_PREFIXES
// beschränkt.

// Nonce-basierte CSP (script-src 'nonce-…' 'strict-dynamic' statt
// 'unsafe-inline') wurde ausprobiert und mit einem echten E2E-Test wieder
// verworfen: ein frisch pro Request generierter Nonce funktioniert nur für
// den allerersten vollständigen Seitenaufruf korrekt (per curl verifiziert —
// Next.js liest den Nonce aus dem Request-Header und versieht seine eigenen
// Chunk-/Inline-Skripte korrekt damit). Sobald Next.js' Client-Router im
// selben Browser-Tab weiternavigiert oder Links prefetcht, laufen dabei
// weitere Proxy-Aufrufe mit JEWEILS NEUEM Nonce, dessen Wert nicht mehr zum
// bereits vom Browser durchgesetzten CSP-Header der aktuellen Seite passt —
// das führt zu echten, von `tests/e2e/auth-and-children.spec.ts` aufgedeckten
// "Refused to execute/load script"-Fehlern (dort werden Konsolenfehler
// explizit geprüft). Ein sitzungsstabiler statt pro-Request-zufälliger Nonce
// wäre eine mögliche Lösung, ist aber nicht trivial mit dem aktuellen
// Cookie-losen Proxy-Aufbau vereinbar — siehe docs/SECURITY.md für den
// dokumentierten Nachbesserungsbedarf vor einem Produktiveinsatz.
// style-src erlaubt 'unsafe-inline', da die App an mehreren Stellen bewusst
// echte Inline-Styles nutzt (z.B. Fortschrittsbalken, Schriftgrößen-Skalierung).
function buildCspHeader(): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `media-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ].join('; ');
}

function applySecurityHeaders(response: NextResponse, csp: string) {
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Mikrofon bleibt für die eigene Origin erlaubt (Lesesitzung), alles
  // andere gesperrt — siehe docs/ARCHITECTURE.md, Abschnitt "Audioverarbeitung".
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(self), geolocation=(), payment=()',
  );
}

export const proxy = auth((req) => {
  const csp = buildCspHeader();

  const isProtected = PROTECTED_PREFIXES.some((prefix) => req.nextUrl.pathname.startsWith(prefix));

  if (isProtected && !req.auth) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    applySecurityHeaders(redirectResponse, csp);
    return redirectResponse;
  }

  const response = NextResponse.next();
  applySecurityHeaders(response, csp);
  return response;
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
