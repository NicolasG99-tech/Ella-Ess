'use client';

import { useState, useSyncExternalStore } from 'react';
import {
  COOKIE_CATEGORIES,
  ACCEPT_ALL_CATEGORIES,
  REJECT_ALL_CATEGORIES,
  getStoredConsent,
  storeConsent,
  type ConsentCategories,
  type CookieCategory,
  type CookieConsentState,
} from '@/lib/consent/cookieConsent';

// Cookie-Einwilligungsbanner (§ 25 TDDDG, siehe lib/consent/cookieConsent.ts
// für die rechtliche Einordnung). Global im Root-Layout gemountet
// (src/app/layout.tsx), damit es auf jeder Seite erscheint — auch vor dem
// Login, wo es rechtlich am relevantesten ist (Einwilligung MUSS erfolgen,
// bevor nicht-notwendige Cookies überhaupt gesetzt würden).
//
// Bewusst pro Kategorie granular abfragbar (nicht nur ein einzelner
// "Akzeptieren"-Button) — das entspricht der in Deutschland üblichen
// Erwartung an ein rechtskonformes Consent-Banner (siehe Recherche zur
// Sicherheitsprüfung 2026-07-28, Punkt 10) und macht das Banner zugleich zum
// zentralen Ort, an dem künftige Funktionen (Analyse-Tool, eingebettete
// Medien Dritter) ihre Kategorie bereits vorfinden, statt das Banner dafür
// erst umbauen zu müssen.

// localStorage ist eine externe, mutierbare Datenquelle außerhalb von
// React — useSyncExternalStore() ist dafür der dedizierte React-19-Hook
// (statt eines useEffect()+useState()-"mounted"-Umwegs): liefert server-
// seitig `null` (kein Hydration-Mismatch, da vor der Interaktion ohnehin
// nichts von der gespeicherten Entscheidung abhängt) und aktualisiert sich
// automatisch, sobald storeConsent() das 'cookie-consent-changed'-Event
// auslöst oder ein anderer Tab das 'storage'-Event feuert.
function subscribeToConsent(callback: () => void) {
  window.addEventListener('cookie-consent-changed', callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener('cookie-consent-changed', callback);
    window.removeEventListener('storage', callback);
  };
}

function getServerConsentSnapshot(): CookieConsentState | null {
  return null;
}

export function CookieConsentBanner() {
  const stored = useSyncExternalStore(subscribeToConsent, getStoredConsent, getServerConsentSnapshot);
  const [manuallyOpened, setManuallyOpened] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selection, setSelection] = useState<ConsentCategories>(REJECT_ALL_CATEGORIES);

  const visible = manuallyOpened || stored === null;

  function openForEdit() {
    setSelection(stored?.categories ?? REJECT_ALL_CATEGORIES);
    setShowDetails(true);
    setManuallyOpened(true);
  }

  function toggleCategory(id: CookieCategory) {
    setSelection((current) => ({ ...current, [id]: !current[id] }));
  }

  function acceptAll() {
    storeConsent(ACCEPT_ALL_CATEGORIES);
    setManuallyOpened(false);
    setShowDetails(false);
  }

  function rejectNonEssential() {
    storeConsent(REJECT_ALL_CATEGORIES);
    setManuallyOpened(false);
    setShowDetails(false);
  }

  function saveSelection() {
    storeConsent(selection);
    setManuallyOpened(false);
    setShowDetails(false);
  }

  if (!visible) {
    // Solange keine sichtbare Einwilligungsabfrage ansteht, bewusst nur ein
    // unauffälliger Wiedereinstieg — Eltern sollen ihre Auswahl jederzeit
    // ändern können (Widerruflichkeit der Einwilligung ist gesetzlich
    // vorgeschrieben), ohne dass ein Banner dauerhaft im Weg ist. Vor dem
    // ersten Client-Render (SSR, `stored === undefined`-Fall existiert hier
    // nicht, da getServerConsentSnapshot `null` liefert) wäre `visible`
    // eigentlich `true` — das ist gewollt: das Banner selbst rendert dann
    // serverseitig, was unproblematisch ist, da es keine echte Entscheidung
    // voraussetzt.
    return (
      <button
        type="button"
        onClick={openForEdit}
        className="fixed bottom-2 left-2 z-40 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 shadow-sm hover:bg-stone-50"
      >
        Cookie-Einstellungen
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-heading"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white px-4 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] sm:px-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <div>
          <h2 id="cookie-consent-heading" className="text-base font-bold text-stone-900">
            Cookie-Einstellungen
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Wir nutzen nur Cookies/Speicherzugriffe, denen du zustimmst. Notwendige Funktionen (z. B.
            deine Anmeldung) laufen immer, alles andere nur mit deiner Erlaubnis — du kannst deine Wahl
            jederzeit über &bdquo;Cookie-Einstellungen&rdquo; unten links wieder ändern.
          </p>
        </div>

        {showDetails && (
          <fieldset className="flex flex-col gap-2 rounded-md border border-stone-200 p-3">
            <legend className="px-1 text-xs font-semibold text-stone-500">Kategorien</legend>
            {COOKIE_CATEGORIES.map((category) => (
              <label key={category.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selection[category.id]}
                  disabled={category.required}
                  onChange={() => toggleCategory(category.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-stone-800">
                    {category.label}
                    {category.required && ' (immer aktiv)'}
                  </span>
                  <br />
                  <span className="text-stone-600">{category.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={acceptAll}
            className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white"
          >
            Alle akzeptieren
          </button>
          <button
            type="button"
            onClick={rejectNonEssential}
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700"
          >
            Nur notwendige
          </button>
          {showDetails ? (
            <button
              type="button"
              onClick={saveSelection}
              className="rounded-md border border-amber-400 px-4 py-2 text-sm font-medium text-amber-800"
            >
              Auswahl speichern
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700"
            >
              Einstellungen anpassen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
