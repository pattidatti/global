import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '../../firebase/config';
import { useMyPlayer } from '../../game/selectors';

const INVEST_COST = 50;
const DIPLO_COST = 200;

interface NpcInfluencePanelProps {
  targetRegionId: string;
  gameId: string;
}

type CallableResult = { ok: boolean; melding?: string };

export function NpcInfluencePanel({ targetRegionId, gameId }: NpcInfluencePanelProps) {
  const player = useMyPlayer();
  const [pending, setPending] = useState<'invest' | 'diplo' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!player) return null;

  const canInvest = (player.treasury ?? 0) >= INVEST_COST;
  const canDiplo = (player.influence ?? 0) >= DIPLO_COST;

  async function call(action: 'invest' | 'diplo') {
    if (pending) return;
    setPending(action);
    setError(null);
    try {
      const fns = getFunctions(firebaseApp, 'europe-west1');
      const name = action === 'invest' ? 'investInRegion' : 'attemptDiplomaticTakeover';
      const fn = httpsCallable<unknown, CallableResult>(fns, name);
      const result = await fn({ gameId, targetRegionId });
      if (!result.data.ok) {
        setError(result.data.melding ?? 'Handlingen feilet.');
      }
    } catch (err) {
      console.error(`${action} feilet:`, err);
      setError('Handlingen feilet.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-2 px-1">
      <button
        onClick={() => { void call('invest'); }}
        disabled={!canInvest || pending !== null}
        aria-label={`Invester ${INVEST_COST} 💰 i ${targetRegionId}`}
        className={[
          'w-full py-2 rounded text-sm font-medium transition-colors',
          canInvest && pending === null
            ? 'bg-good/20 hover:bg-good/30 text-good border border-good/40'
            : 'bg-panelEdge/30 text-inkLo cursor-not-allowed',
        ].join(' ')}
      >
        {pending === 'invest'
          ? 'Investerer…'
          : `💰 Invester (−${INVEST_COST} kr)`}
        {!canInvest && pending !== 'invest' && (
          <div className="text-xs text-textLo mt-0.5">
            Trenger {INVEST_COST} kr (har {Math.floor(player.treasury ?? 0)})
          </div>
        )}
      </button>

      <button
        onClick={() => { void call('diplo'); }}
        disabled={!canDiplo || pending !== null}
        aria-label={`Diplomatisk overtakelse (koster ${DIPLO_COST} influence)`}
        className={[
          'w-full py-2 rounded text-sm font-medium transition-colors',
          canDiplo && pending === null
            ? 'bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40'
            : 'bg-panelEdge/30 text-inkLo cursor-not-allowed',
        ].join(' ')}
      >
        {pending === 'diplo'
          ? 'Forhandler…'
          : `🤝 Diplomatisk overtakelse (−${DIPLO_COST} 🌟)`}
        {!canDiplo && pending !== 'diplo' && (
          <div className="text-xs text-textLo mt-0.5">
            Trenger {DIPLO_COST} 🌟 (har {Math.floor(player.influence ?? 0)})
          </div>
        )}
      </button>

      {error && (
        <div role="alert" className="text-xs text-danger px-1">
          {error}
        </div>
      )}
    </div>
  );
}
