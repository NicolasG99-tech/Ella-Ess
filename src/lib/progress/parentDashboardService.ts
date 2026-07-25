import { db } from '@/lib/server/db';
import { MAX_ATTEMPTS } from '@/lib/exercises/constants';
import { countDistinctPracticeDays } from '@/lib/gamification/milestones';
import { describeMasteryLevel } from '@/lib/progress/masteryLevelLabel';
import { summarizeFirstTryAccuracy } from '@/lib/progress/comprehensionSummary';

// Aggregiert Lernfortschritt für das Eltern-Dashboard. Zeigt ausschließlich
// den eigenen Verlauf des Kindes — kein Vergleich mit anderen Kindern, keine
// pauschale "Lesealter"-Kennzahl (siehe docs/EDUCATIONAL_MODEL.md, Abschnitt
// "Grenzen automatischer Auswertung").

export interface SkillMasteryEntry {
  skillName: string;
  masteryLevel: number;
  label: string;
  lastPracticedAt: Date;
}

export interface LearningProfileMasteryGroup {
  learningProfileName: string;
  skills: SkillMasteryEntry[];
}

export interface RecentSessionEntry {
  storyTitle: string;
  completedAt: Date;
  sectionCount: number;
}

export interface ChildProgressOverview {
  masteryGroups: LearningProfileMasteryGroup[];
  recentSessions: RecentSessionEntry[];
  completedSessionCount: number;
  completedExerciseCount: number;
  distinctPracticeDays: number;
  comprehensionFirstTryCorrect: number;
  comprehensionFirstTryTotal: number;
  // Startzeitpunkt der allerersten Lesesitzung (unabhängig vom Status) — für
  // die laienverständliche "Wie hat [Kind] begonnen"-Einordnung im
  // Eltern-Dashboard, siehe parentSummary.ts.
  firstActivityAt: Date | null;
}

export async function getChildProgressOverview(
  childProfileId: string,
): Promise<ChildProgressOverview> {
  const [
    skillProgress,
    completedSessions,
    exerciseAttempts,
    comprehensionAttempts,
    earliestSessions,
  ] = await Promise.all([
    db.skillProgress.findMany({
      where: { childProfileId },
      include: { literacySkill: { include: { learningProfile: true } } },
      orderBy: { lastPracticedAt: 'desc' },
    }),
    db.readingSession.findMany({
      where: { childProfileId, status: 'completed' },
      orderBy: { completedAt: 'desc' },
      include: { story: { select: { title: true, _count: { select: { sections: true } } } } },
    }),
    db.spellingAttempt.findMany({
      where: {
        childProfileId,
        OR: [{ isCorrect: true }, { attemptNumber: { gte: MAX_ATTEMPTS } }],
      },
      select: { createdAt: true },
    }),
    db.comprehensionAttempt.findMany({
      where: { readingSession: { childProfileId } },
      select: { attemptNumber: true, isCorrect: true },
    }),
    db.readingSession.findMany({
      where: { childProfileId },
      select: { startedAt: true },
      orderBy: { startedAt: 'asc' },
      take: 1,
    }),
  ]);

  const masteryByProfile = new Map<string, SkillMasteryEntry[]>();
  for (const progress of skillProgress) {
    const profileName = progress.literacySkill.learningProfile?.name ?? 'Allgemein';
    const entries = masteryByProfile.get(profileName) ?? [];
    entries.push({
      skillName: progress.literacySkill.name,
      masteryLevel: progress.masteryLevel,
      label: describeMasteryLevel(progress.masteryLevel),
      lastPracticedAt: progress.lastPracticedAt,
    });
    masteryByProfile.set(profileName, entries);
  }
  const masteryGroups: LearningProfileMasteryGroup[] = Array.from(masteryByProfile.entries()).map(
    ([learningProfileName, skills]) => ({ learningProfileName, skills }),
  );

  const recentSessions: RecentSessionEntry[] = completedSessions.slice(0, 5).map((session) => ({
    storyTitle: session.story.title,
    completedAt: session.completedAt as Date,
    sectionCount: session.story._count.sections,
  }));

  const practiceDates = [
    ...completedSessions.map((session) => session.completedAt as Date),
    ...exerciseAttempts.map((attempt) => attempt.createdAt),
  ];

  const { firstTryCorrect, totalFirstAttempts } = summarizeFirstTryAccuracy(comprehensionAttempts);

  return {
    masteryGroups,
    recentSessions,
    completedSessionCount: completedSessions.length,
    completedExerciseCount: exerciseAttempts.length,
    distinctPracticeDays: countDistinctPracticeDays(practiceDates),
    comprehensionFirstTryCorrect: firstTryCorrect,
    comprehensionFirstTryTotal: totalFirstAttempts,
    firstActivityAt: earliestSessions[0]?.startedAt ?? null,
  };
}
