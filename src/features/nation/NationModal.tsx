import { useState } from 'react';
import { createPortal } from 'react-dom';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { firebaseApp } from '../../firebase/config';
import { useGameStore } from '../../game/store';
import {
  useNationFormability,
  MIN_REGIONS_FOR_NATION,
  MIN_CULTURE_MATCH,
} from './useNationFormability';

const FUNCTIONS_REGION = 'europe-west1';
const NATION_COLORS = [
  'hsl(0, 70%, 50%)',
  'hsl(30, 80%, 50%)',
  'hsl(50, 80%, 45%)',
  'hsl(120, 50%, 40%)',
  'hsl(180, 60%, 40%)',
  'hsl(210, 60%, 50%)',
  'hsl(260, 50%, 50%)',
  'hsl(320, 55%, 50%)',
];

interface FormNationResult {
  ok: boolean;
  error?: string;
  melding?: string;
  data?: { nationId: string };
}

interface NationModalProps {
  adjacency: Record<string, string[]>;
  onClose: () => void;
}

export function NationModal({ adjacency, onClose }: NationModalProps) {
  const gameId = useGameStore(s => s.gameId);
  const formability = useNationFormability(adjacency);

  const [name, setName] = useState('');
  const [flag, setFlag] = useState('🏳️');
  const [type, setType] = useState<'historical' | 'custom'>('custom');
  const [color, setColor] = useState(NATION_COLORS[5]);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const canSubmit =
    formability.canForm &&
    name.trim().length >= 2 &&
    flag.trim().length >= 1 &&
    !submitting;

  async function handleSubmit() {
    if (!gameId || !canSubmit) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const fns = getFunctions(firebaseApp, FUNCTIONS_REGION);
      const formNation = httpsCallable<
        {
          gameId: string;
          slotId: string;
          name: string;
          flag: string;
          type: 'historical' | 'custom';
          color: string;
        },
        FormNationResult
      >(fns, 'formNation');
      // slotId hentes serverside fra req.auth.uid; vi sender den med for kompatibilitet
      const slotId = useGameStore.getState().slotId ?? '';
      const result = await formNation({
        gameId,
        slotId,
        name: name.trim(),
        flag: flag.trim(),
        type,
        color,
      });
      const payload = result.data;
      if (!payload?.ok) {
        setServerError(payload?.melding ?? 'Ukjent feil.');
        setSubmitting(false);
        return;
      }
      onClose();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Nettverksfeil.');
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nation-modal-title"
    >
      <div className="w-full max-w-md rounded-lg bg-panel border border-panelEdge p-4 shadow-xl">
        <h2 id="nation-modal-title" className="text-lg font-semibold text-textHi mb-3">
          Dann nasjon
        </h2>

        {/* Krav-sjekk */}
        <div className="mb-4 p-3 rounded bg-bg/50 border border-panelEdge">
          <h3 className="text-xs font-semibold text-textLo mb-2 uppercase tracking-wide">Krav</h3>
          <ul className="space-y-1 text-xs">
            <li className={formability.regionCount >= MIN_REGIONS_FOR_NATION ? 'text-good' : 'text-warn'}>
              {formability.regionCount >= MIN_REGIONS_FOR_NATION ? '✓' : '✗'}{' '}
              Minst {MIN_REGIONS_FOR_NATION} regioner — du har {formability.regionCount}
            </li>
            <li className={formability.isContiguous ? 'text-good' : 'text-warn'}>
              {formability.isContiguous ? '✓' : '✗'} Sammenhengende territorium
            </li>
            <li className={formability.matchPct >= MIN_CULTURE_MATCH ? 'text-good' : 'text-warn'}>
              {formability.matchPct >= MIN_CULTURE_MATCH ? '✓' : '✗'}{' '}
              Kulturmatch {Math.round(formability.matchPct * 100)} % (krever {Math.round(MIN_CULTURE_MATCH * 100)} %)
            </li>
            {formability.matchPct > 0 && (
              <li className="text-textLo italic">Dominerende kultur: {formability.dominantCulture}</li>
            )}
          </ul>
          {formability.missing.length > 0 && (
            <div className="mt-2 pt-2 border-t border-panelEdge">
              {formability.missing.map((m, i) => (
                <p key={i} className="text-xs text-warn">{m}</p>
              ))}
            </div>
          )}
        </div>

        {/* Skjema */}
        <div className="space-y-3">
          <div>
            <label htmlFor="nation-name" className="block text-xs text-textLo mb-1">Navn</label>
            <input
              id="nation-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={40}
              placeholder="f.eks. Norge"
              className="w-full px-2 py-1 rounded bg-bg border border-panelEdge text-sm text-textHi"
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="nation-flag" className="block text-xs text-textLo mb-1">Flagg / emoji</label>
            <input
              id="nation-flag"
              type="text"
              value={flag}
              onChange={e => setFlag(e.target.value)}
              maxLength={4}
              className="w-20 px-2 py-1 rounded bg-bg border border-panelEdge text-lg text-center"
              disabled={submitting}
            />
          </div>

          <div>
            <span className="block text-xs text-textLo mb-1">Type</span>
            <div className="flex gap-2 text-xs">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="nation-type"
                  value="custom"
                  checked={type === 'custom'}
                  onChange={() => setType('custom')}
                  disabled={submitting}
                />
                Egendefinert
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="nation-type"
                  value="historical"
                  checked={type === 'historical'}
                  onChange={() => setType('historical')}
                  disabled={submitting}
                />
                Historisk
              </label>
            </div>
          </div>

          <div>
            <span className="block text-xs text-textLo mb-1">Farge</span>
            <div className="flex flex-wrap gap-1">
              {NATION_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 ${
                    color === c ? 'border-textHi' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Velg farge ${c}`}
                  disabled={submitting}
                />
              ))}
            </div>
          </div>
        </div>

        {serverError && (
          <p className="mt-3 text-xs text-danger">{serverError}</p>
        )}

        {/* Knapper */}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-bg border border-panelEdge text-textLo text-sm"
            disabled={submitting}
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-3 py-1 rounded bg-accent text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Danner...' : 'Dann nasjon'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
