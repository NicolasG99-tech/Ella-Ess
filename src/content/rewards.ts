import type { RewardContent } from '@/content/types';

// Kuratierter Belohnungskatalog (Meilenstein 7). Bewusst schmal gehalten und
// ausschließlich an echten Lernfortschritt gekoppelt — siehe
// docs/EDUCATIONAL_MODEL.md, Abschnitt "Gamification ohne Dark Patterns":
// keine Bestenlisten, kein Vergleich zwischen Kindern, kein Verfallsmechanismus
// (Sterne/Abzeichen gehen nie verloren), keine künstliche Dringlichkeit.
//
// `star` wird wiederholt vergeben (kleine Anerkennung pro Abschluss), `xp_badge`
// genau einmal pro Kind (Meilenstein-Abzeichen). `avatar_item` ist im
// Prisma-Schema vorbereitet, aber im MVP noch nicht aktiv genutzt (analog zur
// Rolle `specialist`, siehe docs/ARCHITECTURE.md).
export const rewards: RewardContent[] = [
  {
    code: 'star_reading_session',
    type: 'star',
    name: 'Lesestern',
    description: 'Für das Zuendelesen einer Geschichte.',
    xpValue: 10,
  },
  {
    code: 'star_exercise',
    type: 'star',
    name: 'Übungsstern',
    description: 'Für das Abschließen einer Übungsaufgabe.',
    xpValue: 5,
  },
  {
    code: 'badge_first_story',
    type: 'xp_badge',
    name: 'Erste Geschichte',
    description: 'Du hast deine erste Geschichte zu Ende gelesen!',
    xpValue: 20,
  },
  {
    code: 'badge_five_stories',
    type: 'xp_badge',
    name: 'Bücherwurm',
    description: 'Du hast schon 5 Geschichten zu Ende gelesen!',
    xpValue: 50,
  },
  {
    code: 'badge_first_exercise',
    type: 'xp_badge',
    name: 'Erste Übung',
    description: 'Du hast deine erste Übung geschafft!',
    xpValue: 20,
  },
  {
    code: 'badge_ten_exercises',
    type: 'xp_badge',
    name: 'Übungsprofi',
    description: 'Du hast schon 10 Übungen geschafft!',
    xpValue: 50,
  },
  {
    code: 'badge_regular_practice',
    type: 'xp_badge',
    name: 'Regelmäßig dabei',
    description: 'Du hast an 3 verschiedenen Tagen geübt!',
    xpValue: 30,
  },
];
