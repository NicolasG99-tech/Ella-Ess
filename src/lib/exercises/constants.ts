// Maximal zwei Versuche pro Übungs-Item (analog zu den Verständnisfragen).
// Eigene Datei, damit sowohl exerciseService.ts als auch
// gamificationService.ts (Zählung abgeschlossener Übungen) darauf zugreifen
// können, ohne dass sich die beiden Module gegenseitig importieren.
export const MAX_ATTEMPTS = 2;
