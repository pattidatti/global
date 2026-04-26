import { useMemo } from 'react';
import { useGameStore } from '../game/store';
import { Panel } from '../ui/Panel';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'nå nettopp';
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} t siden`;
  return `${Math.floor(h / 24)} d siden`;
}

export function EventsScreen() {
  const { wars, players, nations, diplomacy, slotId } = useGameStore();

  const playerName = (id: string) => players[id]?.displayName ?? id;

  const activeWars = useMemo(
    () => Object.values(wars).filter(w => w.status === 'active'),
    [wars],
  );

  const recentEndedWars = useMemo(
    () =>
      Object.values(wars)
        .filter(w => w.status === 'ended' && w.endedAt != null)
        .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
        .slice(0, 5),
    [wars],
  );

  const alliances = useMemo(
    () =>
      Object.entries(diplomacy)
        .filter(([, d]) => d.status === 'alliance')
        .map(([key, d]) => {
          const [a, b] = key.split('_');
          return { a, b, since: d.since };
        }),
    [diplomacy],
  );

  const nationList = useMemo(
    () =>
      Object.values(nations).sort(
        (a, b) => (b.members?.length ?? 0) - (a.members?.length ?? 0),
      ),
    [nations],
  );

  const playerRanking = useMemo(
    () =>
      Object.entries(players)
        .map(([id, p]) => ({ id, name: p.displayName, regions: p.regionIds.length, military: p.military, treasury: p.treasury }))
        .sort((a, b) => b.regions - a.regions),
    [players],
  );

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-3 gap-3 max-w-2xl mx-auto w-full">

      {/* Aktive kriger */}
      <Panel title={`Aktive kriger (${activeWars.length})`}>
        {activeWars.length === 0 ? (
          <p className="text-textLo text-xs">Ingen pågående kriger.</p>
        ) : (
          <div className="space-y-2">
            {activeWars.map((w, i) => (
              <div key={i} className="text-xs border-l-2 border-danger pl-2 space-y-0.5">
                <div className="text-textHi font-medium">
                  ⚔️ {playerName(w.attacker)} <span className="text-danger">vs</span> {playerName(w.defender)}
                </div>
                <div className="text-textLo">
                  {w.contestedRegionIds.length} omstridt{w.contestedRegionIds.length !== 1 ? 'e' : ''} region{w.contestedRegionIds.length !== 1 ? 'er' : ''}
                  {' · '}startet {timeAgo(w.startedAt)}
                </div>
                {w.ceasefireProposedBy && (
                  <div className="text-warn">
                    🕊️ {playerName(w.ceasefireProposedBy)} har foreslått våpenhvile
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Rankingsliste */}
      <Panel title="Imperiumrangering">
        {playerRanking.length === 0 ? (
          <p className="text-textLo text-xs">Ingen spillere ennå.</p>
        ) : (
          <div className="space-y-1">
            {playerRanking.map((p, i) => (
              <div
                key={p.id}
                className={[
                  'flex items-center gap-2 text-xs py-0.5',
                  p.id === slotId ? 'text-accent font-semibold' : 'text-textHi',
                ].join(' ')}
              >
                <span className="w-4 text-textLo text-right shrink-0">#{i + 1}</span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: players[p.id]?.empireColor }}
                />
                <span className="flex-1 truncate">{p.name}{p.id === slotId ? ' (deg)' : ''}</span>
                <span className="text-textLo font-mono">{p.regions} reg</span>
                <span className="text-textLo font-mono">⚔️{p.military}</span>
                <span className="text-textLo font-mono">💰{p.treasury}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Nasjoner */}
      {nationList.length > 0 && (
        <Panel title={`Nasjoner (${nationList.length})`}>
          <div className="space-y-1.5">
            {nationList.map((n, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-base" aria-hidden="true">{n.flag}</span>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: n.color }}
                />
                <span className="font-medium text-textHi flex-1 truncate">{n.name}</span>
                <span className="text-textLo">{n.members?.length ?? 1} medl.</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Allianser */}
      {alliances.length > 0 && (
        <Panel title={`Allianser (${alliances.length})`}>
          <div className="space-y-1">
            {alliances.map((a, i) => (
              <div key={i} className="text-xs text-textHi flex items-center gap-1">
                <span>🤝</span>
                <span className="font-medium">{playerName(a.a)}</span>
                <span className="text-textLo">og</span>
                <span className="font-medium">{playerName(a.b)}</span>
                <span className="text-textLo ml-auto">{timeAgo(a.since)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Avsluttede kriger */}
      {recentEndedWars.length > 0 && (
        <Panel title="Nylig avsluttede kriger">
          <div className="space-y-1">
            {recentEndedWars.map((w, i) => (
              <div key={i} className="text-xs text-textLo flex items-center gap-1">
                <span>🕊️</span>
                <span>{playerName(w.attacker)}</span>
                <span>vs</span>
                <span>{playerName(w.defender)}</span>
                <span className="ml-auto">{w.endedAt ? timeAgo(w.endedAt) : ''}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {activeWars.length === 0 && alliances.length === 0 && nationList.length === 0 && (
        <div className="text-textLo text-sm text-center py-8">
          <div className="text-2xl mb-2">🌍</div>
          Ingen hendelser ennå. Start en krig, inngå allianser, eller dann en nasjon!
        </div>
      )}
    </div>
  );
}
