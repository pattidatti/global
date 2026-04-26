import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { firebaseApp } from '../firebase/config';
import { Panel } from '../ui/Panel';
import { useGameStore } from '../game/store';
import { useMyPlayer, useTotalResources } from '../game/selectors';
import { useMarketData } from '../features/trade/useMarketData';
import { OrderModal } from '../features/trade/OrderModal';
import type { ResourceType, TradeSide, TradeOrder } from '../types/trade';

const FUNCTIONS_REGION = 'europe-west1';

const RESOURCES: { key: ResourceType; icon: string; label: string }[] = [
  { key: 'food',  icon: '🌾', label: 'Mat' },
  { key: 'oil',   icon: '🛢️', label: 'Olje' },
  { key: 'metal', icon: '⛏️', label: 'Metall' },
  { key: 'trade', icon: '🤝', label: 'Handel' },
];

interface CallableEnvelope {
  ok: boolean;
  error?: string;
  melding?: string;
  data?: { filled?: number; price?: number };
}

export function MarketScreen() {
  const player = useMyPlayer();
  const totals = useTotalResources();
  const slotId = useGameStore(s => s.slotId);
  const gameId = useGameStore(s => s.gameId);

  const [selectedResource, setSelectedResource] = useState<ResourceType>('oil');
  const [showOrderModal, setShowOrderModal] = useState<{ side: TradeSide } | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { buys, sells, history } = useMarketData(selectedResource);

  // Sortér prishistorikk for graf
  const historyData = useMemo(() => {
    return Object.values(history)
      .sort((a, b) => a.ts - b.ts)
      .map(h => ({
        ts: h.ts,
        timeLabel: new Date(h.ts).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }),
        avgPrice: Number(h.avgPrice.toFixed(2)),
        volume: h.volume,
      }));
  }, [history]);

  // Pris-delta for valgt ressurs (nyeste vs forrige punkt)
  const priceDelta = useMemo(() => {
    if (historyData.length < 2) return null;
    const latest = historyData[historyData.length - 1].avgPrice;
    const prev = historyData[historyData.length - 2].avgPrice;
    if (prev === 0) return null;
    return ((latest - prev) / prev) * 100;
  }, [historyData]);

  // Beste pris per ressurs (for tabell)
  const tableRows = useMemo(() => {
    return RESOURCES.map(r => ({
      ...r,
      lager: Math.floor(totals[r.key] ?? 0),
    }));
  }, [totals]);

  // Aktive ordrer på valgt ressurs (sortert)
  const sortedSells = useMemo(() => {
    return Object.entries(sells)
      .map(([id, o]) => ({ id, ...o }))
      .filter(o => o.status === 'open')
      .sort((a, b) => a.pricePerUnit - b.pricePerUnit);
  }, [sells]);

  const sortedBuys = useMemo(() => {
    return Object.entries(buys)
      .map(([id, o]) => ({ id, ...o }))
      .filter(o => o.status === 'open')
      .sort((a, b) => b.pricePerUnit - a.pricePerUnit);
  }, [buys]);

  const myOrders = useMemo(() => {
    return [...sortedSells, ...sortedBuys].filter(o => o.ownerId === slotId);
  }, [sortedSells, sortedBuys, slotId]);

  async function handleAccept(order: TradeOrder & { id: string }) {
    if (!gameId) return;
    setBusyOrderId(order.id);
    setErrorMsg(null);
    try {
      const fns = getFunctions(firebaseApp, FUNCTIONS_REGION);
      const acceptTrade = httpsCallable<
        {
          gameId: string;
          slotId: string;
          resource: ResourceType;
          side: TradeSide;
          orderId: string;
          quantity: number;
        },
        CallableEnvelope
      >(fns, 'acceptTrade');
      const result = await acceptTrade({
        gameId,
        slotId: slotId ?? '',
        resource: selectedResource,
        side: order.side,
        orderId: order.id,
        quantity: order.quantity,
      });
      if (!result.data?.ok) {
        setErrorMsg(result.data?.melding ?? 'Aksept feilet.');
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Nettverksfeil.');
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handleCancel(order: TradeOrder & { id: string }) {
    if (!gameId) return;
    setBusyOrderId(order.id);
    setErrorMsg(null);
    try {
      const fns = getFunctions(firebaseApp, FUNCTIONS_REGION);
      const cancelTrade = httpsCallable<
        {
          gameId: string;
          slotId: string;
          resource: ResourceType;
          side: TradeSide;
          orderId: string;
        },
        CallableEnvelope
      >(fns, 'cancelTrade');
      const result = await cancelTrade({
        gameId,
        slotId: slotId ?? '',
        resource: selectedResource,
        side: order.side,
        orderId: order.id,
      });
      if (!result.data?.ok) {
        setErrorMsg(result.data?.melding ?? 'Avbryting feilet.');
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Nettverksfeil.');
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <div className="flex flex-col md:flex-row flex-1 overflow-hidden p-2 sm:p-3 gap-2 sm:gap-3">
      {/* Venstre: ressurstabell + handelsavtaler */}
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        <Panel title="Ressurser">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-textLo text-xs">
                <th className="text-left py-1">Ressurs</th>
                <th className="text-right py-1">Lager</th>
                <th className="text-right py-1">Beste kjøp</th>
                <th className="text-right py-1">Beste salg</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(row => {
                // Hent beste-priser per ressurs ved å lese current selectedResource-data
                // For tabell-MVP: vis kun for selectedResource. Andre rader viser "—".
                const isActive = row.key === selectedResource;
                const bestBuy = isActive && sortedBuys[0] ? sortedBuys[0].pricePerUnit : null;
                const bestSell = isActive && sortedSells[0] ? sortedSells[0].pricePerUnit : null;
                return (
                  <tr
                    key={row.key}
                    className={`border-t border-panelEdge ${isActive ? 'bg-bg/40 border-l-2 border-l-accent' : ''} cursor-pointer hover:bg-bg/20`}
                    onClick={() => setSelectedResource(row.key)}
                  >
                    <td className="py-1.5">
                      <span aria-hidden="true">{row.icon}</span> {row.label}
                    </td>
                    <td className="text-right font-mono text-textHi">{row.lager}</td>
                    <td className="text-right font-mono text-good">
                      {bestBuy !== null ? bestBuy.toFixed(2) : '—'}
                    </td>
                    <td className="text-right font-mono text-warn">
                      {bestSell !== null ? bestSell.toFixed(2) : '—'}
                    </td>
                    <td className="text-right text-xs">
                      {isActive && priceDelta !== null ? (
                        <span
                          className={priceDelta > 0 ? 'text-good' : priceDelta < 0 ? 'text-danger' : 'text-textLo'}
                          aria-label={`Prisendring ${priceDelta.toFixed(1)} prosent`}
                        >
                          {priceDelta > 0 ? '▲' : priceDelta < 0 ? '▼' : '–'} {Math.abs(priceDelta).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-textLo">{isActive ? '↑ valgt' : 'klikk'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel title={`Prisutvikling – ${RESOURCES.find(r => r.key === selectedResource)?.label}`} className="flex-1 min-h-[200px]">
          {historyData.length === 0 ? (
            <p className="text-textLo text-xs">
              Ingen handler enda. Prisgrafen oppdateres etter første matching.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={historyData}>
                <CartesianGrid stroke="#2a3b50" strokeDasharray="2 4" strokeWidth={1} vertical={false} />
                <XAxis dataKey="timeLabel" stroke="#8aa3bf" tick={{ fontSize: 10 }} />
                <YAxis stroke="#8aa3bf" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#15273a', border: '1px solid #2a3b50' }}
                  labelStyle={{ color: '#8aa3bf' }}
                />
                <Line type="monotone" dataKey="avgPrice" stroke="#3da9fc" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Handelsavtaler" className="flex-1 min-h-[200px] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {/* Kjøps-ordrer (folk vil kjøpe — selg til dem) */}
            <div>
              <h3 className="text-xs text-textLo uppercase tracking-wide mb-1">
                Kjøp ({sortedBuys.length})
              </h3>
              {sortedBuys.length === 0 ? (
                <p className="text-textLo text-xs">Ingen kjøpsordrer.</p>
              ) : (
                <ul className="space-y-1">
                  {sortedBuys.slice(0, 10).map(o => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between px-2 py-1 rounded bg-bg/50 text-xs"
                    >
                      <span className="font-mono text-good">@ {o.pricePerUnit.toFixed(2)}</span>
                      <span className="font-mono text-textHi">{o.quantity}</span>
                      {o.ownerId !== slotId && (
                        <button
                          type="button"
                          onClick={() => handleAccept(o)}
                          disabled={busyOrderId === o.id}
                          className="ml-2 px-2 py-0.5 rounded bg-warn text-white text-xs disabled:opacity-40"
                        >
                          Selg
                        </button>
                      )}
                      {o.ownerId === slotId && (
                        <span className="ml-2 text-textLo italic">din</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Salgs-ordrer (folk vil selge — kjøp fra dem) */}
            <div>
              <h3 className="text-xs text-textLo uppercase tracking-wide mb-1">
                Salg ({sortedSells.length})
              </h3>
              {sortedSells.length === 0 ? (
                <p className="text-textLo text-xs">Ingen salgsordrer.</p>
              ) : (
                <ul className="space-y-1">
                  {sortedSells.slice(0, 10).map(o => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between px-2 py-1 rounded bg-bg/50 text-xs"
                    >
                      <span className="font-mono text-warn">@ {o.pricePerUnit.toFixed(2)}</span>
                      <span className="font-mono text-textHi">{o.quantity}</span>
                      {o.ownerId !== slotId && (
                        <button
                          type="button"
                          onClick={() => handleAccept(o)}
                          disabled={busyOrderId === o.id}
                          className="ml-2 px-2 py-0.5 rounded bg-good text-white text-xs disabled:opacity-40"
                        >
                          Kjøp
                        </button>
                      )}
                      {o.ownerId === slotId && (
                        <span className="ml-2 text-textLo italic">din</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {errorMsg && <p className="mt-2 text-xs text-danger">{errorMsg}</p>}
        </Panel>
      </div>

      {/* Høyre: ØKONOMI-panel */}
      <aside className="md:w-72 shrink-0 flex flex-col gap-3 overflow-y-auto">
        <Panel title="Økonomi">
          {player ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-textLo">Treasury</span>
                <span className="font-mono text-textHi">💰 {player.treasury}</span>
              </div>
              <div className="border-t border-panelEdge pt-2">
                <h3 className="text-xs text-textLo uppercase tracking-wide mb-1">Lager</h3>
                {RESOURCES.map(r => (
                  <div key={r.key} className="flex justify-between text-xs">
                    <span className="text-textLo">{r.icon} {r.label}</span>
                    <span className="font-mono text-textHi">{Math.floor(totals[r.key] ?? 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-textLo text-xs">Ikke tilkoblet.</p>
          )}
        </Panel>

        <Panel title="Mine ordrer">
          {myOrders.length === 0 ? (
            <p className="text-textLo text-xs">Ingen åpne ordrer.</p>
          ) : (
            <ul className="space-y-1">
              {myOrders.map(o => (
                <li
                  key={`${o.side}-${o.id}`}
                  className="flex items-center justify-between px-2 py-1 rounded bg-bg/50 text-xs"
                >
                  <span className={o.side === 'buy' ? 'text-good' : 'text-warn'}>
                    {o.side === 'buy' ? 'Kjøp' : 'Selg'}
                  </span>
                  <span className="font-mono text-textHi">{o.quantity}@{o.pricePerUnit.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => handleCancel(o)}
                    disabled={busyOrderId === o.id}
                    className="ml-2 px-2 py-0.5 rounded bg-danger/70 text-white text-xs disabled:opacity-40"
                  >
                    Avbryt
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setShowOrderModal({ side: 'buy' })}
            className="py-2 rounded bg-good text-white text-sm font-semibold"
          >
            + Kjøpsordre
          </button>
          <button
            type="button"
            onClick={() => setShowOrderModal({ side: 'sell' })}
            className="py-2 rounded bg-warn text-white text-sm font-semibold"
          >
            + Salgsordre
          </button>
        </div>
      </aside>

      {showOrderModal && (
        <OrderModal
          initialResource={selectedResource}
          initialSide={showOrderModal.side}
          onClose={() => setShowOrderModal(null)}
        />
      )}
    </div>
  );
}
