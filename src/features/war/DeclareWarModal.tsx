import { useState, useMemo } from 'react';
import { useGameStore } from '../../game/store';
import { callDeclareWar } from './warClient';

interface DeclareWarModalProps {
  targetSlotId: string;
  onClose: () => void;
}

const MAX_REGIONS = 5;

export function DeclareWarModal({ targetSlotId, onClose }: DeclareWarModalProps) {
  const gameId = useGameStore(s => s.gameId);
  const slotId = useGameStore(s => s.slotId);
  const players = useGameStore(s => s.players);
  const regions = useGameStore(s => s.regions);

  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = players[targetSlotId];

  // Mulige omstridte regioner: target sine regioner som grenser til mine
  const candidateRegions = useMemo(() => {
    if (!target) return [];
    const myRegions = slotId ? Object.values(regions).filter(r => r.ownerId === slotId) : [];
    void myRegions; // adjacency-sjekk er server-side; her viser vi alle target-regioner
    return Object.entries(regions)
      .filter(([, r]) => r.ownerId === targetSlotId && r.contestedAt == null)
      .map(([id, r]) => ({ id, ...r }));
  }, [regions, slotId, targetSlotId, target]);

  function toggle(rid: string) {
    setSelected(s =>
      s.includes(rid)
        ? s.filter(id => id !== rid)
        : s.length < MAX_REGIONS ? [...s, rid] : s,
    );
  }

  async function handleSubmit() {
    if (!gameId || !slotId || selected.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await callDeclareWar({
        gameId,
        slotId,
        targetSlotId,
        contestedRegionIds: selected,
      });
      if (!res.ok) {
        setError(res.melding ?? 'Krigserklæring feilet.');
        setSubmitting(false);
        return;
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nettverksfeil.');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="war-modal-title"
    >
      <div className="w-full max-w-lg rounded-lg bg-panel border border-panelEdge p-4 shadow-xl">
        <h2 id="war-modal-title" className="text-lg font-semibold text-danger mb-3">
          ⚔️ Erklær krig mot {target?.displayName ?? targetSlotId}
        </h2>

        <p className="text-sm text-textLo mb-3">
          Velg opptil {MAX_REGIONS} regioner du vil prøve å erobre.
          Krig opprettes umiddelbart, og lærer varsles.
        </p>

        <div className="max-h-64 overflow-y-auto border border-panelEdge rounded mb-3">
          {candidateRegions.length === 0 ? (
            <p className="p-3 text-textLo text-xs italic">
              Motparten har ingen tilgjengelige regioner.
            </p>
          ) : (
            <ul>
              {candidateRegions.map(r => {
                const checked = selected.includes(r.id);
                return (
                  <li
                    key={r.id}
                    className={`px-2 py-1.5 border-b border-panelEdge text-xs flex items-center gap-2 cursor-pointer ${
                      checked ? 'bg-danger/20' : 'hover:bg-bg/30'
                    }`}
                    onClick={() => toggle(r.id)}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(r.id)}
                      className="shrink-0"
                    />
                    <span className="flex-1 truncate text-textHi font-mono">{r.id}</span>
                    <span className="text-textLo">{r.biome}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="text-xs text-textLo mb-3">
          Valgt: {selected.length}/{MAX_REGIONS}
        </p>

        {error && <p className="mb-2 text-xs text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1 rounded bg-bg border border-panelEdge text-textLo text-sm"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selected.length === 0 || submitting}
            className="px-3 py-1 rounded bg-danger text-white text-sm disabled:opacity-40"
          >
            {submitting ? 'Erklærer...' : 'Erklær krig'}
          </button>
        </div>
      </div>
    </div>
  );
}
