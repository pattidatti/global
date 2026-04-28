import { lazy, Suspense, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Panel } from '../ui/Panel';
import { useGameStore } from '../game/store';
import { ChatPanel } from '../features/chat/ChatPanel';
import { privateChannelId } from '../features/chat/useChatMessages';
import {
  callProposeAlliance,
  callAcceptAlliance,
  callBreakAlliance,
  pairKey,
} from '../features/diplomacy/diplomacyClient';
import { DiplomaticNoteList } from '../features/diplomacy/DiplomaticNoteList';
import { LeaguePanel } from '../features/league/LeaguePanel';
import type { Diplomacy, DiplomacyStatus } from '../types/diplomacy';

const DiplomacyForceGraph = lazy(() =>
  import('../features/diplomacy/DiplomacyForceGraph').then(m => ({ default: m.DiplomacyForceGraph })),
);

const STATUS_LABEL: Record<DiplomacyStatus, string> = {
  neutral:            'nøytral',
  'pending-alliance': 'forslag pågår',
  alliance:           'alliert',
  war:                'krig',
  trade:              'handel',
};

const STATUS_BADGE: Record<DiplomacyStatus, string> = {
  neutral:            'bg-bg/50 text-textLo',
  'pending-alliance': 'bg-warn/20 text-warn',
  alliance:           'bg-good/30 text-good',
  war:                'bg-danger/30 text-danger',
  trade:              'bg-accent/20 text-accent',
};

function getStatus(d: Diplomacy | undefined): DiplomacyStatus {
  return d?.status ?? 'neutral';
}

export function DiplomacyScreen() {
  const players = useGameStore(s => s.players);
  const slotId = useGameStore(s => s.slotId);
  const gameId = useGameStore(s => s.gameId);
  const diplomacy = useGameStore(s => s.diplomacy);
  const setUnreadChat = useGameStore(s => s.setUnreadChat);

  useEffect(() => { setUnreadChat(false); }, [setUnreadChat]);

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [chatTab, setChatTab] = useState<'global' | 'private'>('global');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const others = Object.entries(players)
    .filter(([id]) => id !== slotId)
    .sort((a, b) => a[1].displayName.localeCompare(b[1].displayName));

  const selected = selectedSlotId ? players[selectedSlotId] : null;
  const selectedKey = slotId && selectedSlotId ? pairKey(slotId, selectedSlotId) : '';
  const selectedDipl = selectedKey ? diplomacy[selectedKey] : undefined;
  const selectedStatus = getStatus(selectedDipl);

  async function runAction(
    fn: () => Promise<{ ok: boolean; melding?: string }>,
  ): Promise<void> {
    if (busy) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fn();
      if (!res.ok) setErrorMsg(res.melding ?? 'Handling feilet.');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Nettverksfeil.');
    } finally {
      setBusy(false);
    }
  }

  function actionsForStatus(): JSX.Element | null {
    if (!gameId || !slotId || !selectedSlotId) return null;
    const args = { gameId, slotId, targetSlotId: selectedSlotId };

    switch (selectedStatus) {
      case 'neutral':
        return (
          <button
            type="button"
            disabled={busy}
            onClick={() => runAction(() => callProposeAlliance(args))}
            className="w-full py-1.5 rounded bg-good text-white text-sm disabled:opacity-40"
          >
            Foreslå allianse
          </button>
        );
      case 'pending-alliance': {
        const proposedByMe = selectedDipl?.proposerId === slotId;
        if (proposedByMe) {
          return (
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction(() => callBreakAlliance(args))}
              className="w-full py-1.5 rounded bg-bg border border-panelEdge text-textLo text-sm"
            >
              Trekk tilbake forslag
            </button>
          );
        }
        return (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction(() => callAcceptAlliance(args))}
              className="py-1.5 rounded bg-good text-white text-sm disabled:opacity-40"
            >
              Aksepter
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction(() => callBreakAlliance(args))}
              className="py-1.5 rounded bg-bg border border-panelEdge text-textLo text-sm"
            >
              Avvis
            </button>
          </div>
        );
      }
      case 'alliance':
        return (
          <button
            type="button"
            disabled={busy}
            onClick={() => runAction(() => callBreakAlliance(args))}
            className="w-full py-1.5 rounded bg-warn text-white text-sm disabled:opacity-40"
          >
            Bryt allianse
          </button>
        );
      case 'war':
        return (
          <p className="text-xs text-danger">
            Krig pågår. Våpenhvile håndteres på Krig-skjermen (Fase 2b).
          </p>
        );
      case 'trade':
        return null;
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col md:flex-row flex-1 overflow-hidden p-2 sm:p-3 gap-2 sm:gap-3">
      {/* Venstre: diplomatliste */}
      <aside className="md:w-56 shrink-0 flex flex-col gap-3 max-h-40 md:max-h-none">
        <Panel title="Andre spillere" className="flex-1 overflow-y-auto">
          {others.length === 0 ? (
            <p className="text-textLo text-xs">Ingen andre spillere ennå.</p>
          ) : (
            <ul className="space-y-1">
              {others.map(([id, p]) => {
                const key = slotId ? pairKey(slotId, id) : '';
                const status = getStatus(key ? diplomacy[key] : undefined);
                const isSelected = id === selectedSlotId;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setSelectedSlotId(id)}
                      className={`w-full text-left px-2 py-1 rounded text-xs flex items-center gap-2 ${
                        isSelected ? 'bg-accent/20 border border-accent' : 'bg-bg/50 hover:bg-bg/70'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.empireColor }}
                        aria-hidden="true"
                      />
                      <span className="flex-1 truncate text-textHi">{p.displayName}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${STATUS_BADGE[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </aside>

      {/* Midten: graf + chat */}
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        <Panel title="Diplomati-graf" className="flex-1 min-h-[260px]">
          <Suspense
            fallback={<p className="text-textLo text-xs italic">Laster grafvisning…</p>}
          >
            <DiplomacyForceGraph
              selectedSlotId={selectedSlotId}
              onSelectNode={setSelectedSlotId}
            />
          </Suspense>
        </Panel>

        <Panel title="Chat" className="flex-1 min-h-[200px] flex flex-col">
          <div className="flex gap-1 mb-2">
            <button
              type="button"
              onClick={() => setChatTab('global')}
              className={`px-3 py-1 text-xs rounded ${
                chatTab === 'global' ? 'bg-accent text-white' : 'bg-bg/50 text-textLo'
              }`}
            >
              Globalt
            </button>
            <button
              type="button"
              onClick={() => setChatTab('private')}
              disabled={!selectedSlotId}
              className={`px-3 py-1 text-xs rounded disabled:opacity-40 ${
                chatTab === 'private' ? 'bg-accent text-white' : 'bg-bg/50 text-textLo'
              }`}
            >
              Privat {selected && `(${selected.displayName})`}
            </button>
          </div>
          <div className="flex-1 overflow-hidden border border-panelEdge rounded">
            {chatTab === 'global' ? (
              <ChatPanel channelId="global" showAuthor />
            ) : selectedSlotId && slotId ? (
              <ChatPanel
                channelId={privateChannelId(slotId, selectedSlotId)}
                showAuthor={false}
                title={`Privat med ${selected?.displayName}`}
              />
            ) : (
              <p className="text-textLo text-xs p-2 italic">
                Velg en spiller fra lista for å starte privat chat.
              </p>
            )}
          </div>
        </Panel>
      </div>

      {/* Høyre: valgt-spiller-panel */}
      <aside className="md:w-72 shrink-0 flex flex-col gap-3 overflow-y-auto">
        <Panel title="Detaljer">
          {selected && selectedSlotId ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: selected.empireColor }}
                  aria-hidden="true"
                />
                <span className="font-semibold text-textHi truncate">{selected.displayName}</span>
              </div>
              <div className="text-textLo text-xs">
                {selected.regionIds.length} region{selected.regionIds.length !== 1 ? 'er' : ''} ·{' '}
                💰 {selected.treasury} · ⚔️ {selected.military} · 🌟 {selected.influence}
              </div>
              <div className="pt-2 border-t border-panelEdge">
                <div className="text-xs text-textLo mb-1">Status</div>
                <span className={`inline-block px-2 py-0.5 rounded text-xs ${STATUS_BADGE[selectedStatus]}`}>
                  {STATUS_LABEL[selectedStatus]}
                </span>
              </div>
              <div className="pt-2">{actionsForStatus()}</div>
              {errorMsg && <p className="text-xs text-danger">{errorMsg}</p>}
            </div>
          ) : (
            <p className="text-textLo text-xs">Velg en spiller fra lista.</p>
          )}
        </Panel>

        {selectedSlotId && (
          <Panel title="Noter">
            <DiplomaticNoteList targetSlotId={selectedSlotId} />
          </Panel>
        )}

        <Panel title="Forbund">
          <LeaguePanel />
        </Panel>
      </aside>
    </div>
  );
}
