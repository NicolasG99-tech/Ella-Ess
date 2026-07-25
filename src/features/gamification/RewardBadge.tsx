export interface RewardBadgeData {
  code: string;
  type: 'star' | 'xp_badge' | 'avatar_item';
  name: string;
  description: string;
}

const TYPE_ICON: Record<RewardBadgeData['type'], string> = {
  star: '⭐',
  xp_badge: '🏅',
  avatar_item: '🎨',
};

// Rein darstellend, keine Zähler/Rangliste/Countdown — siehe
// docs/EDUCATIONAL_MODEL.md, Abschnitt "Gamification ohne Dark Patterns".
export function RewardBadge({ reward }: { reward: RewardBadgeData }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <span aria-hidden="true" className="text-2xl">
        {TYPE_ICON[reward.type]}
      </span>
      <div>
        <p className="font-semibold text-amber-950">{reward.name}</p>
        <p className="text-sm text-amber-800">{reward.description}</p>
      </div>
    </li>
  );
}
