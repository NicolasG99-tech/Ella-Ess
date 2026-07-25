// Reine Hilfsfunktionen für die Belohnungsvergabe (siehe gamificationService.ts).
// Unabhängig von der Datenbank testbar.

export function reachesMilestone(count: number, threshold: number): boolean {
  return count >= threshold;
}

// Zählt an wie vielen unterschiedlichen Kalendertagen (UTC) geübt wurde.
// UTC statt lokaler Zeitzone, da Datum hier nur grob als Anhaltspunkt für
// Regelmäßigkeit dient, nicht als exakte Tagesgrenze im Sinne des Kindes.
export function countDistinctPracticeDays(dates: Date[]): number {
  const days = new Set(dates.map((date) => date.toISOString().slice(0, 10)));
  return days.size;
}
