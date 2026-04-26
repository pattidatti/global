import { useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '../../firebase/config';
import type { BuildQueueItem as BuildQueueItemType } from '../../types/region';

const BUILDING_LABELS: Record<string, { icon: string; name: string }> = {
  farm:       { icon: '🌾', name: 'Gård' },
  mine:       { icon: '⛏️', name: 'Gruve' },
  oilrig:     { icon: '🛢️', name: 'Oljerigg' },
  harbor:     { icon: '⚓', name: 'Havn' },
  barracks:   { icon: '⚔️', name: 'Kaserne' },
  cityExpand: { icon: '🏙️', name: 'Byvekst' },
};

interface BuildQueueItemProps {
  item: BuildQueueItemType;
  regionId: string;
  gameId: string;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Ferdig…';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function BuildQueueItem({ item, regionId, gameId }: BuildQueueItemProps) {
  const [remaining, setRemaining] = useState(item.completesAt - Date.now());
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(item.completesAt - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [item.completesAt]);

  async function handleCancel() {
    if (cancelling) return;
    setCancelling(true);
    try {
      const fns = getFunctions(firebaseApp, 'europe-west1');
      const cancelBuild = httpsCallable(fns, 'cancelBuild');
      await cancelBuild({ gameId, regionId, buildingId: item.buildingId });
    } catch (err) {
      console.error('Avbryt bygg feilet:', err);
      setCancelling(false);
    }
  }

  const meta = BUILDING_LABELS[item.type] ?? { icon: '🏗️', name: item.type };

  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      <span aria-hidden="true">{meta.icon}</span>
      <span className="flex-1 text-textHi">{meta.name}</span>
      <span className="font-mono text-textLo">{formatCountdown(remaining)}</span>
      <button
        onClick={handleCancel}
        disabled={cancelling}
        aria-label={`Avbryt bygging av ${meta.name}`}
        className="text-danger hover:text-red-400 disabled:text-textLo"
      >
        ✕
      </button>
    </div>
  );
}
