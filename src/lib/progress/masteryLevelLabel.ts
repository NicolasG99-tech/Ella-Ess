// Übersetzt einen rohen Beherrschungsgrad (0–1, siehe masteryCalculation.ts)
// in eine kurze, ermutigende Beschreibung für das Eltern-Dashboard — bewusst
// keine Prozentzahl, kein Schulnoten-Framing (siehe
// docs/EDUCATIONAL_MODEL.md, Abschnitt "Grenzen automatischer Auswertung").
export function describeMasteryLevel(masteryLevel: number): string {
  if (masteryLevel >= 0.67) return 'Sicher';
  if (masteryLevel >= 0.34) return 'Wird sicherer';
  return 'Wird geübt';
}
