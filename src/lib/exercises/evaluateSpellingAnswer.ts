// Die Rechtschreibauswertung akzeptiert ausschließlich die hinterlegte
// Lösung und explizit definierte zulässige Varianten (siehe Lastenheft 4.12)
// — kein Fuzzy-Matching, keine Toleranz für Tippfehler.

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function evaluateSpellingAnswer(
  submittedAnswer: string,
  solution: string,
  acceptedVariants: string[] = [],
): boolean {
  const normalizedSubmission = normalize(submittedAnswer);
  const validAnswers = [solution, ...acceptedVariants].map(normalize);
  return validAnswers.includes(normalizedSubmission);
}
