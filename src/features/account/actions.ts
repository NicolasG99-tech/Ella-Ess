'use server';

import { requireUser } from '@/lib/server/authz';
import { deleteAccount } from '@/lib/account/accountService';

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
  await deleteAccount(user.id);
}
