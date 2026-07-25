# Content-Autoren-Workspace

Dieses Dokument beschreibt, wie neue Geschichten (Texte + Illustrationen) angelegt werden,
ohne TypeScript-Code in `src/content/stories.ts` von Hand zu schreiben.

## Ablauf

1. Neuen Ordner unter `content-drafts/<slug>/` anlegen (Format wie unten, `_beispiel-geschichte/`
   als Vorlage nutzen — der Unterstrich-Präfix sorgt dafür, dass dieser Beispielordner beim
   Import übersprungen wird).
2. `npm run content:import` ausführen. Das Skript (`scripts/import-content-drafts.ts`):
   - liest `meta.json` und alle `sections/*.md`,
   - kopiert die Illustrationen nach `public/illustrations/<slug>/`,
   - erzeugt `src/content/generated/<slug>.ts` (nicht von Hand bearbeiten — wird bei jedem
     Import überschrieben),
   - bricht mit einer klaren Fehlermeldung ab, wenn etwas fehlt oder falsch benannt ist
     (z. B. ungültiger Ebenenname, fehlende SVG-Datei).
3. `npm run db:seed` ausführen, damit die neuen Inhalte tatsächlich in der Datenbank landen
   (das Import-Skript selbst ändert die Datenbank nicht, nur Dateien).
4. Redaktionelle Prüfung wie bisher: Pull Request mit den neuen/geänderten Dateien unter
   `content-drafts/` und `src/content/generated/` — siehe docs/EDUCATIONAL_MODEL.md,
   Abschnitt „Content-Freigabeprozess" (Vier-Augen-Prinzip gilt unverändert).

## Ordnerformat

```
content-drafts/<slug>/
  meta.json
  sections/
    1.md
    2.md
    3.md          ← eine Datei pro Abschnitt, Dateiname = Reihenfolge (order)
  illustrations/
    background.svg
    main_character.svg
    object.svg
    secondary_character.svg
    final_scene.svg
```

`<slug>` muss mit dem `"slug"`-Feld in `meta.json` übereinstimmen und URL-tauglich sein
(Kleinbuchstaben, Bindestriche).

### meta.json

```json
{
  "slug": "mein-geschichten-slug",
  "title": "Titel der Geschichte",
  "description": "Kurzbeschreibung.",
  "ageRange": "7-8",
  "difficultyLevel": 1,
  "learningGoals": ["kurze_woerter", "einfache_saetze"],
  "illustrationLayers": [
    { "name": "background", "renderOrder": 1, "unlockAfterSectionOrder": 1 },
    { "name": "main_character", "renderOrder": 2, "unlockAfterSectionOrder": 1 },
    { "name": "object", "renderOrder": 3, "unlockAfterSectionOrder": 1 },
    { "name": "secondary_character", "renderOrder": 4, "unlockAfterSectionOrder": 2 },
    { "name": "final_scene", "renderOrder": 5, "unlockAfterSectionOrder": 2 }
  ],
  "comprehensionQuestions": [
    { "order": 1, "type": "statement", "prompt": "...", "correctAnswer": true }
  ]
}
```

- `illustrationLayers[].name` muss exakt einer der fünf im Datenmodell festgelegten Werte
  sein: `background`, `main_character`, `object`, `secondary_character`, `final_scene`
  (siehe `prisma/schema.prisma`, `IllustrationLayerName`). Jede Geschichte braucht alle fünf.
- `unlockAfterSectionOrder` ist der **Fallback**: die Ebene wird spätestens freigeschaltet,
  sobald dieser Abschnitt abgeschlossen ist. Feingranularere Freischaltung **innerhalb**
  eines Abschnitts läuft über Inline-Marker im Text (siehe unten) — wenn ein Marker für eine
  Ebene existiert, hat er Vorrang vor diesem Feld.
- `comprehensionQuestions[].type`: `multiple_choice` | `ordering` | `statement` | `inference`.

### sections/\*.md

Reiner Lesetext, ein Abschnitt (2–5 Sätze) pro Datei. Absätze/Zeilenumbrüche wie gewünscht.

## Inline-Marker für Illustrationsfreischaltung

Um eine Illustrationsebene an einer bestimmten Stelle **innerhalb** eines Abschnitts
freizuschalten (statt erst am Abschnittsende), einen Marker direkt in den Text schreiben:

```
Der kleine Fuchs lief durch den Wald [[unlock:background]]. Plötzlich sah er etwas
Glänzendes im Gras [[unlock:object]]. Es war ein alter Schlüssel.
```

- `layerName` in `[[unlock:layerName]]` muss einer der fünf Ebenennamen sein (siehe oben).
- Der Marker wird beim Seeden automatisch entfernt — er erscheint **nie** im Text, den das
  Kind sieht oder vorliest, und beeinflusst nicht die Spracherkennung.
- Marker mit Leerzeichen umgeben, zwischen zwei Wörtern platzieren (nicht mitten in einem
  Wort) — sonst kann die Wortzählung an der Markerstelle verrutschen.
- Höchstens ein Marker pro Ebene pro Geschichte wird ausgewertet (der erste gefundene).
- Ohne Marker für eine Ebene gilt weiterhin der klassische, in `meta.json` gesetzte
  `unlockAfterSectionOrder`-Wert (Freischaltung erst bei Abschnittsende).

Technisch: `src/lib/content/parseUnlockCheckpoints.ts` entfernt die Marker und berechnet die
Wortposition; `prisma/seed.ts` schreibt sie als `unlockAfterWordIndex` auf die jeweilige
`IllustrationLayer`; `src/lib/reading/illustrationUnlockService.ts`
(`unlockIllustrationsForWordCheckpoint`) prüft diese Position bei jedem Leseversuch,
zusätzlich zur bestehenden abschnittsweisen Freischaltung.
