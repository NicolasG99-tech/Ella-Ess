// Vergleicht eine eingereichte Antwort typabhängig mit der hinterlegten
// Lösung (siehe prisma/schema.prisma, ComprehensionQuestion.correctAnswer).
// Rein und ohne Seiteneffekte, damit sie unabhängig von der Datenbank
// getestet werden kann.

function normalizeString(value: string): string {
  return value.trim().toLowerCase();
}

function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => {
    const left = value;
    const right = b[index];
    if (typeof left === 'string' && typeof right === 'string') {
      return normalizeString(left) === normalizeString(right);
    }
    return left === right;
  });
}

export function evaluateComprehensionAnswer(
  correctAnswer: unknown,
  submittedAnswer: unknown,
): boolean {
  if (typeof correctAnswer === 'boolean') {
    return correctAnswer === submittedAnswer;
  }

  if (typeof correctAnswer === 'string') {
    return (
      typeof submittedAnswer === 'string' &&
      normalizeString(correctAnswer) === normalizeString(submittedAnswer)
    );
  }

  if (Array.isArray(correctAnswer)) {
    return Array.isArray(submittedAnswer) && arraysEqual(correctAnswer, submittedAnswer);
  }

  return correctAnswer === submittedAnswer;
}
