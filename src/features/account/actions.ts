'use server';

import { requireUser } from '@/lib/server/authz';
import { deleteAccount } from '@/lib/account/accountService';
import { sendPrivacyNoticeEmail } from '@/lib/server/email';

// Löscht das eigene Konto endgültig. Kaskadiert auf Datenbankebene (siehe
// prisma/schema.prisma, onDelete: Cascade) über alle Kinderprofile inkl.
// deren Lesesitzungen, Übungsversuche, Fortschritt und Belohnungen sowie —
// bei Fachkräften — das SpecialistProfile samt erteilter Zugriffe und
// Rückmeldungen. AuditEvent-Einträge bleiben erhalten (onDelete: SetNull),
// damit der Prüfpfad nicht mitgelöscht wird — die Löschung selbst wird in
// deleteAccount() protokolliert, konsistent mit allen anderen Löschaktionen.
//
// Löst absichtlich nicht selbst signOut() aus — das muss der aufrufende
// Client danach erledigen (siehe LogoutButton.tsx zur Race-Condition-Begründung).
export async function deleteOwnAccountAction(): Promise<void> {
  const user = await requireUser();
  // E-Mail-Adresse VOR der Löschung sichern — nach deleteAccount() existiert
  // die User-Zeile (und damit die Adresse) nicht mehr. Datenschutz-relevante
  // Bestätigung, siehe Sicherheitsprüfung 2026-07-28, Punkte 7+8.
  const email = user.email;
  await deleteAccount(user.id);
  await sendPrivacyNoticeEmail(email, {
    headline: 'Dein Konto wurde gelöscht',
    message:
      'Dein Lese-Abenteuer-Konto und alle zugehörigen Daten (Kinderprofile, Lesefortschritt, ' +
      'erteilte Freigaben) wurden soeben endgültig gelöscht.',
  });
}
