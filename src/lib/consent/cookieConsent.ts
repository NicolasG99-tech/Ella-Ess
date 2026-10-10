// Cookie-/Speicherzugriffs-Einwilligung, rechtliche Grundlage § 25 TDDDG
// (bis Mai 2024 "TTDSG" genannt, inhaltlich unverändert — verlangt aktive
// Einwilligung, BEVOR nicht technisch zwingend notwendige Cookies/Storage-
// Zugriffe stattfinden, siehe docs/SECURITY.md). Ergebnis der
// Sicherheitsprüfung 2026-07-28, Punkt 10.
//
// WICHTIG zum aktuellen Stand: Diese App setzt aktuell KEINE Analyse-,
// Marketing- oder sonstigen nicht-notwendigen Cookies (kein Analytics-Tool,
// kein Tracking-Pixel, siehe docs/SECURITY.md, "Bereits getroffene
// Schutzmaßnahmen"). Dieses Modul ist bewusst bereits jetzt vollständig
// aufgebaut — nicht erst, wenn ein solches Feature kommt — damit (a) die App
// von Anfang an ein sauberes Consent-Fundament hat, das man später nur noch
// AUSLESEN muss (`hasConsent('analytics')` o.Ä.), statt es unter Zeitdruck
// nachzurüsten, und (b) im Sinne von "privacy by default" nichts ohne
// Zustimmung passiert: Ohne explizite Entscheidung gilt technisch NICHTS als
// erlaubt außer der Kategorie "necessary" (die es aktuell auch nur als
// Platzhalter gibt — siehe COOKIE_CATEGORIES unten).

export type CookieCategory = 'necessary' | 'functional' | 'analytics' | 'marketing';

// Erhöhen, wenn sich die Kategorien oder ihre Bedeutung inhaltlich ändern —
// bereits entschiedene Nutzer:innen werden dann erneut gefragt (analog zu
// CONSENT_VERSION für Nutzungsbedingungen in features/auth/actions.ts).
export const COOKIE_CONSENT_VERSION = 1;

const STORAGE_KEY = 'lese-abenteuer-cookie-consent';

// Katalog der Kategorien, die dem Elternteil im Banner erklärt werden.
// "necessary" ist absichtlich immer aktiv/nicht abwählbar (§ 25 Abs. 2 Nr. 2
// TDDDG erlaubt technisch zwingend notwendige Cookies ohne Einwilligung) —
// aktuell nutzt die App dafür ausschließlich das von Auth.js gesetzte
// Session-Cookie (siehe src/lib/server/auth.ts), kein zusätzliches eigenes.
export const COOKIE_CATEGORIES: Array<{
  id: CookieCategory;
  label: string;
  description: string;
  required: boolean;
}> = [
  {
    id: 'necessary',
    label: 'Notwendig',
    description:
      'Erforderlich, damit die App funktioniert — z. B. das Anmelde-Sitzungs-Cookie. Kann nicht deaktiviert werden.',
    required: true,
  },
  {
    id: 'functional',
    label: 'Funktional',
    description:
      'Speichert Komforteinstellungen (z. B. zuletzt gewählte Lautstärke/Ansicht). Aktuell noch nicht genutzt.',
    required: false,
  },
  {
    id: 'analytics',
    label: 'Statistik/Analyse',
    description:
      'Hilft zu verstehen, wie die App genutzt wird, um sie zu verbessern. Aktuell ist kein Analyse-Werkzeug eingebunden.',
    required: false,
  },
  {
    id: 'marketing',
    label: 'Marketing/externe Medien',
    description:
      'Für Werbeeinblendungen oder eingebettete Inhalte Dritter. Aktuell nicht vorhanden — diese App zeigt keine Werbung, siehe docs/SECURITY.md.',
    required: false,
  },
];

export type ConsentCategories = Record<CookieCategory, boolean>;

export interface CookieConsentState {
  version: number;
  decidedAt: string;
  categories: ConsentCategories;
}

// Ohne gespeicherte Entscheidung gilt NICHTS als erlaubt außer "necessary" —
// "privacy by default", siehe Modul-Kommentar oben.
function defaultCategories(): ConsentCategories {
  return { necessary: true, functional: false, analytics: false, marketing: false };
}

/**
 * Liest die gespeicherte Einwilligungsentscheidung aus localStorage.
 * SSR-sicher (liefert `null`, wenn kein `window` existiert, statt zu
 * werfen) — wichtig, da dieses Modul auch von Server- und Client-Code
 * importiert werden kann.
 *
 * @returns `null`, wenn noch keine Entscheidung getroffen wurde ODER die
 *   gespeicherte Version nicht mehr aktuell ist (siehe COOKIE_CONSENT_VERSION)
 *   — in beiden Fällen muss das Banner erneut angezeigt werden.
 */
// Cache für getStoredConsent(): CookieConsentBanner.tsx liest den Wert über
// useSyncExternalStore(), und React verlangt dort, dass die Lesefunktion bei
// unverändertem Inhalt EXAKT DASSELBE Objekt zurückgibt. Ohne Cache erzeugte
// JSON.parse() bei jedem Aufruf ein neues Objekt — React wertete das als
// Änderung und renderte endlos neu ("Maximum update depth exceeded"), sobald
// eine Entscheidung gespeichert war (Fehler gemeldet 2026-10-10: Seite nach
// Annehmen/Ablehnen der Cookies nicht mehr aufrufbar). Neu geparst wird nur,
// wenn sich der gespeicherte Rohtext tatsächlich geändert hat.
let cachedRaw: string | null | undefined;
let cachedState: CookieConsentState | null = null;

function parseConsent(raw: string | null): CookieConsentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CookieConsentState;
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null;

    // "necessary" nachträglich erzwingen, falls ein älteres Format ohne
    // dieses Feld existiert hätte — defensiv, aktuell nicht der Fall.
    return { ...parsed, categories: { ...parsed.categories, necessary: true } };
  } catch {
    // Kaputtes/fremdes JSON im Storage-Slot — wie "keine Entscheidung" behandeln.
    return null;
  }
}

export function getStoredConsent(): CookieConsentState | null {
  if (typeof window === 'undefined') return null;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage kann in manchen Kontexten (z.B. blockierte Speicherung)
    // selbst werfen — wie "keine Entscheidung" behandeln.
    return null;
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedState = parseConsent(raw);
  }
  return cachedState;
}

/**
 * Speichert eine Einwilligungsentscheidung und benachrichtigt anderen
 * Client-Code im selben Tab per CustomEvent (localStorage-"storage"-Events
 * feuern im selben Tab nicht, nur in anderen Tabs — daher zusätzlich dieses
 * Event, damit z. B. ein künftiges Analyse-Skript sofort reagieren kann,
 * ohne selbst auf localStorage zu pollen).
 */
export function storeConsent(categories: Partial<ConsentCategories>): CookieConsentState {
  const state: CookieConsentState = {
    version: COOKIE_CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    categories: { ...defaultCategories(), ...categories, necessary: true },
  };

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent<CookieConsentState>('cookie-consent-changed', { detail: state }));
  }

  return state;
}

/**
 * Prüft, ob eine bestimmte Kategorie aktuell erlaubt ist. Zukünftiger Code,
 * der ein nicht-notwendiges Skript laden oder ein nicht-notwendiges Cookie
 * setzen will, MUSS dies vorher hier prüfen (siehe docs/SECURITY.md,
 * Abschnitt "Cookie-Einwilligung") — ohne Einwilligung liefert diese
 * Funktion `false`, auch wenn noch gar keine Entscheidung getroffen wurde
 * ("privacy by default").
 */
export function hasConsent(category: CookieCategory): boolean {
  if (category === 'necessary') return true;
  return getStoredConsent()?.categories[category] ?? false;
}

export const ACCEPT_ALL_CATEGORIES: ConsentCategories = {
  necessary: true,
  functional: true,
  analytics: true,
  marketing: true,
};

export const REJECT_ALL_CATEGORIES: ConsentCategories = defaultCategories();
