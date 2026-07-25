export interface ExpectedWord {
  index: number;
  word: string;
  acceptedVariants: string[];
}

// Zerlegt einen Abschnittstext in die für die Textpositions-Erkennung (Meilenstein 4)
// erwarteten Wörter. Inhaltsautoren schreiben nur den Fließtext; die Wortliste wird
// daraus mechanisch abgeleitet statt manuell gepflegt.
const PUNCTUATION_PATTERN = /^[„"″,.!?—–:;()]+|[„"″,.!?—–:;()]+$/g;

export function deriveExpectedWords(text: string): ExpectedWord[] {
  return text
    .split(/\s+/)
    .map((raw) => raw.replace(PUNCTUATION_PATTERN, ''))
    .filter((word) => word.length > 0)
    .map((word, index) => ({ index, word, acceptedVariants: [] }));
}
