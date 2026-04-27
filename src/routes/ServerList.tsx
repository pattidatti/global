import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Users, Crown, ArrowRight, Map as MapIcon } from 'lucide-react';
import { firebaseApp } from '../firebase/config';
import { onAuthChange } from '../firebase/auth';
import { subscribeToServerList } from '../firebase/db';
import { useGameStore } from '../game/store';
import { CompassRoseSVG } from '../ui/CompassRoseSVG';
import type { ServerListEntry } from '../types/game';
import type { User } from 'firebase/auth';

type JoinGameResult =
  | { ok: true; data: { gameId: string; slotId: string; hasPickedRegion: boolean } }
  | { ok: false; error: string; melding: string };

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m siden`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}t siden`;
  return `${Math.floor(diff / 86_400_000)}d siden`;
}

function WaxSeal({ status }: { status: ServerListEntry['status'] }) {
  const isActive = status === 'active';
  const meta = isActive
    ? { label: 'Aktiv', bg: '#3f6b3f', ring: '#2a4a2a' }
    : { label: 'Fryst', bg: '#c47e1f', ring: '#9a601a' };
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <span
        className={`w-9 h-9 rounded-full shadow-seal flex items-center justify-center${isActive ? ' wax-seal-active' : ''}`}
        style={{
          background: `radial-gradient(circle at 30% 30%, ${meta.bg}, ${meta.ring})`,
        }}
        aria-hidden="true"
      >
        {isActive ? (
          <span className="w-2 h-2 rounded-full bg-[#fbf6e9]" />
        ) : (
          <span className="font-serif text-[10px] font-bold text-[#fbf6e9]">❄</span>
        )}
      </span>
      <span className="text-[10px] font-serif italic text-inkLo uppercase tracking-wider">
        {meta.label}
      </span>
    </div>
  );
}

export function ServerList() {
  const navigate = useNavigate();
  const { setAuth, setGameId, gameId: currentGameId } = useGameStore();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [servers, setServers] = useState<Record<string, ServerListEntry> | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthChange(u => {
      setUser(u);
      setAuthLoading(false);
      if (!u) navigate('/login', { replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    return subscribeToServerList(setServers);
  }, []);

  async function handleJoin(gameId: string) {
    if (!user) return;
    setJoiningId(gameId);
    setError(null);
    try {
      const fns = getFunctions(firebaseApp, 'europe-west1');
      const joinGame = httpsCallable<{ gameId: string }, JoinGameResult>(fns, 'joinGame');
      const result = await joinGame({ gameId });
      const data = result.data;

      if (!data.ok) {
        setError(data.melding ?? 'Klarte ikke bli med i spillet.');
        return;
      }

      setAuth(user.uid, data.data.slotId, false, user.displayName);
      setGameId(data.data.gameId);
      navigate(data.data.hasPickedRegion ? '/game' : '/pick');
    } catch {
      setError('Noe gikk galt. Prøv igjen.');
    } finally {
      setJoiningId(null);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-inkLo font-serif italic">Laster …</p>
      </div>
    );
  }

  const activeServers = servers
    ? Object.entries(servers)
        .filter(([, s]) => s.status !== 'ended')
        .sort(([, a], [, b]) => b.createdAt - a.createdAt)
    : [];

  return (
    <main className="min-h-screen bg-bg text-ink p-4 sm:p-8" aria-label="Spillservere">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="text-center pt-4 pb-6 border-b border-panelEdge/30 animate-fade-up">
          <div className="flex items-center justify-center gap-3">
            <CompassRoseSVG size={40} className="opacity-60" />
            <h1
              className="font-serif text-accent text-4xl sm:text-5xl tracking-[0.12em]"
              style={{ fontVariant: 'small-caps' }}
            >
              Geopolity
            </h1>
            <CompassRoseSVG size={40} className="opacity-60" style={{ transform: 'scaleX(-1)' }} />
          </div>
          <p className="mt-1 font-serif italic text-inkLo text-base">
            Velg en server for å bli med i klassens spill
          </p>
        </header>

        <section className="space-y-4">
          {servers === null ? (
            <p className="text-inkLo text-sm font-serif italic text-center">
              Laster serverliste …
            </p>
          ) : activeServers.length === 0 ? (
            <div className="parchment border border-panelEdge/60 rounded-paper shadow-paper p-8 text-center animate-fade-up">
              <MapIcon
                size={48}
                className="mx-auto text-inkLo mb-3 animate-icon-float"
                strokeWidth={1.2}
              />
              <p className="font-serif text-ink text-lg">Ingen aktive spill</p>
              <p className="text-inkLo text-sm mt-1 font-serif italic">
                Spør læreren om å opprette et nytt klasserom.
              </p>
            </div>
          ) : (
            activeServers.map(([gameId, server], index) => {
              const isCurrent = currentGameId === gameId;
              const isFrozen = server.status === 'frozen';
              const isJoining = joiningId === gameId;
              return (
                <article
                  key={gameId}
                  className="parchment border border-panelEdge/60 rounded-paper shadow-paper lift-on-hover p-5 flex flex-col gap-0"
                  style={{ animation: `slideInCard 400ms ease ${index * 80}ms both` }}
                >
                  <div className="flex items-center gap-4">
                    <WaxSeal status={server.status} />

                    <div className="min-w-0 flex-1">
                      <h2 className="font-serif text-ink text-xl leading-tight truncate">
                        {server.name}
                      </h2>
                      <div className="mt-1.5 flex items-center gap-3 text-sm text-inkLo">
                        <span className="inline-flex items-center gap-1">
                          <Crown size={14} className="text-accent" />
                          <span className="truncate max-w-[160px]">{server.teacherName}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users size={14} className="text-accent" />
                          {server.playerCount} spiller{server.playerCount !== 1 ? 'e' : ''}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => void handleJoin(gameId)}
                      disabled={isFrozen || joiningId !== null}
                      className={[
                        'shrink-0 inline-flex items-center gap-1.5 px-5 py-2 rounded-paper font-serif text-base shadow-paper transition-all',
                        isCurrent
                          ? 'bg-good text-panel hover:brightness-110'
                          : 'bg-accent text-panel hover:brightness-110',
                        isFrozen || joiningId !== null
                          ? 'opacity-40 cursor-not-allowed'
                          : '',
                      ].join(' ')}
                    >
                      {isJoining ? 'Kobler til …' : isCurrent ? 'Fortsett' : 'Bli med'}
                      {!isJoining && <ArrowRight size={16} />}
                    </button>
                  </div>

                  <footer className="flex items-center gap-3 text-[10px] text-inkLo font-serif mt-3 pt-2 border-t border-panelEdge/20">
                    <span>
                      {server.playerCount} {server.playerCount !== 1 ? 'spillere' : 'spiller'}
                    </span>
                    <span className="text-panelEdge/40">·</span>
                    <span>{isFrozen ? 'Satt på pause' : 'Aktivt spill'}</span>
                    <span className="text-panelEdge/40">·</span>
                    <span>{formatRelativeTime(server.createdAt)}</span>
                  </footer>
                </article>
              );
            })
          )}
        </section>

        {error && (
          <p
            className="text-danger text-sm text-center bg-danger/10 border border-danger/30 rounded-paper py-2 px-3"
            role="alert"
          >
            {error}
          </p>
        )}

        <footer className="text-center pt-6">
          <Link
            to="/teacher"
            className="text-inkLo text-sm font-serif italic hover:text-accent transition-colors"
          >
            Lærer? Administrer klasserommet →
          </Link>
        </footer>
      </div>
    </main>
  );
}
