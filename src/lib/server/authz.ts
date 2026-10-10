import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { hasActiveSubscription } from '@/lib/billing/subscriptionService';
import type { UserRole } from '@/generated/prisma/enums';

// Wird von Server Actions geworfen, wenn Authentifizierung/Autorisierung fehlschlägt.
// UI-Code kann gezielt darauf reagieren, ohne interne Fehlerdetails preiszugeben.
export class AuthzError extends Error {
  constructor(message = 'Keine Berechtigung.') {
    super(message);
    this.name = 'AuthzError';
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

// Schritt 1 & 2 der zentralen Autorisierungsreihenfolge: authentifiziert + Rolle.
export async function requireUser(): Promise<AuthenticatedUser> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    throw new AuthzError('Bitte melde dich an.');
  }
  return { id: session.user.id, email: session.user.email, role: session.user.role };
}

// Für Page-/Layout-Komponenten statt requireUser(): Next.js kann Seiten
// spekulativ vor-rendern (Link-Prefetching), auch kurz während/nach einem
// Logout — dort soll ein fehlender Session-Zustand sauber zur Login-Seite
// umleiten (Next.js-Kontrollfluss) statt als ungefangener Fehler im
// Server-Log zu landen. In Server Actions (nur nutzerausgelöst, nie
// spekulativ) bleibt requireUser() mit seinem Error-Wurf richtig.
export async function requireUserForPage(callbackUrl?: string): Promise<AuthenticatedUser> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect(callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/login');
  }
  return { id: session.user.id, email: session.user.email, role: session.user.role };
}

// Rollen-Variante von requireUserForPage(): erst zum Login umleiten, falls gar
// keine Session besteht; besteht eine Session ohne passende Rolle, 404 statt
// Redirect — verrät nicht, dass die Seite überhaupt existiert.
export async function requireRoleForPage(
  role: UserRole | UserRole[],
  callbackUrl?: string,
): Promise<AuthenticatedUser> {
  const user = await requireUserForPage(callbackUrl);
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(user.role)) {
    notFound();
  }
  return user;
}

export async function requireRole(role: UserRole | UserRole[]): Promise<AuthenticatedUser> {
  const user = await requireUser();
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(user.role)) {
    throw new AuthzError('Diese Aktion ist für deine Rolle nicht verfügbar.');
  }
  return user;
}

// Optionaler Baustein für kostenpflichtige Funktionen (Ergebnis der
// Produktentscheidung "Jetzt Zahlungsmodell", 2026-07-28). BEWUSST NOCH
// NIRGENDS AUFGERUFEN — welche Funktionen tatsächlich hinter ein Abo
// wandern (alles? nur neue Inhalte? Bestandskund:innen-Übergang?) ist eine
// Produktentscheidung, die noch nicht getroffen wurde. Diese Funktion steht
// bereit, damit eine künftige Server Action nur noch
// `await requireActiveSubscription()` direkt nach `requireUser()` ergänzen
// muss, statt die Prüfung neu zu entwerfen. Absichtlich NACH requireUser()
// aufzurufen (nie davor) — ein nicht angemeldeter Zugriff soll weiterhin als
// Authentifizierungsfehler erscheinen, nicht als Abo-Fehler.
export async function requireActiveSubscription(): Promise<AuthenticatedUser> {
  const user = await requireUser();
  if (!(await hasActiveSubscription(user.id))) {
    throw new AuthzError('Diese Funktion erfordert ein aktives Abo.');
  }
  return user;
}

// Schritt 3: Objekt-Eigentümerschaft. Verhindert IDOR — ein Elternteil darf
// ausschließlich auf eigene Kinderprofile zugreifen.
export async function requireOwnChildProfile(childProfileId: string) {
  const user = await requireUser();
  const childProfile = await db.childProfile.findFirst({
    where: { id: childProfileId, parentId: user.id },
  });
  if (!childProfile) {
    throw new AuthzError('Kinderprofil nicht gefunden oder keine Berechtigung.');
  }
  return { user, childProfile };
}

// Analoges Eigentümerschafts-Muster für Fachkräfte (Meilenstein 9): das
// SpecialistProfile gehört immer genau einem User.
export async function requireOwnSpecialistProfile() {
  const user = await requireUser();
  const specialistProfile = await db.specialistProfile.findUnique({ where: { userId: user.id } });
  if (!specialistProfile) {
    throw new AuthzError('Kein Fachkräfte-Profil gefunden.');
  }
  return { user, specialistProfile };
}

// Verhindert IDOR bei Fachkraft-Zugriffen: eine Freigabe muss der anfragenden
// Fachkraft gehören, aktiv (nicht widerrufen) und nicht abgelaufen sein.
export async function requireOwnActiveGrant(childAccessGrantId: string) {
  const { user, specialistProfile } = await requireOwnSpecialistProfile();
  const grant = await db.childAccessGrant.findFirst({
    where: {
      id: childAccessGrantId,
      specialistProfileId: specialistProfile.id,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { childProfile: true },
  });
  if (!grant) {
    throw new AuthzError('Kein Zugriff auf dieses Kinderprofil.');
  }
  return { user, specialistProfile, grant };
}

// Analoges Eigentümerschafts-Muster für Lehrkräfte: eigenständige Rolle
// neben Fachkräften (siehe prisma/schema.prisma), gleiche IDOR-Logik.
export async function requireOwnTeacherProfile() {
  const user = await requireUser();
  const teacherProfile = await db.teacherProfile.findUnique({ where: { userId: user.id } });
  if (!teacherProfile) {
    throw new AuthzError('Kein Lehrkräfte-Profil gefunden.');
  }
  return { user, teacherProfile };
}

// Verhindert IDOR bei Lehrkräfte-Zugriffen: eine Freigabe muss der
// anfragenden Lehrkraft gehören, aktiv (nicht widerrufen) und nicht
// abgelaufen sein.
export async function requireOwnActiveTeacherGrant(teacherAccessGrantId: string) {
  const { user, teacherProfile } = await requireOwnTeacherProfile();
  const grant = await db.teacherAccessGrant.findFirst({
    where: {
      id: teacherAccessGrantId,
      teacherProfileId: teacherProfile.id,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { childProfile: true },
  });
  if (!grant) {
    throw new AuthzError('Kein Zugriff auf dieses Kinderprofil.');
  }
  return { user, teacherProfile, grant };
}
