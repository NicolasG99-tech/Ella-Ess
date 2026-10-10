'use server';

import { requireOwnChildProfile } from '@/lib/server/authz';
import { checkChildContentRateLimit } from '@/lib/server/rate-limit';
import {
  resolveHelp,
  startOrResumeReadingSession,
  submitReadingAttempt,
  type ResolveHelpParams,
  type ResolveHelpResult,
  type SubmitReadingAttemptParams,
  type SubmitReadingAttemptResult,
} from '@/lib/reading/readingSessionService';

// Freundliche, nicht wertende Rückmeldung bei Rate-Limit-Sperre — bewusst im
// selben Ton wie MESSAGES.unavailable in sessionStateMachine.ts ("liegt
// nicht an dir"), damit sie über dieselbe UI (STATE_STYLES['provider_unavailable']
// in ReadingView.tsx) angezeigt werden kann, ohne die pure, unit-getestete
// Zustandsmaschine selbst um einen neuen Zustand zu erweitern. Siehe
// AGENTS.md/EDUCATIONAL_MODEL.md — kein "zu schnell"/"zu viele Versuche" o.Ä.
const RATE_LIMIT_MESSAGE = 'Kurze Pause — das war schnell hintereinander! Gleich geht’s weiter.';

/**
 * Startet eine neue Lesesitzung für die angegebene Geschichte oder setzt eine
 * bereits aktive Sitzung fort.
 *
 * @param childProfileId - ID des Kinderprofils; wird gegen die eingeloggte
 *   Elternsitzung geprüft (requireOwnChildProfile, IDOR-Schutz).
 * @param storySlug - Slug der Geschichte aus dem Content-Katalog.
 * @returns Sitzungs-ID, aktueller Abschnitt sowie der vollständige
 *   Geschichtentext samt bereits freigeschalteter Illustrationen.
 * @sideeffect Legt bei Bedarf eine neue ReadingSession an und schreibt einen
 *   Audit-Log-Eintrag (`reading_session.start`).
 */
export async function startOrResumeReadingSessionAction(childProfileId: string, storySlug: string) {
  const { user, childProfile } = await requireOwnChildProfile(childProfileId);
  return startOrResumeReadingSession(childProfile.id, storySlug, user.id);
}

/**
 * Nimmt einen Leseversuch (Audioaufnahme oder Mock-Szenario) entgegen,
 * bewertet ihn über den konfigurierten Spracherkennungs-Provider und
 * aktualisiert Sitzungsfortschritt/Illustrationsfreischaltungen entsprechend.
 *
 * @param input - Sitzungs-/Abschnittskontext, aktuelle Wortposition,
 *   bisherige Retry-Anzahl sowie die Audiodaten (oder ein erzwungenes
 *   Testszenario im Mock-Modus).
 * @returns Bewertungsergebnis inkl. UI-Zustand, Nutzertext, neuer
 *   Wortposition und ggf. neu freigeschalteter Illustrationen/Belohnungen.
 * @sideeffect Legt einen ReadingAttempt- und ggf. WordEvaluation-Datensatz an.
 *   Bei Überschreiten des Rate-Limits (10 Aktionen/Min pro Kinderprofil,
 *   checkChildContentRateLimit) wird ein synthetisches Ergebnis mit
 *   uiState 'provider_unavailable' zurückgegeben, OHNE die zugrunde liegende
 *   Service-Funktion (und damit die Provider-Anfrage) überhaupt aufzurufen.
 */
export async function submitReadingAttemptAction(
  input: SubmitReadingAttemptParams,
): Promise<SubmitReadingAttemptResult> {
  const { childProfile } = await requireOwnChildProfile(input.childProfileId);

  if (!(await checkChildContentRateLimit(childProfile.id))) {
    return {
      evaluationState: 'unavailable',
      uiState: 'provider_unavailable',
      message: RATE_LIMIT_MESSAGE,
      retryCount: input.retryCount,
      newLocalPosition: input.localPosition,
      sectionWordCount: 0,
      sectionComplete: false,
      sessionComplete: false,
      newlyUnlockedIllustrations: [],
      newlyEarnedRewards: [],
    };
  }

  return submitReadingAttempt({ ...input, childProfileId: childProfile.id });
}

/**
 * Löst eine Hilfestellung für das aktuelle Wort aus (Kind gibt auf statt
 * weiter zu raten) und rückt die Sitzung um ein Wort weiter.
 *
 * @param input - Sitzungs-/Abschnittskontext und aktuelle Wortposition.
 * @returns Neuer UI-Zustand (immer 'help_offered' bei Erfolg), Nutzertext und
 *   aktualisierter Fortschritt inkl. ggf. neu freigeschalteter
 *   Illustrationen/Belohnungen.
 * @sideeffect Legt einen ReadingAttempt (state: 'skipped') und ggf. einen
 *   WordEvaluation-Datensatz an. Unterliegt demselben Rate-Limit wie
 *   submitReadingAttemptAction (siehe dortiger Kommentar).
 */
export async function resolveHelpAction(input: ResolveHelpParams): Promise<ResolveHelpResult> {
  const { childProfile } = await requireOwnChildProfile(input.childProfileId);

  if (!(await checkChildContentRateLimit(childProfile.id))) {
    return {
      uiState: 'provider_unavailable',
      message: RATE_LIMIT_MESSAGE,
      retryCount: 0,
      newLocalPosition: input.localPosition,
      sectionWordCount: 0,
      sectionComplete: false,
      sessionComplete: false,
      newlyUnlockedIllustrations: [],
      newlyEarnedRewards: [],
    };
  }

  return resolveHelp({ ...input, childProfileId: childProfile.id });
}
