import { useMemo, useState } from 'react';
import { useGameStore } from '../../game/store';
import { useLeagues } from './useLeagues';
import {
  callCreateLeague,
  callInviteNationToLeague,
  callAcceptLeagueInvite,
  callLeaveLeague,
  callDissolveLeague,
} from './leagueClient';

export function LeaguePanel() {
  const gameId = useGameStore(s => s.gameId);
  const slotId = useGameStore(s => s.slotId);
  const nations = useGameStore(s => s.nations);
  const leagues = useLeagues(gameId);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [inviteTargetId, setInviteTargetId] = useState<string>('');

  const myNation = useMemo(() => {
    if (!slotId) return null;
    for (const [nationId, nation] of Object.entries(nations)) {
      if (nation.founderId === slotId) return { nationId, nation };
    }
    return null;
  }, [nations, slotId]);

  const myLeague = useMemo(() => {
    if (!myNation?.nation.leagueId) return null;
    const league = leagues[myNation.nation.leagueId];
    return league ? { leagueId: myNation.nation.leagueId, league } : null;
  }, [leagues, myNation]);

  const incomingInvites = useMemo(() => {
    if (!myNation) return [];
    return Object.entries(leagues)
      .filter(([, l]) => l.pendingInvites?.[myNation.nationId])
      .map(([leagueId, league]) => ({ leagueId, league }));
  }, [leagues, myNation]);

  async function run<T>(fn: () => Promise<{ ok: boolean; melding?: string; data?: T }>): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) setError(res.melding ?? 'Handling feilet.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nettverksfeil.');
    } finally {
      setBusy(false);
    }
  }

  if (!gameId) return null;

  if (!myNation) {
    return (
      <div className="text-textLo text-xs">
        Du må danne en nasjon før du kan delta i et forbund.
      </div>
    );
  }

  const isFounder = myLeague?.league.founderNationId === myNation.nationId;
  const otherNations = Object.entries(nations)
    .filter(([nid, n]) => nid !== myNation.nationId && !n.leagueId);

  return (
    <div className="space-y-3 text-sm">
      {error && <p className="text-danger text-xs">{error}</p>}

      {myLeague ? (
        <>
          <div>
            <div className="font-semibold text-textHi">{myLeague.league.name}</div>
            <div className="text-textLo text-xs">Forsvarspakt · {myLeague.league.memberNationIds.length} medlemmer</div>
          </div>

          <ul className="space-y-1">
            {myLeague.league.memberNationIds.map(nid => {
              const n = nations[nid];
              if (!n) return null;
              const isFounderNation = nid === myLeague.league.founderNationId;
              return (
                <li key={nid} className="flex items-center gap-2 text-xs bg-bg/40 px-2 py-1 rounded">
                  <span aria-hidden="true">{n.flag}</span>
                  <span className="flex-1 text-textHi truncate">{n.name}</span>
                  {isFounderNation && <span className="text-accent text-[10px]">Grunnlegger</span>}
                </li>
              );
            })}
          </ul>

          {isFounder && otherNations.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-panelEdge">
              <label className="text-xs text-textLo">Inviter nasjon:</label>
              <div className="flex gap-1">
                <select
                  value={inviteTargetId}
                  onChange={e => setInviteTargetId(e.target.value)}
                  className="flex-1 bg-bg border border-panelEdge rounded px-2 py-1 text-xs text-textHi"
                >
                  <option value="">– velg –</option>
                  {otherNations.map(([nid, n]) => (
                    <option key={nid} value={nid}>{n.flag} {n.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy || !inviteTargetId}
                  onClick={() => void run(() => callInviteNationToLeague({
                    gameId, leagueId: myLeague.leagueId, targetNationId: inviteTargetId,
                  })).then(() => setInviteTargetId(''))}
                  className="px-2 py-1 rounded bg-accent text-white text-xs disabled:opacity-40"
                >
                  Inviter
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-panelEdge">
            {isFounder ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => callDissolveLeague({ gameId, leagueId: myLeague.leagueId }))}
                className="flex-1 py-1.5 rounded bg-danger/20 text-danger text-xs disabled:opacity-40"
              >
                Oppløs forbund
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => callLeaveLeague({
                  gameId, leagueId: myLeague.leagueId, nationId: myNation.nationId,
                }))}
                className="flex-1 py-1.5 rounded bg-warn/20 text-warn text-xs disabled:opacity-40"
              >
                Forlat forbund
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {incomingInvites.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-textLo">Innkommende invitasjoner:</div>
              {incomingInvites.map(({ leagueId, league }) => (
                <div key={leagueId} className="flex items-center gap-2 bg-bg/40 px-2 py-1.5 rounded">
                  <span className="flex-1 text-xs text-textHi truncate">{league.name}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => callAcceptLeagueInvite({
                      gameId, leagueId, nationId: myNation.nationId,
                    }))}
                    className="px-2 py-0.5 rounded bg-good/30 text-good text-xs disabled:opacity-40"
                  >
                    Aksepter
                  </button>
                </div>
              ))}
            </div>
          )}

          {creating ? (
            <div className="space-y-2">
              <input
                type="text"
                value={newLeagueName}
                onChange={e => setNewLeagueName(e.target.value)}
                placeholder="Forbundnavn (f.eks. Den Nordiske Pakt)"
                maxLength={40}
                className="w-full bg-bg border border-panelEdge rounded px-2 py-1 text-xs text-textHi"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || newLeagueName.trim().length < 2}
                  onClick={() => void run(() => callCreateLeague({ gameId, name: newLeagueName.trim() }))
                    .then(() => { setCreating(false); setNewLeagueName(''); })}
                  className="flex-1 py-1.5 rounded bg-good text-white text-xs disabled:opacity-40"
                >
                  Opprett
                </button>
                <button
                  type="button"
                  onClick={() => { setCreating(false); setNewLeagueName(''); }}
                  className="px-3 py-1.5 rounded bg-bg border border-panelEdge text-textLo text-xs"
                >
                  Avbryt
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full py-1.5 rounded bg-accent/20 text-accent text-xs"
            >
              Opprett forbund
            </button>
          )}
        </>
      )}
    </div>
  );
}
