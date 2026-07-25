import { db } from '@/lib/server/db';
import { MAX_ATTEMPTS } from '@/lib/exercises/constants';
import { countDistinctPracticeDays } from '@/lib/gamification/milestones';
import { describeMasteryLevel } from '@/lib/progress/masteryLevelLabel';
import {
  buildErrorTypeBreakdown,
  summarizeComprehensionAccuracyByType,
  summarizeExerciseAccuracyByType,
  type ComprehensionTypeAccuracyEntry,
  type ErrorTypeBreakdownEntry,
  type ExerciseTypeAccuracyEntry,
} from '@/lib/progress/assessmentCalculations';
import type { EvaluationState } from '@/generated/prisma/enums';

// Generischer, aus vorhandenen Übungsdaten abgeleiteter Assessment-Bogen für
// Fachkräfte und Lehrkräfte — strukturiert wie eine fachliche Auswertung
// (Skill-Bereiche nach Übungsbedarf sortiert, Fehlerarten, Genauigkeit nach
// Aufgabentyp, Aktivitätsverlauf), aber bewusst ohne Anspruch auf ein
// konkretes externes Diagnostikverfahren. Wird sowohl von der
// Fachkräfte-Detailseite (/fachkraft/[grantId]) als auch der
// Lehrkräfte-Detailseite (/lehrer/[grantId]) über dieselbe
// <AssessmentSheet>-Komponente genutzt. Siehe docs/EDUCATIONAL_MODEL.md,
// Abschnitt "Grenzen automatischer Auswertung" — dieselben Grenzen wie beim
// Eltern-Dashboard gelten hier unverändert.

export interface SkillAssessmentEntry {
  skillName: string;
  masteryLevel: number;
  label: string;
  lastPracticedAt: Date;
}

export interface ChildAssessment {
  childDisplayName: string;
  firstActivityAt: Date | null;
  lastActivityAt: Date | null;
  completedSessionCount: number;
  distinctPracticeDays: number;
  skills: SkillAssessmentEntry[];
  wordErrorBreakdown: ErrorTypeBreakdownEntry[];
  exerciseAccuracyByType: ExerciseTypeAccuracyEntry[];
  comprehensionAccuracyByType: ComprehensionTypeAccuracyEntry[];
}

export async function getChildAssessment(childProfileId: string): Promise<ChildAssessment> {
  const [
    childProfile,
    skillProgress,
    earliestSessions,
    completedSessions,
    spellingAttempts,
    comprehensionAttempts,
    wordEvaluationCounts,
  ] = await Promise.all([
    db.childProfile.findUniqueOrThrow({
      where: { id: childProfileId },
      select: { displayName: true },
    }),
    // Aufsteigend nach Beherrschungsgrad — Bereiche mit dem größten Übungsbedarf
    // stehen für die Fachkraft/Lehrkraft zuerst.
    db.skillProgress.findMany({
      where: { childProfileId },
      include: { literacySkill: true },
      orderBy: { masteryLevel: 'asc' },
    }),
    db.readingSession.findMany({
      where: { childProfileId },
      select: { startedAt: true },
      orderBy: { startedAt: 'asc' },
      take: 1,
    }),
    db.readingSession.findMany({
      where: { childProfileId, status: 'completed' },
      select: { completedAt: true },
    }),
    db.spellingAttempt.findMany({
      where: { childProfileId },
      select: {
        exerciseItemId: true,
        attemptNumber: true,
        isCorrect: true,
        createdAt: true,
        exerciseItem: { select: { exercise: { select: { type: true } } } },
      },
    }),
    db.comprehensionAttempt.findMany({
      where: { readingSession: { childProfileId } },
      select: {
        attemptNumber: true,
        isCorrect: true,
        comprehensionQuestion: { select: { type: true } },
      },
    }),
    db.wordEvaluation.groupBy({
      by: ['state'],
      where: { readingAttempt: { readingSession: { childProfileId } } },
      _count: true,
    }),
  ]);

  const skills: SkillAssessmentEntry[] = skillProgress.map((progress) => ({
    skillName: progress.literacySkill.name,
    masteryLevel: progress.masteryLevel,
    label: describeMasteryLevel(progress.masteryLevel),
    lastPracticedAt: progress.lastPracticedAt,
  }));

  const activityDates = [
    ...completedSessions.map((session) => session.completedAt as Date),
    ...spellingAttempts.map((attempt) => attempt.createdAt),
  ];
  const lastActivityAt =
    activityDates.length > 0
      ? new Date(Math.max(...activityDates.map((date) => date.getTime())))
      : null;

  const errorCounts: Partial<Record<EvaluationState, number>> = {};
  for (const group of wordEvaluationCounts) {
    errorCounts[group.state] = group._count;
  }

  return {
    childDisplayName: childProfile.displayName,
    firstActivityAt: earliestSessions[0]?.startedAt ?? null,
    lastActivityAt,
    completedSessionCount: completedSessions.length,
    distinctPracticeDays: countDistinctPracticeDays(activityDates),
    skills,
    wordErrorBreakdown: buildErrorTypeBreakdown(errorCounts),
    exerciseAccuracyByType: summarizeExerciseAccuracyByType(
      spellingAttempts.map((attempt) => ({
        exerciseItemId: attempt.exerciseItemId,
        exerciseType: attempt.exerciseItem.exercise.type,
        attemptNumber: attempt.attemptNumber,
        isCorrect: attempt.isCorrect,
      })),
      MAX_ATTEMPTS,
    ),
    comprehensionAccuracyByType: summarizeComprehensionAccuracyByType(
      comprehensionAttempts.map((attempt) => ({
        questionType: attempt.comprehensionQuestion.type,
        attemptNumber: attempt.attemptNumber,
        isCorrect: attempt.isCorrect,
      })),
    ),
  };
}
