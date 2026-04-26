import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '../../firebase/config';
import { useMyPlayer } from '../../game/selectors';
import { useGameStore } from '../../game/store';
import { EXPAND_MILITARY_COST } from '../../constants';

interface ExpandButtonProps {
  targetRegionId: string;
  gameId: string;
}

export function ExpandButton({ targetRegionId, gameId }: ExpandButtonProps) {
  const player = useMyPlayer();
  const { pendingExpansions, setPendingExpansion } = useGameStore();
  const isPending = pendingExpansions.has(targetRegionId);
  const canExpand = (player?.military ?? 0) >= EXPAND_MILITARY_COST;

  async function handleExpand() {
    if (!canExpand || isPending) return;
    setPendingExpansion(targetRegionId, true);
    try {
      const fns = getFunctions(firebaseApp, 'europe-west1');
      const expandRegion = httpsCallable<unknown, { ok: boolean; melding?: string }>(
        fns, 'expandRegion',
      );
      const result = await expandRegion({ gameId, targetRegionId });
      if (!result.data.ok) {
        console.warn('Ekspansjon feilet:', result.data.melding);
      }
    } catch (err) {
      console.error('Ekspansjon feilet:', err);
    } finally {
      setPendingExpansion(targetRegionId, false);
    }
  }

  if (!player) return null;

  return (
    <button
      onClick={() => { void handleExpand(); }}
      disabled={!canExpand || isPending}
      aria-label={`Ekspander til region ${targetRegionId} (koster ${EXPAND_MILITARY_COST} ⚔️)`}
      className={[
        'w-full py-2 rounded text-sm font-medium transition-colors',
        canExpand && !isPending
          ? 'bg-danger/20 hover:bg-danger/30 text-danger border border-danger/40'
          : 'bg-panelEdge/30 text-inkLo cursor-not-allowed',
      ].join(' ')}
    >
      {isPending
        ? 'Ekspanderer…'
        : `⚔️ Ekspander hit (−${EXPAND_MILITARY_COST} militær)`}
      {!canExpand && !isPending && (
        <div className="text-xs text-textLo mt-0.5">
          Trenger {EXPAND_MILITARY_COST} militær (har {player.military})
        </div>
      )}
    </button>
  );
}
