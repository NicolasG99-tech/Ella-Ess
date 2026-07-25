'use client';

import { signOut } from 'next-auth/react';

// Bewusst der next-auth/react-Client statt der Server-Action-Variante: Ein
// `cookies().set()` innerhalb einer Server Action löst laut Next.js-Dokumentation
// einen sofortigen Re-Render der aktuellen (geschützten) Route aus, bevor der
// anschließende redirect() greift — das ließ requireUser() auf der bereits
// abgemeldeten Dashboard-Seite fehlschlagen. Der Client-Aufruf umgeht das, indem
// er nach dem Abmelden per Navigation (nicht Server-Response) zur Zielseite geht.
export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/' })}
      className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
    >
      Abmelden
    </button>
  );
}
