import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/lib/server/password.js';
import { deriveExpectedWords } from '../src/lib/content/deriveExpectedWords.js';
import {
  parseUnlockCheckpoints,
  type UnlockCheckpoint,
} from '../src/lib/content/parseUnlockCheckpoints.js';
import { literacySkills } from '../src/content/literacySkills.js';
import { stories } from '../src/content/stories.js';
import { exercises } from '../src/content/exercises.js';
import { rewards } from '../src/content/rewards.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CONSENT_VERSION = '2026-07-15';

// Lernprofile sind Stammdaten (siehe docs/EDUCATIONAL_MODEL.md) und werden
// unabhängig von Story-/Übungsinhalten (Meilenstein 3) hier verankert, da
// ChildProfile bereits in Meilenstein 2 darauf verweist.
async function seedLearningProfiles() {
  await prisma.learningProfile.upsert({
    where: { code: 'reading_basics' },
    update: {},
    create: {
      code: 'reading_basics',
      name: 'Lesegrundlagen',
      description:
        'Buchstaben-Laut-Beziehungen, kurze Wörter, Silben, einfache Sätze, Lesegenauigkeit.',
      focusAreas: [
        'buchstaben_laut_beziehungen',
        'kurze_woerter',
        'silben',
        'einfache_saetze',
        'lesegenauigkeit',
      ],
    },
  });

  await prisma.learningProfile.upsert({
    where: { code: 'fluency' },
    update: {},
    create: {
      code: 'fluency',
      name: 'Leseflüssigkeit',
      description: 'Kurze Texte, genaues Lesen, flüssigeres Lesen, Satzgrenzen, Selbstkorrekturen.',
      focusAreas: [
        'kurze_texte',
        'genaues_lesen',
        'fluessigeres_lesen',
        'satzgrenzen',
        'selbstkorrekturen',
      ],
    },
  });

  await prisma.learningProfile.upsert({
    where: { code: 'spelling_basics' },
    update: {},
    create: {
      code: 'spelling_basics',
      name: 'Grundlegende Rechtschreibung',
      description:
        'Laut-Buchstaben-Zuordnung, häufige Wortmuster, kurze Diktate, Lückentexte, Wortbausteine.',
      focusAreas: [
        'laut_buchstaben_zuordnung',
        'wortmuster',
        'diktate',
        'lueckentexte',
        'wortbausteine',
      ],
    },
  });
}

async function seedLiteracySkills() {
  for (const skill of literacySkills) {
    const learningProfile = await prisma.learningProfile.findUniqueOrThrow({
      where: { code: skill.learningProfileCode },
    });
    await prisma.literacySkill.upsert({
      where: { code: skill.code },
      update: {},
      create: {
        code: skill.code,
        name: skill.name,
        description: skill.description,
        learningProfileId: learningProfile.id,
      },
    });
  }
  console.log(`${literacySkills.length} Literacy-Skills angelegt.`);
}

// Kuratierte Geschichten inkl. Abschnitte, Illustrationsebenen und
// Verständnisfragen. Inhalte selbst kommen aus src/content/stories.ts (siehe
// docs/EDUCATIONAL_MODEL.md, Abschnitt "Content-Freigabeprozess") — hier wird
// nur upserted und die Wortliste pro Abschnitt automatisch abgeleitet.
async function seedStories() {
  for (const story of stories) {
    const created = await prisma.story.upsert({
      where: { slug: story.slug },
      update: {
        title: story.title,
        description: story.description,
        ageRange: story.ageRange,
        difficultyLevel: story.difficultyLevel,
        learningGoals: story.learningGoals,
      },
      create: {
        slug: story.slug,
        title: story.title,
        description: story.description,
        ageRange: story.ageRange,
        difficultyLevel: story.difficultyLevel,
        learningGoals: story.learningGoals,
      },
    });

    // Erster Durchlauf: [[unlock:layerName]]-Marker aus jedem Abschnittstext
    // entfernen (siehe lib/content/parseUnlockCheckpoints.ts) und pro Ebene
    // merken, in welchem Abschnitt/bei welcher Wortposition sie gefunden
    // wurden — MUSS vor deriveExpectedWords laufen, damit weder die
    // Worterkennung noch der für das Kind sichtbare Text die Marker enthält.
    // Erster gefundener Marker pro Ebene gewinnt (mehrfache Marker für
    // dieselbe Ebene in einer Geschichte sind nicht vorgesehen).
    const checkpointsByLayer = new Map<string, { sectionOrder: number } & UnlockCheckpoint>();
    const cleanedSections = story.sections.map((section) => {
      const parsed = parseUnlockCheckpoints(section.text);
      for (const checkpoint of parsed.checkpoints) {
        if (!checkpointsByLayer.has(checkpoint.layerName)) {
          checkpointsByLayer.set(checkpoint.layerName, {
            sectionOrder: section.order,
            ...checkpoint,
          });
        }
      }
      return { ...section, text: parsed.text };
    });

    for (const section of cleanedSections) {
      const expectedWords = deriveExpectedWords(section.text) as unknown as Prisma.InputJsonValue;
      await prisma.storySection.upsert({
        where: { storyId_order: { storyId: created.id, order: section.order } },
        update: { text: section.text, expectedWords },
        create: {
          storyId: created.id,
          order: section.order,
          text: section.text,
          expectedWords,
        },
      });
    }

    for (const layer of story.illustrationLayers) {
      const checkpoint = checkpointsByLayer.get(layer.name);
      const unlockAfterSectionOrder = checkpoint?.sectionOrder ?? layer.unlockAfterSectionOrder;
      const unlockAfterWordIndex = checkpoint?.wordIndex ?? null;

      await prisma.illustrationLayer.upsert({
        where: { storyId_name: { storyId: created.id, name: layer.name } },
        update: {
          assetKey: layer.assetKey,
          renderOrder: layer.renderOrder,
          unlockAfterSectionOrder,
          unlockAfterWordIndex,
        },
        create: {
          storyId: created.id,
          name: layer.name,
          assetKey: layer.assetKey,
          renderOrder: layer.renderOrder,
          unlockAfterSectionOrder,
          unlockAfterWordIndex,
        },
      });
    }

    for (const question of story.comprehensionQuestions) {
      const options = question.options as unknown as Prisma.InputJsonValue | undefined;
      const correctAnswer = question.correctAnswer as Prisma.InputJsonValue;
      await prisma.comprehensionQuestion.upsert({
        where: { storyId_order: { storyId: created.id, order: question.order } },
        update: {
          type: question.type,
          prompt: question.prompt,
          options,
          correctAnswer,
          hintText: question.hintText,
        },
        create: {
          storyId: created.id,
          order: question.order,
          type: question.type,
          prompt: question.prompt,
          options,
          correctAnswer,
          hintText: question.hintText,
        },
      });
    }
  }
  console.log(`${stories.length} Geschichten angelegt.`);
}

async function seedExercises() {
  for (const exercise of exercises) {
    const learningProfile = exercise.learningProfileCode
      ? await prisma.learningProfile.findUniqueOrThrow({
          where: { code: exercise.learningProfileCode },
        })
      : null;

    const existing = await prisma.exercise.findFirst({ where: { title: exercise.title } });
    const created =
      existing ??
      (await prisma.exercise.create({
        data: {
          type: exercise.type,
          title: exercise.title,
          difficultyLevel: exercise.difficultyLevel,
          learningProfileId: learningProfile?.id,
        },
      }));

    for (const item of exercise.items) {
      await prisma.exerciseItem.upsert({
        where: { exerciseId_order: { exerciseId: created.id, order: item.order } },
        update: {
          prompt: item.prompt,
          solution: item.solution,
          acceptedVariants: item.acceptedVariants,
          audioText: item.audioText,
        },
        create: {
          exerciseId: created.id,
          order: item.order,
          prompt: item.prompt,
          solution: item.solution,
          acceptedVariants: item.acceptedVariants,
          audioText: item.audioText,
        },
      });
    }
  }
  console.log(`${exercises.length} Übungssammlungen angelegt.`);
}

// Belohnungskatalog (Meilenstein 7, siehe src/content/rewards.ts).
async function seedRewards() {
  for (const reward of rewards) {
    await prisma.reward.upsert({
      where: { code: reward.code },
      update: {
        type: reward.type,
        name: reward.name,
        description: reward.description,
        xpValue: reward.xpValue,
      },
      create: {
        code: reward.code,
        type: reward.type,
        name: reward.name,
        description: reward.description,
        xpValue: reward.xpValue,
      },
    });
  }
  console.log(`${rewards.length} Belohnungen angelegt.`);
}

// Admin-Demokonto für die lokale Content-Verwaltung (/admin, Meilenstein 3).
async function seedAdminAccount() {
  const email = process.env.DEMO_ADMIN_EMAIL;
  const password = process.env.DEMO_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('DEMO_ADMIN_EMAIL/DEMO_ADMIN_PASSWORD nicht gesetzt — Admin-Konto übersprungen.');
    return;
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name: 'Demo-Admin', role: 'admin' },
  });

  console.log(`Admin-Demokonto bereit: ${email}.`);
}

// Demo-Elternkonto + Demo-Kinderprofil "Mia" (siehe README.md, Abschnitt "Demo-Zugang").
// Zugangsdaten kommen ausschließlich aus Umgebungsvariablen, nie fest im Code.
async function seedDemoAccount() {
  const email = process.env.DEMO_PARENT_EMAIL;
  const password = process.env.DEMO_PARENT_PASSWORD;

  if (!email || !password) {
    console.log('DEMO_PARENT_EMAIL/DEMO_PARENT_PASSWORD nicht gesetzt — Demo-Konto übersprungen.');
    return;
  }

  const passwordHash = await hashPassword(password);

  const parent = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: 'Demo-Elternteil',
      role: 'parent',
      consentRecords: {
        create: [
          { type: 'terms_of_service', version: CONSENT_VERSION },
          { type: 'privacy_policy', version: CONSENT_VERSION },
        ],
      },
    },
  });

  const readingBasics = await prisma.learningProfile.findUniqueOrThrow({
    where: { code: 'reading_basics' },
  });

  const existingChild = await prisma.childProfile.findFirst({
    where: { parentId: parent.id, displayName: 'Mia' },
  });

  if (!existingChild) {
    await prisma.childProfile.create({
      data: {
        parentId: parent.id,
        displayName: 'Mia',
        birthYear: new Date().getFullYear() - 8,
        avatarKey: 'avatar-02',
        currentLearningProfileId: readingBasics.id,
      },
    });
  }

  console.log(`Demo-Konto bereit: ${email} (Kinderprofil "Mia").`);
}

async function main() {
  await seedLearningProfiles();
  await seedLiteracySkills();
  await seedStories();
  await seedExercises();
  await seedRewards();
  await seedAdminAccount();
  await seedDemoAccount();
  console.log('Seed abgeschlossen.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
