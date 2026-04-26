import { useState, useMemo } from 'react';
import { Panel } from '../ui/Panel';
import { useGameStore } from '../game/store';
import { useMyPlayer } from '../game/selectors';
import { DeclareWarModal } from '../features/war/DeclareWarModal';
import { UnitDeployPanel } from '../features/war/UnitDeployPanel';
import {
  callProposeCeasefire,
  callAcceptCeasefire,
} from '../features/war/warClient';
import type { War, Unit } from '../types/war';

export function WarScreen() {
  const gameId = useGameStore(s => s.gameId);
  const slotId = useGameStore(s => s.slotId);
  const players = useGameStore(s => s.players);
  const wars = useGameStore(s => s.wars);
  const units = useGameStore(s => s.units);
  const player = useMyPlayer();

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mine kriger (jeg er part)
  const myWars = useMemo(() => {
    return Object.entries(wars)
      .filter(([, w]) => w.attacker === slotId || w.defender === slotId)
      .map(([id, w]) => ({ id, ...w }));
  }, [wars, slotId]);

  const activeWars = myWars.filter(w => w.status === 'active');

  // Andre spillere (for "erklær krig"-knapp)
  const otherPlayers = useMemo(() => {
    return Object.entries(players)
      .filter(([id]) => id !== slotId)
      .sort((a, b) => a[1].displayName.localeCompare(b[1].displayName));
  }, [players, slotId]);

  function unitsByOwnerInRegion(ownerId: string, regionId: string): Unit[] {
    return Object.values(units).filter(
      u => u.ownerId === ownerId && u.regionId === regionId,
    );
  }

  function totalStrength(arr: Unit[]): number {
    return arr.reduce((s, u) => s + u.strength, 0);
  }

  async function handleProposeCeasefire(warId: string) {
    if (!gameId || !slotId) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await callProposeCeasefire({ gameId, slotId, warId });
      if (!res.ok) setErrorMsg(res.melding ?? 'Forslag feilet.');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Nettverksfeil.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptCeasefire(warId: string) {
    if (!gameId || !slotId) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await callAcceptCeasefire({ gameId, slotId, warId });
      if (!res.ok) setErrorMsg(res.melding ?? 'Aksept feilet.');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Nettverksfeil.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col md:flex-row flex-1 overflow-hidden p-2 sm:p-3 gap-2 sm:gap-3">
      {/* Venstre: aktive konflikter */}
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        <Panel title="Aktive konflikter" className="flex-1 overflow-y-auto">
          {activeWars.length === 0 ? (
            <p className="text-textLo text-xs">Ingen aktive konflikter.</p>
          ) : (
            <div className="space-y-3">
              {activeWars.map(war => {
                const isAttacker = war.attacker === slotId;
                const opponent = isAttacker ? war.defender : war.attacker;
                const opponentName = players[opponent]?.displayName ?? opponent.slice(0, 6);
                const proposedByMe = war.ceasefireProposedBy === slotId;
                const proposedByOther = war.ceasefireProposedBy && war.ceasefireProposedBy !== slotId;

                return (
                  <div key={war.id} className="border border-danger/30 rounded p-3 bg-danger/5">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-textHi font-semibold text-sm">
                          {isAttacker ? '⚔️ Angriper' : '🛡️ Forsvarer'} mot {opponentName}
                        </div>
                        <div className="text-textLo text-xs">
                          Startet {new Date(war.startedAt).toLocaleTimeString('nb-NO')}
                          {' · '}
                          {war.contestedRegionIds.length} region{war.contestedRegionIds.length !== 1 ? 'er' : ''}{' '}
                          omstridt
                        </div>
                      </div>

                      {proposedByMe && (
                        <span className="text-xs text-warn italic">Du har foreslått våpenhvile</span>
                      )}
                      {proposedByOther && (
                        <button
                          type="button"
                          onClick={() => handleAcceptCeasefire(war.id)}
                          disabled={busy}
                          className="px-2 py-1 rounded bg-good text-white text-xs disabled:opacity-40"
                        >
                          Aksepter våpenhvile
                        </button>
                      )}
                      {!war.ceasefireProposedBy && (
                        <button
                          type="button"
                          onClick={() => handleProposeCeasefire(war.id)}
                          disabled={busy}
                          className="px-2 py-1 rounded bg-bg border border-panelEdge text-textLo text-xs disabled:opacity-40"
                        >
                          Foreslå våpenhvile
                        </button>
                      )}
                    </div>

                    {/* Region-by-region status */}
                    <div className="space-y-1.5 mt-2">
                      {war.contestedRegionIds.map(rid => {
                        const att = unitsByOwnerInRegion(war.attacker, rid);
                        const def = unitsByOwnerInRegion(war.defender, rid);
                        const aStr = totalStrength(att);
                        const dStr = totalStrength(def);
                        const total = aStr + dStr;
                        const attackerPct = total > 0 ? (aStr / total) * 100 : 50;
                        return (
                          <div
                            key={rid}
                            className="text-xs px-2 py-1.5 rounded bg-bg/50"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-textHi truncate">{rid}</span>
                              <div className="flex gap-3 text-[11px]">
                                <span className="text-warn">⚔️ {aStr} ({att.length}u)</span>
                                <span className="text-good">🛡️ {dStr} ({def.length}u)</span>
                              </div>
                            </div>
                            <div
                              className="mt-1 h-1.5 rounded overflow-hidden bg-bg/80 flex"
                              role="progressbar"
                              aria-label={`Styrkeforhold ${rid}: angriper ${Math.round(attackerPct)} prosent`}
                              aria-valuenow={Math.round(attackerPct)}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div
                                className="bg-warn h-full transition-all duration-300"
                                style={{ width: `${attackerPct}%` }}
                              />
                              <div
                                className="bg-good h-full transition-all duration-300"
                                style={{ width: `${100 - attackerPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Battle log — siste 5 */}
                    {war.battleLog && war.battleLog.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-textLo cursor-pointer">
                          Hendelses-log ({war.battleLog.length})
                        </summary>
                        <ul className="mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                          {war.battleLog.slice(-10).reverse().map((b, i) => (
                            <li key={i} className="text-[10px] font-mono text-textLo">
                              T{b.tick} {b.regionId.slice(0, 12)}: ⚔️-{b.attackerLoss} 🛡️-{b.defenderLoss}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {errorMsg && <p className="mt-2 text-xs text-danger">{errorMsg}</p>}
        </Panel>

        <Panel title="Erklær krig">
          <div className="space-y-2">
            {otherPlayers.length === 0 ? (
              <p className="text-textLo text-xs">Ingen andre spillere.</p>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {otherPlayers.map(([id, p]) => {
                  const alreadyAtWar = activeWars.some(
                    w => w.attacker === id || w.defender === id,
                  );
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={alreadyAtWar}
                      onClick={() => setSelectedTarget(id)}
                      className="px-2 py-1 rounded text-xs bg-bg/50 border border-panelEdge text-textHi flex items-center gap-2 disabled:opacity-40 hover:bg-danger/20"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: p.empireColor }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{p.displayName}</span>
                      {alreadyAtWar && <span className="text-danger">⚔️</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Høyre: enheter + deploy */}
      <aside className="md:w-72 shrink-0 flex flex-col gap-3 overflow-y-auto">
        <Panel title="Militær">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-textLo">Pool (rekrutter)</span>
              <span className="font-mono text-textHi">⚔️ {player?.military ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-textLo">Egne enheter</span>
              <span className="font-mono text-textHi">
                {Object.values(units).filter(u => u.ownerId === slotId).length}
              </span>
            </div>
          </div>
        </Panel>

        <Panel title="Deployer enheter">
          <UnitDeployPanel />
        </Panel>

        <Panel title="Mine enheter på kart">
          {(() => {
            const mine = Object.entries(units).filter(([, u]) => u.ownerId === slotId);
            if (mine.length === 0) {
              return <p className="text-textLo text-xs">Ingen utplasserte enheter.</p>;
            }
            const byRegion: Record<string, Unit[]> = {};
            for (const [, u] of mine) {
              (byRegion[u.regionId] = byRegion[u.regionId] ?? []).push(u);
            }
            return (
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {Object.entries(byRegion).map(([rid, us]) => (
                  <li
                    key={rid}
                    className="flex items-center justify-between text-xs px-2 py-1 rounded bg-bg/50"
                  >
                    <span className="font-mono text-textHi truncate">{rid}</span>
                    <span className="text-textLo">
                      {us.length}u · {us.reduce((s, u) => s + u.strength, 0)} styrke
                    </span>
                  </li>
                ))}
              </ul>
            );
          })()}
        </Panel>
      </aside>

      {selectedTarget && (
        <DeclareWarModal targetSlotId={selectedTarget} onClose={() => setSelectedTarget(null)} />
      )}
    </div>
  );
}

// Marker War-typen som brukt for å unngå unused-warning
void {} as War | undefined;
