import { useState } from 'react';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { firebaseApp } from '../../firebase/config';
import { useGameStore } from '../../game/store';
import { useMyPlayer, useTotalResources } from '../../game/selectors';
import type { ResourceType, TradeSide } from '../../types/trade';

const FUNCTIONS_REGION = 'europe-west1';

const TRADABLE: { key: ResourceType; icon: string; label: string }[] = [
  { key: 'food',  icon: '🌾', label: 'Mat' },
  { key: 'oil',   icon: '🛢️', label: 'Olje' },
  { key: 'metal', icon: '⛏️', label: 'Metall' },
  { key: 'trade', icon: '🤝', label: 'Handel' },
];

interface OrderModalProps {
  initialResource?: ResourceType;
  initialSide?: TradeSide;
  onClose: () => void;
}

interface ProposeResult {
  ok: boolean;
  error?: string;
  melding?: string;
  data?: { orderId: string };
}

export function OrderModal({ initialResource = 'oil', initialSide = 'sell', onClose }: OrderModalProps) {
  const gameId = useGameStore(s => s.gameId);
  const player = useMyPlayer();
  const totals = useTotalResources();

  const [resource, setResource] = useState<ResourceType>(initialResource);
  const [side, setSide] = useState<TradeSide>(initialSide);
  const [quantity, setQuantity] = useState(10);
  const [pricePerUnit, setPricePerUnit] = useState(20);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const have = side === 'sell' ? Math.floor(totals[resource] ?? 0) : (player?.treasury ?? 0);
  const cost = side === 'buy' ? quantity * pricePerUnit : quantity;
  const overspend = cost > have;

  const canSubmit =
    !!gameId &&
    !!player &&
    quantity > 0 &&
    pricePerUnit > 0 &&
    !overspend &&
    !submitting;

  async function handleSubmit() {
    if (!gameId || !canSubmit || !player) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const fns = getFunctions(firebaseApp, FUNCTIONS_REGION);
      const proposeTrade = httpsCallable<
        {
          gameId: string;
          slotId: string;
          resource: ResourceType;
          side: TradeSide;
          quantity: number;
          pricePerUnit: number;
        },
        ProposeResult
      >(fns, 'proposeTrade');
      const slotId = useGameStore.getState().slotId ?? '';
      const result = await proposeTrade({
        gameId,
        slotId,
        resource,
        side,
        quantity,
        pricePerUnit,
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
    >
      <div className="w-full max-w-md rounded-lg bg-panel border border-panelEdge p-4 shadow-xl">
        <h2 id="order-modal-title" className="text-lg font-semibold text-textHi mb-3">
          {side === 'buy' ? 'Kjøp ressurs' : 'Selg ressurs'}
        </h2>

        <div className="space-y-3">
          {/* Side */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSide('buy')}
              className={`flex-1 py-1 rounded text-sm font-semibold ${
                side === 'buy' ? 'bg-good text-white' : 'bg-bg border border-panelEdge text-textLo'
              }`}
              disabled={submitting}
            >
              Kjøp
            </button>
            <button
              type="button"
              onClick={() => setSide('sell')}
              className={`flex-1 py-1 rounded text-sm font-semibold ${
                side === 'sell' ? 'bg-warn text-white' : 'bg-bg border border-panelEdge text-textLo'
              }`}
              disabled={submitting}
            >
              Selg
            </button>
          </div>

          {/* Ressurs */}
          <div>
            <span className="block text-xs text-textLo mb-1">Ressurs</span>
            <div className="grid grid-cols-4 gap-1">
              {TRADABLE.map(({ key, icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setResource(key)}
                  className={`flex flex-col items-center py-1 rounded text-xs ${
                    resource === key
                      ? 'bg-accent text-white'
                      : 'bg-bg border border-panelEdge text-textLo'
                  }`}
                  disabled={submitting}
                >
                  <span className="text-base" aria-hidden="true">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Mengde */}
          <div>
            <label htmlFor="ord-qty" className="block text-xs text-textLo mb-1">
              Mengde {side === 'sell' && <span className="text-textLo">(har {Math.floor(totals[resource] ?? 0)})</span>}
            </label>
            <input
              id="ord-qty"
              type="number"
              min="1"
              value={quantity}
              onChange={e => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 0)))}
              className="w-full px-2 py-1 rounded bg-bg border border-panelEdge text-sm text-textHi"
              disabled={submitting}
            />
          </div>

          {/* Pris */}
          <div>
            <label htmlFor="ord-price" className="block text-xs text-textLo mb-1">
              Pris per enhet
            </label>
            <input
              id="ord-price"
              type="number"
              min="0.01"
              step="0.01"
              value={pricePerUnit}
              onChange={e => setPricePerUnit(Math.max(0.01, Number(e.target.value) || 0))}
              className="w-full px-2 py-1 rounded bg-bg border border-panelEdge text-sm text-textHi"
              disabled={submitting}
            />
          </div>

          {/* Sammendrag */}
          <div className="p-2 rounded bg-bg/50 border border-panelEdge text-xs">
            <div className="flex justify-between text-textLo">
              <span>{side === 'buy' ? 'Total kostnad' : 'Total mengde'}</span>
              <span className={overspend ? 'text-danger font-mono' : 'text-textHi font-mono'}>
                {side === 'buy' ? `💰 ${cost.toFixed(2)}` : `${cost} ${resource}`}
              </span>
            </div>
            <div className="flex justify-between text-textLo">
              <span>Du har</span>
              <span className="font-mono">
                {side === 'buy' ? `💰 ${have}` : `${have} ${resource}`}
              </span>
            </div>
          </div>

          {overspend && (
            <p className="text-xs text-warn">
              {side === 'buy' ? 'Ikke nok penger.' : 'Ikke nok ressurs.'}
            </p>
          )}
        </div>

        {serverError && (
          <p className="mt-3 text-xs text-danger">{serverError}</p>
        )}

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
            {submitting ? 'Sender...' : 'Legg inn ordre'}
          </button>
        </div>
      </div>
    </div>
  );
}
