import { useEffect, useMemo, useState } from 'react';
import {
  subscribeToGameSummary,
  subscribeToTeacherLog,
  type GameSummary,
} from '../../firebase/teacherDashboard';
import { subscribeToGameMeta } from '../../firebase/db';
import { UnMeetingTrigger } from '../un/UnMeetingTrigger';
import type { Player } from '../../types/player';
import type { GameMeta } from '../../types/game';
import type { TeacherLogEntry } from '../../types/teacherLog';

interface DashboardPanelProps {
  gameId: string;
}

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
const EMPTY_SUMMARY: GameSummary = {
  playersOnline: 0,
  playersTotal: 0,
  nationCount: 0,
  activeWarCount: 0,
  totalRegionsClaimed: 0,
};

function formatRelative(ts: number, now: number): string {
  const deltaSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (deltaSec < 60) return `${deltaSec}s siden`;
  const deltaMin = Math.floor(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}m siden`;
  const deltaH = Math.floor(deltaMin / 60);
  if (deltaH < 24) return `${deltaH}t siden`;
  return `${Math.floor(deltaH / 24)}d siden`;
}

function logMessage(entry: TeacherLogEntry): string {
  switch (entry.type) {
    case 'war_declared':
      return `Krig erklært: ${entry.attacker} → ${entry.defender} (${entry.contestedRegionIds.length} regioner)`;
    case 'nation_formed':
      return `Nasjon dannet: ${entry.flag} ${entry.name}`;
    case 'nation_dissolved':
      return `Nasjon oppløst: ${entry.name}`;
    case 'league_formed':
      return `Forbund dannet: ${entry.name}`;
    case 'league_dissolved':
      return `Forbund oppløst: ${entry.name}`;
    case 'league_member_joined':
      return `${entry.nationName} ble medlem av ${entry.leagueName}`;
    case 'league_member_left':
      return `${entry.nationName} forlot ${entry.leagueName}`;
    case 'league_threatened':
      return `Forbundet ${entry.leagueName} kan trekkes inn (${entry.defenderNationName} angripes)`;
    case 'un_meeting_closed':
      return `FN-møte avsluttet: «${entry.agenda}» — vinner: ${entry.winningOption} (${entry.totalVotes} stemmer)`;
  }
}

function logIcon(entry: TeacherLogEntry): string {
  switch (entry.type) {
    case 'war_declared':         return '⚔️';
    case 'nation_formed':        return '🏛️';
    case 'nation_dissolved':     return '💔';
    case 'league_formed':        return '🤝';
    case 'league_dissolved':     return '🔓';
    case 'league_member_joined': return '➕';
    case 'league_member_left':   return '➖';
    case 'league_threatened':    return '🚨';
    case 'un_meeting_closed':    return '🗳️';
  }
}

export function DashboardPanel({ gameId }: DashboardPanelProps) {
  const [summary, setSummary] = useState<GameSummary>(EMPTY_SUMMARY);
  const [players, setPlayers] = useState<Record<string, Player> | null>(null);
  const [meta, setMeta] = useState<GameMeta | null>(null);
  const [logEntries, setLogEntries] = useState<Record<string, TeacherLogEntry> | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    return subscribeToGameSummary(gameId, (s, p) => {
      setSummary(s);
      setPlayers(p);
    });
  }, [gameId]);

  useEffect(() => subscribeToGameMeta(gameId, setMeta), [gameId]);
  useEffect(() => subscribeToTeacherLog(gameId, setLogEntries, 20), [gameId]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const playerRows = useMemo(() => {
    if (!players) return [];
    return Object.entries(players)
      .map(([slotId, p]) => ({
        slotId,
        displayName: p.displayName,
        treasury: p.treasury ?? 0,
        regions: p.regionIds?.length ?? 0,
        online: now - (p.lastSeenAt ?? 0) < ONLINE_THRESHOLD_MS,
        maintenance: p.lastMaintenanceCost ?? 0,
      }))
      .sort((a, b) => b.regions - a.regions);
  }, [players, now]);

  const sortedLog = useMemo(() => {
    if (!logEntries) return [];
    return Object.entries(logEntries)
      .map(([id, e]) => ({ id, ...e }))
      .sort((a, b) => b.ts - a.ts);
  }, [logEntries]);

  const lastTickAgo = meta?.lastMacroTickAt
    ? formatRelative(meta.lastMacroTickAt, now)
    : '–';

  return (
    <div className="space-y-4">
      {/* FN-møte-kontroll */}
      <section className="space-y-2">
        <h3 className="text-textHi font-semibold text-sm">FN-møte</h3>
        <UnMeetingTrigger gameId={gameId} />
      </section>

      {/* Live-tellere */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Online"   value={`${summary.playersOnline}/${summary.playersTotal}`} />
        <Stat label="Nasjoner" value={summary.nationCount} />
        <Stat label="Kriger"   value={summary.activeWarCount} accent={summary.activeWarCount > 0 ? 'danger' : undefined} />
        <Stat label="Regioner" value={summary.totalRegionsClaimed} />
        <Stat label="Siste tikk" value={lastTickAgo} />
      </div>

      {/* Spillerliste */}
      <section className="space-y-2">
        <h3 className="text-textHi font-semibold text-sm">Spillere</h3>
        {playerRows.length === 0 ? (
          <p className="text-textLo text-xs">Ingen spillere ennå.</p>
        ) : (
          <div className="bg-bg/40 rounded border border-panelEdge overflow-hidden">
            <table className="w-full text-xs">
              <thead className="text-textLo text-left">
                <tr className="border-b border-panelEdge">
                  <th className="px-2 py-1.5 font-medium">●</th>
                  <th className="px-2 py-1.5 font-medium">Navn</th>
                  <th className="px-2 py-1.5 font-medium text-right">Reg.</th>
                  <th className="px-2 py-1.5 font-medium text-right">💰</th>
                  <th className="px-2 py-1.5 font-medium text-right">Vedl.</th>
                </tr>
              </thead>
              <tbody>
                {playerRows.map(row => (
                  <tr key={row.slotId} className="border-b border-panelEdge/50 last:border-b-0">
                    <td className="px-2 py-1">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${row.online ? 'bg-good' : 'bg-textLo/40'}`}
                        aria-label={row.online ? 'Online' : 'Offline'}
                      />
                    </td>
                    <td className="px-2 py-1 text-textHi truncate max-w-[180px]">{row.displayName}</td>
                    <td className="px-2 py-1 text-right font-mono">{row.regions}</td>
                    <td className="px-2 py-1 text-right font-mono">{row.treasury}</td>
                    <td className={`px-2 py-1 text-right font-mono ${row.maintenance > 0 ? 'text-warn' : 'text-textLo'}`}>
                      {row.maintenance > 0 ? `−${row.maintenance}` : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Varselstrøm */}
      <section className="space-y-2">
        <h3 className="text-textHi font-semibold text-sm">Varsler</h3>
        {sortedLog.length === 0 ? (
          <p className="text-textLo text-xs">Ingen varsler ennå.</p>
        ) : (
          <ul className="space-y-1">
            {sortedLog.map(entry => (
              <li
                key={entry.id}
                className="flex items-start gap-2 text-xs bg-bg/40 border border-panelEdge rounded px-2 py-1.5"
              >
                <span aria-hidden="true">{logIcon(entry)}</span>
                <span className="flex-1 text-textHi">{logMessage(entry)}</span>
                <span className="text-textLo shrink-0">{formatRelative(entry.ts, now)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: 'danger' | 'warn' | 'good' }) {
  const accentCls =
    accent === 'danger' ? 'text-danger' :
    accent === 'warn'   ? 'text-warn' :
    accent === 'good'   ? 'text-good' :
    'text-textHi';
  return (
    <div className="bg-bg/40 border border-panelEdge rounded px-3 py-2">
      <div className="text-textLo text-[10px] uppercase tracking-wide">{label}</div>
      <div className={`font-mono text-sm ${accentCls}`}>{value}</div>
    </div>
  );
}
