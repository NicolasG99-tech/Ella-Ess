'use client';

import Image from 'next/image';

export interface UnlockedLayer {
  id: string;
  name: string;
  assetKey: string;
  renderOrder: number;
}

interface IllustrationStackProps {
  unlockedLayers: UnlockedLayer[];
  totalLayers: number;
  justUnlockedIds: Set<string>;
  reducedMotion: boolean;
}

// Zeigt die bisher freigeschalteten Illustrationsebenen einer Geschichte
// übereinander gestapelt (nach renderOrder). Neu freigeschaltete Ebenen
// erhalten eine weiche, optionale Einblend-Animation — respektiert sowohl die
// Kindprofil-Einstellung "reduzierte Animationen" als auch die
// System-Einstellung prefers-reduced-motion (siehe globals.css).
export function IllustrationStack({
  unlockedLayers,
  totalLayers,
  justUnlockedIds,
  reducedMotion,
}: IllustrationStackProps) {
  if (totalLayers === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-stone-200 bg-white">
        {unlockedLayers.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-stone-400">
            Das Bild entsteht, während du liest …
          </div>
        ) : (
          unlockedLayers.map((layer) => (
            <Image
              key={layer.id}
              src={layer.assetKey}
              alt=""
              fill
              className={
                !reducedMotion && justUnlockedIds.has(layer.id)
                  ? 'animate-illustration-unlock object-contain motion-reduce:animate-none'
                  : 'object-contain'
              }
              style={{ zIndex: layer.renderOrder }}
            />
          ))
        )}
      </div>
      <span className="text-xs text-stone-500">
        {unlockedLayers.length} von {totalLayers} Bildteilen freigeschaltet
      </span>
    </div>
  );
}
