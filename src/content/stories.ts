import type { StoryContent } from '@/content/types';
import { generatedStories } from '@/content/generated';

// Kuratierte Demo-Geschichten für den MVP. Freundlich, altersgerecht (7–10 Jahre)
// und kulturell unbedenklich, siehe docs/EDUCATIONAL_MODEL.md. Jede Geschichte
// deckt genau die im Datenmodell geforderten Illustrationsebenen ab:
// background, main_character, object, secondary_character, final_scene.
//
// Zusätzlich zu den hier von Hand gepflegten Geschichten werden Inhalte aus
// dem Autoren-Workspace (content-drafts/, siehe docs/CONTENT_AUTHORING.md)
// automatisch unter src/content/generated/ erzeugt und unten angehängt —
// diese Datei muss dafür nicht angefasst werden.
const handAuthoredStories: StoryContent[] = [
  {
    slug: 'pieks-sucht-ein-zuhause',
    title: 'Pieks sucht ein Zuhause',
    description: 'Der kleine Igel Pieks braucht einen warmen Platz für den Winter.',
    ageRange: '7-8',
    difficultyLevel: 1,
    learningGoals: ['kurze_woerter', 'einfache_saetze', 'lesegenauigkeit'],
    sections: [
      {
        order: 0,
        text: 'Pieks ist ein kleiner Igel. Er lebt im Wald. Der Herbst kommt. Pieks braucht ein Zuhause für den Winter.',
      },
      {
        order: 1,
        text: 'Pieks sucht unter einem Baum. Dort liegen viele Blätter. Ist das ein gutes Zuhause? Pieks schaut sich um.',
      },
      {
        order: 2,
        text: 'Da kommt die Eule Frieda. Frieda kennt einen guten Platz. Sie zeigt Pieks eine Höhle unter den Wurzeln.',
      },
      {
        order: 3,
        text: 'Die Höhle ist warm und trocken. Pieks trägt Blätter in die Höhle. Jetzt hat Pieks ein Zuhause für den Winter.',
      },
    ],
    illustrationLayers: [
      {
        name: 'background',
        assetKey: '/illustrations/pieks-sucht-ein-zuhause/background.svg',
        renderOrder: 0,
        unlockAfterSectionOrder: 0,
      },
      {
        name: 'main_character',
        assetKey: '/illustrations/pieks-sucht-ein-zuhause/main_character.svg',
        renderOrder: 1,
        unlockAfterSectionOrder: 0,
      },
      {
        name: 'object',
        assetKey: '/illustrations/pieks-sucht-ein-zuhause/object.svg',
        renderOrder: 2,
        unlockAfterSectionOrder: 1,
      },
      {
        name: 'secondary_character',
        assetKey: '/illustrations/pieks-sucht-ein-zuhause/secondary_character.svg',
        renderOrder: 3,
        unlockAfterSectionOrder: 2,
      },
      {
        name: 'final_scene',
        assetKey: '/illustrations/pieks-sucht-ein-zuhause/final_scene.svg',
        renderOrder: 4,
        unlockAfterSectionOrder: 3,
      },
    ],
    comprehensionQuestions: [
      {
        order: 0,
        type: 'multiple_choice',
        prompt: 'Wer ist Pieks?',
        options: ['Ein Igel', 'Ein Hund', 'Ein Vogel'],
        correctAnswer: 'Ein Igel',
      },
      {
        order: 1,
        type: 'statement',
        prompt: 'Pieks findet die Höhle ganz allein, ohne Hilfe.',
        correctAnswer: false,
        hintText: 'Lies noch einmal den dritten Abschnitt — wer hilft Pieks?',
      },
      {
        order: 2,
        type: 'inference',
        prompt: 'Warum trägt Pieks Blätter in die Höhle?',
        options: ['Um es warm zu machen', 'Um zu spielen', 'Um die Höhle zu verstecken'],
        correctAnswer: 'Um es warm zu machen',
      },
    ],
  },
  {
    slug: 'mia-und-der-verlorene-schluessel',
    title: 'Mia und der verlorene Schlüssel',
    description:
      'Mia hat ihren Schlüssel verloren — und ihre Katze Minka weiß mehr, als man denkt.',
    ageRange: '7-8',
    difficultyLevel: 1,
    learningGoals: ['kurze_woerter', 'einfache_saetze', 'lesegenauigkeit'],
    sections: [
      {
        order: 0,
        text: 'Mia will die Haustür aufschließen. Der Schlüssel ist weg! Mia sucht in ihrer Tasche.',
      },
      {
        order: 1,
        text: 'Mias Katze Minka sitzt im Garten. Minka spielt mit etwas Glänzendem. Ist das der Schlüssel?',
      },
      {
        order: 2,
        text: 'Mia geht zu Minka in den Garten. Ja, das ist der Schlüssel! Minka hat damit gespielt.',
      },
      {
        order: 3,
        text: 'Mia nimmt den Schlüssel. Sie schließt die Tür auf. Minka darf mit ins Haus.',
      },
    ],
    illustrationLayers: [
      {
        name: 'background',
        assetKey: '/illustrations/mia-und-der-verlorene-schluessel/background.svg',
        renderOrder: 0,
        unlockAfterSectionOrder: 0,
      },
      {
        name: 'main_character',
        assetKey: '/illustrations/mia-und-der-verlorene-schluessel/main_character.svg',
        renderOrder: 1,
        unlockAfterSectionOrder: 0,
      },
      {
        name: 'object',
        assetKey: '/illustrations/mia-und-der-verlorene-schluessel/object.svg',
        renderOrder: 2,
        unlockAfterSectionOrder: 1,
      },
      {
        name: 'secondary_character',
        assetKey: '/illustrations/mia-und-der-verlorene-schluessel/secondary_character.svg',
        renderOrder: 3,
        unlockAfterSectionOrder: 2,
      },
      {
        name: 'final_scene',
        assetKey: '/illustrations/mia-und-der-verlorene-schluessel/final_scene.svg',
        renderOrder: 4,
        unlockAfterSectionOrder: 3,
      },
    ],
    comprehensionQuestions: [
      {
        order: 0,
        type: 'multiple_choice',
        prompt: 'Was hat Mia verloren?',
        options: ['Den Schlüssel', 'Einen Ball', 'Ein Buch'],
        correctAnswer: 'Den Schlüssel',
      },
      {
        order: 1,
        type: 'ordering',
        prompt: 'Bringe die Ereignisse in die richtige Reihenfolge.',
        options: [
          'Mia sucht den Schlüssel in ihrer Tasche',
          'Mia findet Minka im Garten',
          'Mia schließt die Tür auf',
        ],
        correctAnswer: [
          'Mia sucht den Schlüssel in ihrer Tasche',
          'Mia findet Minka im Garten',
          'Mia schließt die Tür auf',
        ],
      },
      {
        order: 2,
        type: 'statement',
        prompt: 'Minka ist ein Hund.',
        correctAnswer: false,
        hintText: 'Schau noch einmal in den zweiten Abschnitt.',
      },
    ],
  },
  {
    slug: 'ben-backt-einen-kuchen',
    title: 'Ben backt einen Kuchen',
    description: 'Ben verbringt einen Samstag bei Oma und backt zum ersten Mal einen Kuchen.',
    ageRange: '8-9',
    difficultyLevel: 2,
    learningGoals: ['kurze_texte', 'genaues_lesen', 'satzgrenzen'],
    sections: [
      {
        order: 0,
        text: 'Ben besucht seine Oma am Samstag. Oma fragt: „Willst du einen Kuchen backen?" Ben nickt und freut sich.',
      },
      {
        order: 1,
        text: 'Zuerst holen sie Mehl, Eier und Zucker. Oma zeigt Ben, wie man den Teig rührt. Der Teig wird glatt und gelb.',
      },
      {
        order: 2,
        text: 'Ben gießt den Teig in eine Form. Oma stellt die Form in den Ofen. Jetzt müssen sie warten.',
      },
      {
        order: 3,
        text: 'Es riecht nach Vanille in der Küche. Nach einer Weile klingelt der Ofen. Der Kuchen ist goldbraun.',
      },
      {
        order: 4,
        text: 'Ben und Oma lassen den Kuchen abkühlen. Dann schneiden sie ein Stück ab. Der Kuchen schmeckt wunderbar.',
      },
    ],
    illustrationLayers: [
      {
        name: 'background',
        assetKey: '/illustrations/ben-backt-einen-kuchen/background.svg',
        renderOrder: 0,
        unlockAfterSectionOrder: 0,
      },
      {
        name: 'main_character',
        assetKey: '/illustrations/ben-backt-einen-kuchen/main_character.svg',
        renderOrder: 1,
        unlockAfterSectionOrder: 0,
      },
      {
        name: 'secondary_character',
        assetKey: '/illustrations/ben-backt-einen-kuchen/secondary_character.svg',
        renderOrder: 2,
        unlockAfterSectionOrder: 1,
      },
      {
        name: 'object',
        assetKey: '/illustrations/ben-backt-einen-kuchen/object.svg',
        renderOrder: 3,
        unlockAfterSectionOrder: 2,
      },
      {
        name: 'final_scene',
        assetKey: '/illustrations/ben-backt-einen-kuchen/final_scene.svg',
        renderOrder: 4,
        unlockAfterSectionOrder: 4,
      },
    ],
    comprehensionQuestions: [
      {
        order: 0,
        type: 'multiple_choice',
        prompt: 'Mit wem backt Ben den Kuchen?',
        options: ['Mit Oma', 'Mit Opa', 'Mit Mama'],
        correctAnswer: 'Mit Oma',
      },
      {
        order: 1,
        type: 'inference',
        prompt: 'Warum müssen Ben und Oma warten?',
        options: ['Der Kuchen muss im Ofen backen', 'Sie sind müde', 'Der Ofen ist kaputt'],
        correctAnswer: 'Der Kuchen muss im Ofen backen',
      },
      {
        order: 2,
        type: 'statement',
        prompt: 'Der Kuchen schmeckt Ben nicht.',
        correctAnswer: false,
        hintText: 'Lies den letzten Satz noch einmal.',
      },
    ],
  },
  {
    slug: 'die-schatzkarte-im-garten',
    title: 'Die Schatzkarte im Garten',
    description: 'Emma und Jonas finden im Garten eine geheimnisvolle Schatzkarte.',
    ageRange: '8-9',
    difficultyLevel: 2,
    learningGoals: ['kurze_texte', 'genaues_lesen', 'satzgrenzen'],
    sections: [
      {
        order: 0,
        text: 'Emma und Jonas spielen im Garten. Unter einem Stein finden sie ein altes Papier. Es ist eine Schatzkarte!',
      },
      {
        order: 1,
        text: 'Auf der Karte sind komische Zeichen. Ein Kreuz markiert einen Platz beim großen Baum. Emma und Jonas laufen los.',
      },
      {
        order: 2,
        text: 'Beim Baum graben sie vorsichtig. Die Erde ist weich und dunkel. Plötzlich klopft die Schaufel gegen etwas Hartes.',
      },
      {
        order: 3,
        text: 'Es ist eine kleine Holzkiste! Emma öffnet den Deckel langsam. Darin liegen bunte Murmeln und ein Zettel.',
      },
      {
        order: 4,
        text: 'Auf dem Zettel steht: „Für die nächsten Entdecker!" Emma und Jonas lachen. Sie verstecken die Kiste wieder für andere Kinder.',
      },
    ],
    illustrationLayers: [
      {
        name: 'background',
        assetKey: '/illustrations/die-schatzkarte-im-garten/background.svg',
        renderOrder: 0,
        unlockAfterSectionOrder: 0,
      },
      {
        name: 'main_character',
        assetKey: '/illustrations/die-schatzkarte-im-garten/main_character.svg',
        renderOrder: 1,
        unlockAfterSectionOrder: 0,
      },
      {
        name: 'secondary_character',
        assetKey: '/illustrations/die-schatzkarte-im-garten/secondary_character.svg',
        renderOrder: 2,
        unlockAfterSectionOrder: 1,
      },
      {
        name: 'object',
        assetKey: '/illustrations/die-schatzkarte-im-garten/object.svg',
        renderOrder: 3,
        unlockAfterSectionOrder: 3,
      },
      {
        name: 'final_scene',
        assetKey: '/illustrations/die-schatzkarte-im-garten/final_scene.svg',
        renderOrder: 4,
        unlockAfterSectionOrder: 4,
      },
    ],
    comprehensionQuestions: [
      {
        order: 0,
        type: 'multiple_choice',
        prompt: 'Was finden Emma und Jonas unter dem Stein?',
        options: ['Eine Schatzkarte', 'Ein Buch', 'Einen Ball'],
        correctAnswer: 'Eine Schatzkarte',
      },
      {
        order: 1,
        type: 'ordering',
        prompt: 'Bringe die Ereignisse in die richtige Reihenfolge.',
        options: ['Sie finden die Karte', 'Sie graben beim Baum', 'Sie öffnen die Holzkiste'],
        correctAnswer: ['Sie finden die Karte', 'Sie graben beim Baum', 'Sie öffnen die Holzkiste'],
      },
      {
        order: 2,
        type: 'inference',
        prompt: 'Warum verstecken Emma und Jonas die Kiste wieder?',
        options: [
          'Damit andere Kinder sie auch finden können',
          'Weil sie die Murmeln nicht mögen',
          'Weil sie Angst haben',
        ],
        correctAnswer: 'Damit andere Kinder sie auch finden können',
      },
    ],
  },
  {
    slug: 'luna-reist-zu-den-sternen',
    title: 'Luna reist zu den Sternen',
    description: 'In einem Traum reist Luna mit einer Rakete bis zu den Sternen.',
    ageRange: '9-10',
    difficultyLevel: 3,
    learningGoals: ['fluessigeres_lesen', 'selbstkorrekturen', 'wortmuster'],
    sections: [
      {
        order: 0,
        text: 'Luna liegt abends in ihrem Bett und schaut aus dem Fenster. Am Himmel funkeln unzählige Sterne. Luna stellt sich vor, sie könnte fliegen.',
      },
      {
        order: 1,
        text: 'In ihrer Fantasie steigt Luna in eine kleine Rakete. Die Rakete ist silbern und hat runde Fenster. Luna zählt: drei, zwei, eins — Start!',
      },
      {
        order: 2,
        text: 'Luna fliegt vorbei an einem großen, gelben Mond. Der Mond lächelt ihr freundlich zu. Weiter geht die Reise zu den funkelnden Sternen.',
      },
      {
        order: 3,
        text: 'Zwischen den Sternen trifft Luna eine Sternschnuppe. Die Sternschnuppe erzählt von fernen Galaxien. Luna hört gespannt zu.',
      },
      {
        order: 4,
        text: 'Als die Sonne aufgeht, wacht Luna in ihrem Bett auf. Die Reise war nur ein Traum. Aber Luna lächelt, denn der Traum war wunderschön.',
      },
    ],
    illustrationLayers: [
      {
        name: 'background',
        assetKey: '/illustrations/luna-reist-zu-den-sternen/background.svg',
        renderOrder: 0,
        unlockAfterSectionOrder: 0,
      },
      {
        name: 'main_character',
        assetKey: '/illustrations/luna-reist-zu-den-sternen/main_character.svg',
        renderOrder: 1,
        unlockAfterSectionOrder: 0,
      },
      {
        name: 'object',
        assetKey: '/illustrations/luna-reist-zu-den-sternen/object.svg',
        renderOrder: 2,
        unlockAfterSectionOrder: 1,
      },
      {
        name: 'secondary_character',
        assetKey: '/illustrations/luna-reist-zu-den-sternen/secondary_character.svg',
        renderOrder: 3,
        unlockAfterSectionOrder: 3,
      },
      {
        name: 'final_scene',
        assetKey: '/illustrations/luna-reist-zu-den-sternen/final_scene.svg',
        renderOrder: 4,
        unlockAfterSectionOrder: 4,
      },
    ],
    comprehensionQuestions: [
      {
        order: 0,
        type: 'multiple_choice',
        prompt: 'Womit reist Luna in ihrer Fantasie?',
        options: ['Mit einer Rakete', 'Mit einem Boot', 'Mit einem Fahrrad'],
        correctAnswer: 'Mit einer Rakete',
      },
      {
        order: 1,
        type: 'statement',
        prompt: 'Luna trifft zwischen den Sternen eine Sternschnuppe.',
        correctAnswer: true,
      },
      {
        order: 2,
        type: 'inference',
        prompt: 'War Lunas Reise wirklich passiert?',
        options: ['Nein, es war ein Traum', 'Ja, sie war wirklich im Weltall', 'Das weiß niemand'],
        correctAnswer: 'Nein, es war ein Traum',
      },
    ],
  },
];

export const stories: StoryContent[] = [...handAuthoredStories, ...generatedStories];
