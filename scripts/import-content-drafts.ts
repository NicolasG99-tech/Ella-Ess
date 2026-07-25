// Importiert Geschichten aus dem Autoren-Workspace (content-drafts/) und
// erzeugt daraus TypeScript-Dateien unter src/content/generated/ — siehe
// docs/CONTENT_AUTHORING.md für das vollständige Format.
//
// Bewusst kein YAML-Parser (keine neue npm-Abhängigkeit nötig, siehe
// Kommentar in package.json) — meta.json statt meta.yaml.
//
// Nach dem Import: `npm run db:seed` (bzw. db:migrate + db:seed), damit die
// Inhalte tatsächlich in der Datenbank landen. Dieses Skript schreibt nur
// TS-Dateien und Illustrations-Assets, keine Datenbank-Änderungen.
//
// Aufruf: npm run content:import

import { readdirSync, readFileSync, mkdirSync, copyFileSync, writeFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');
const DRAFTS_DIR = join(REPO_ROOT, 'content-drafts');
const GENERATED_DIR = join(REPO_ROOT, 'src/content/generated');
const ILLUSTRATIONS_DIR = join(REPO_ROOT, 'public/illustrations');

// Muss mit dem IllustrationLayerName-Enum in prisma/schema.prisma
// übereinstimmen (TS-Enum-Werte sind zur Laufzeit nicht prüfbar, daher hier
// als Laufzeit-Liste dupliziert).
const VALID_LAYER_NAMES = [
  'background',
  'main_character',
  'object',
  'secondary_character',
  'final_scene',
] as const;

const VALID_QUESTION_TYPES = ['multiple_choice', 'ordering', 'statement', 'inference'] as const;

interface DraftMetaLayer {
  name: string;
  renderOrder: number;
  unlockAfterSectionOrder: number;
}

interface DraftMetaQuestion {
  order: number;
  type: string;
  prompt: string;
  options?: string[];
  correctAnswer: unknown;
  hintText?: string;
}

interface DraftMeta {
  slug: string;
  title: string;
  description: string;
  ageRange: string;
  difficultyLevel: 1 | 2 | 3;
  learningGoals: string[];
  illustrationLayers: DraftMetaLayer[];
  comprehensionQuestions?: DraftMetaQuestion[];
}

function fail(message: string): never {
  console.error(`[content:import] Fehler: ${message}`);
  process.exit(1);
}

function toCamelCase(slug: string): string {
  return slug.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function readSections(storyDir: string, slug: string): { order: number; text: string }[] {
  const sectionsDir = join(storyDir, 'sections');
  let files: string[];
  try {
    files = readdirSync(sectionsDir).filter((name) => name.endsWith('.md'));
  } catch {
    fail(`"${slug}": Ordner "sections/" fehlt oder ist leer.`);
  }

  if (files.length === 0) {
    fail(`"${slug}": "sections/" enthält keine .md-Dateien.`);
  }

  return files
    .map((file) => {
      const order = Number(basename(file, '.md'));
      if (!Number.isInteger(order)) {
        fail(`"${slug}": Abschnittsdatei "${file}" muss "<Zahl>.md" heißen (z.B. "1.md").`);
      }
      const text = readFileSync(join(sectionsDir, file), 'utf-8').trim();
      return { order, text };
    })
    .sort((a, b) => a.order - b.order);
}

function copyIllustrations(storyDir: string, slug: string, layers: DraftMetaLayer[]): void {
  const illustrationsSrcDir = join(storyDir, 'illustrations');
  const destDir = join(ILLUSTRATIONS_DIR, slug);
  mkdirSync(destDir, { recursive: true });

  for (const layer of layers) {
    if (!VALID_LAYER_NAMES.includes(layer.name as (typeof VALID_LAYER_NAMES)[number])) {
      fail(
        `"${slug}": Ebenenname "${layer.name}" ungültig. Erlaubt: ${VALID_LAYER_NAMES.join(', ')}.`,
      );
    }
    const svgSrc = join(illustrationsSrcDir, `${layer.name}.svg`);
    try {
      statSync(svgSrc);
    } catch {
      fail(`"${slug}": Illustrationsdatei "illustrations/${layer.name}.svg" fehlt.`);
    }
    copyFileSync(svgSrc, join(destDir, `${layer.name}.svg`));
  }
}

function importStory(storyDir: string): { slug: string; varName: string } {
  const folderName = basename(storyDir);
  const metaPath = join(storyDir, 'meta.json');

  let meta: DraftMeta;
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as DraftMeta;
  } catch (error) {
    fail(`"${folderName}": meta.json fehlt oder ist kein gültiges JSON (${String(error)}).`);
  }

  if (meta.slug !== folderName) {
    fail(`"${folderName}": meta.json-Feld "slug" ("${meta.slug}") muss dem Ordnernamen entsprechen.`);
  }

  for (const question of meta.comprehensionQuestions ?? []) {
    if (!VALID_QUESTION_TYPES.includes(question.type as (typeof VALID_QUESTION_TYPES)[number])) {
      fail(
        `"${folderName}": Fragetyp "${question.type}" ungültig. Erlaubt: ${VALID_QUESTION_TYPES.join(', ')}.`,
      );
    }
  }

  const sections = readSections(storyDir, folderName);
  copyIllustrations(storyDir, folderName, meta.illustrationLayers);

  const storyContent = {
    slug: meta.slug,
    title: meta.title,
    description: meta.description,
    ageRange: meta.ageRange,
    difficultyLevel: meta.difficultyLevel,
    learningGoals: meta.learningGoals,
    sections,
    illustrationLayers: meta.illustrationLayers.map((layer) => ({
      name: layer.name,
      assetKey: `${meta.slug}/${layer.name}.svg`,
      renderOrder: layer.renderOrder,
      unlockAfterSectionOrder: layer.unlockAfterSectionOrder,
    })),
    comprehensionQuestions: meta.comprehensionQuestions ?? [],
  };

  const varName = `${toCamelCase(meta.slug)}Story`;
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(
    join(GENERATED_DIR, `${meta.slug}.ts`),
    `// Automatisch erzeugt von scripts/import-content-drafts.ts aus\n` +
      `// content-drafts/${meta.slug}/ — nicht von Hand bearbeiten, siehe\n` +
      `// docs/CONTENT_AUTHORING.md.\n` +
      `import type { StoryContent } from '@/content/types';\n\n` +
      `export const ${varName}: StoryContent = ${JSON.stringify(storyContent, null, 2)};\n`,
  );

  return { slug: meta.slug, varName };
}

function main() {
  let storyFolders: string[];
  try {
    storyFolders = readdirSync(DRAFTS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
      .map((entry) => entry.name);
  } catch {
    console.log('[content:import] Kein content-drafts/-Ordner gefunden — nichts zu tun.');
    return;
  }

  if (storyFolders.length === 0) {
    console.log('[content:import] content-drafts/ enthält keine Geschichten-Ordner.');
  }

  const imported = storyFolders.map((folder) => importStory(join(DRAFTS_DIR, folder)));

  const indexContent =
    `// Automatisch erzeugt von scripts/import-content-drafts.ts — nicht von\n` +
    `// Hand bearbeiten, siehe docs/CONTENT_AUTHORING.md.\n` +
    `import type { StoryContent } from '@/content/types';\n` +
    imported.map((s) => `import { ${s.varName} } from '@/content/generated/${s.slug}';\n`).join('') +
    `\nexport const generatedStories: StoryContent[] = [${imported.map((s) => s.varName).join(', ')}];\n`;

  writeFileSync(join(GENERATED_DIR, 'index.ts'), indexContent);

  console.log(
    `[content:import] ${imported.length} Geschichte(n) importiert: ${imported.map((s) => s.slug).join(', ') || '(keine)'}.`,
  );
  console.log('[content:import] Nächster Schritt: npm run db:seed, um die Inhalte in die DB zu übernehmen.');
}

main();
