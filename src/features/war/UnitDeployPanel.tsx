import { useState, useMemo } from 'react';
import { useGameStore } from '../../game/store';
import { useMyPlayer } from '../../game/selectors';
import { callDeployUnits } from './warClient';
import type { UnitType } from '../../types/war';

const UNIT_COST = 25;
const UNIT_TYPES: { key: UnitType; label: string; icon: string }[] = [
  { key: 'infantry', label: 'Infanteri', icon: '🪖' },
  { key: 'armor',    label: 'Stridsvogn', icon: '🚜' },
  { key: 'navy',     label: 'Marine',    icon: '🚢' },
];

export function UnitDeployPanel() {
  const gameId = useGameStore(s => s.gameId);
  const slotId = useGameStore(s => s.slotId);
  const regions = useGameStore(s => s.regions);
  const player = useMyPlayer();

  const myRegions = useMemo(() => {
    return Object.entries(regions)
      .filter(([, r]) => r.ownerId === slotId)
      .map(([id, r]) => ({ id, ...r }));
  }, [regions, slotId]);

  const [selectedRegion, setSelectedRegion] = useState<string>(myRegions[0]?.id ?? '');
  const [unitType, setUnitType] = useState<UnitType>('infantry');
  const [count, setCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const totalCost = count * UNIT_COST;
  const canAfford = (player?.military ?? 0) >= totalCost;
  const canSubmit = !!gameId && !!slotId && !!selectedRegion && canAfford && !submitting && count > 0;

  async function handleSubmit() {
    if (!canSubmit || !gameId || !slotId) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await callDeployUnits({
        gameId,
        slotId,
        regionId: selectedRegion,
        unitType,
        count,
      });
      if (!res.ok) {
        setError(res.melding ?? 'Deployering feilet.');
      } else {
        setSuccess(`Deployerte ${count} ${unitType} til regionen.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nettverksfeil.');
    } finally {
      setSubmitting(false);
    }
  }

  if (myRegions.length === 0) {
    return <p className="text-textLo text-xs italic">Du har ingen regioner å deployere til.</p>;
  }

  return (
    <div className="space-y-2">
      <div>
        <label htmlFor="deploy-region" className="block text-xs text-textLo mb-1">Region</label>
        <select
          id="deploy-region"
          value={selectedRegion}
          onChange={e => setSelectedRegion(e.target.value)}
          className="w-full px-2 py-1 rounded bg-bg border border-panelEdge text-xs text-textHi"
        >
          {myRegions.map(r => (
            <option key={r.id} value={r.id}>{r.id}</option>
          ))}
        </select>
      </div>

      <div>
        <span className="block text-xs text-textLo mb-1">Type</span>
        <div className="grid grid-cols-3 gap-1">
          {UNIT_TYPES.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setUnitType(t.key)}
              className={`flex flex-col items-center py-1 rounded text-xs ${
                unitType === t.key
                  ? 'bg-accent text-white'
                  : 'bg-bg border border-panelEdge text-textLo'
              }`}
            >
              <span aria-hidden="true">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="deploy-count" className="block text-xs text-textLo mb-1">
          Antall (max 10) — kostnad: {totalCost} militær
        </label>
        <input
          id="deploy-count"
          type="number"
          min="1"
          max="10"
          value={count}
          onChange={e => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
          className="w-full px-2 py-1 rounded bg-bg border border-panelEdge text-xs text-textHi"
        />
      </div>

      {!canAfford && (
        <p className="text-xs text-warn">
          Ikke nok militær (har {player?.military ?? 0}).
        </p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      {success && <p className="text-xs text-good">{success}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full py-1.5 rounded bg-accent text-white text-sm disabled:opacity-40"
      >
        {submitting ? 'Deployerer...' : 'Deployer'}
      </button>
    </div>
  );
}
