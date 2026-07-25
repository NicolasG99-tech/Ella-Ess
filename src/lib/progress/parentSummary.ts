import type { ChildProgressOverview } from '@/lib/progress/parentDashboardService';

// Laienverständliche Einordnung für das Eltern-Dashboard — pure Funktion,
// getrennt von parentDashboardService.ts (das die DB-Abfrage übernimmt),
// nach demselben Muster wie masteryCalculation.ts/comprehensionSummary.ts.
// Ergänzt (nicht ersetzt) die vorhandene <ProgressOverviewSummary>: Eltern
// sollen zuerst eine kurze Einschätzung in eigenen Worten sehen ("Wie hat
// [Kind] begonnen", "Wo steht [Kind] jetzt", "Worauf achten"), die
// Detail-Balken bleiben für alle, die es genauer wissen wollen. Bewusst
// heuristisch aus den vorhandenen Übungsdaten abgeleitet — keine Diagnose,
// siehe docs/EDUCATIONAL_MODEL.md, Abschnitt "Grenzen automatischer
// Auswertung".

const LOW_MASTERY_THRESHOLD = 0.34; // deckt sich mit "Wird geübt" in masteryLevelLabel.ts
const LOW_COMPREHENSION_RATE = 0.5;
const STAGNATION_DAYS = 14;

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export interface AttentionFlag {
  skillName: string;
  reason: string;
}

export interface ParentFriendlySummary {
  startedText: string | null;
  nowText: string;
  attentionFlags: AttentionFlag[];
}

export function buildParentFriendlySummary(
  childDisplayName: string,
  overview: ChildProgressOverview,
  now: Date = new Date(),
): ParentFriendlySummary {
  const startedText = overview.firstActivityAt
    ? `${childDisplayName} liest seit dem ${DATE_FORMAT.format(overview.firstActivityAt)} mit Lese-Abenteuer.`
    : null;

  const allSkills = overview.masteryGroups.flatMap((group) => group.skills);
  const secureCount = allSkills.filter((skill) => skill.masteryLevel >= 0.67).length;

  let nowText: string;
  if (allSkills.length === 0) {
    nowText =
      'Noch keine Übungsdaten vorhanden — diese Einschätzung füllt sich nach den ersten Geschichten und Übungen.';
  } else if (secureCount === allSkills.length) {
    nowText = `${childDisplayName} zeigt aktuell in allen geübten Bereichen eine sichere Grundlage.`;
  } else if (secureCount === 0) {
    nowText = `${childDisplayName} übt aktuell noch in allen bisher begonnenen Bereichen — das ist am Anfang ganz normal.`;
  } else {
    nowText = `${childDisplayName} zeigt in ${secureCount} von ${allSkills.length} geübten Bereichen bereits eine sichere Grundlage, die übrigen werden noch geübt.`;
  }

  const attentionFlags: AttentionFlag[] = [];

  for (const skill of allSkills) {
    if (skill.masteryLevel < LOW_MASTERY_THRESHOLD) {
      attentionFlags.push({
        skillName: skill.skillName,
        reason: 'Wird noch viel geübt — hier kann zusätzliche Unterstützung helfen.',
      });
      continue;
    }
    const daysSincePracticed = Math.floor(
      (now.getTime() - skill.lastPracticedAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSincePracticed >= STAGNATION_DAYS) {
      attentionFlags.push({
        skillName: skill.skillName,
        reason: `Seit ${daysSincePracticed} Tagen nicht mehr geübt.`,
      });
    }
  }

  if (overview.comprehensionFirstTryTotal > 0) {
    const rate = overview.comprehensionFirstTryCorrect / overview.comprehensionFirstTryTotal;
    if (rate < LOW_COMPREHENSION_RATE) {
      attentionFlags.push({
        skillName: 'Leseverständnis',
        reason: `Nur ${overview.comprehensionFirstTryCorrect} von ${overview.comprehensionFirstTryTotal} Verständnisfragen wurden beim ersten Versuch richtig beantwortet.`,
      });
    }
  }

  return { startedText, nowText, attentionFlags };
}
