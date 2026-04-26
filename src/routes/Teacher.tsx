import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  ArrowLeft, Crown, Users, Snowflake, Play, XCircle, Trash2,
  BarChart3, Plus, ChevronDown, ChevronUp,
} from 'lucide-react';
import { firebaseApp } from '../firebase/config';
import { signInWithGoogle, onAuthChange } from '../firebase/auth';
import { subscribeToServerList } from '../firebase/db';
import { DashboardPanel } from '../features/teacher/DashboardPanel';
import type { ServerListEntry } from '../types/game';
import type { User } from 'firebase/auth';

interface CallableOk { ok: true; data?: { gameId?: string } }
interface CallableFail { ok: false; error: string; melding: string }
type CallableResult = CallableOk | CallableFail;

function StatusBadge({ status }: { status: ServerListEntry['status'] }) {
  const map = {
    active: { label: 'Aktiv', cls: 'bg-good/15 text-good border-good/40' },
    frozen: { label: 'Fryst', cls: 'bg-warn/15 text-warn border-warn/40' },
    ended:  { label: 'Avsluttet', cls: 'bg-danger/15 text-danger border-danger/40' },
  } as const;
  const { label, cls } = map[status];
  return (
    <span
      className={`text-xs font-serif italic px-2 py-0.5 rounded-paper border ${cls}`}
    >
      {label}
    </span>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'neutral' | 'good' | 'warn' | 'danger';
}

function ActionButton({ icon, label, onClick, disabled, loading, variant = 'neutral' }: ActionButtonProps) {
  const variantCls = {
    neutral: 'bg-bg/40 text-ink border-panelEdge/40 hover:bg-bg/70',
    good:    'bg-good/10 text-good border-good/40 hover:bg-good/20',
    warn:    'bg-warn/10 text-warn border-warn/40 hover:bg-warn/20',
    danger:  'bg-danger/10 text-danger border-danger/40 hover:bg-danger/20',
  }[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-paper border text-sm font-serif',
        'transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        variantCls,
      ].join(' ')}
    >
      {icon}
      <span>{loading ? '…' : label}</span>
    </button>
  );
}

export function Teacher() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [servers, setServers] = useState<Record<string, ServerListEntry> | null>(null);
  const [serverName, setServerName] = useState('');
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openDashboardId, setOpenDashboardId] = useState<string | null>(null);

  useEffect(() => {
    return onAuthChange(u => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    return subscribeToServerList(setServers);
  }, []);

  async function handleGoogleLogin() {
    setError(null);
    try {
      const u = await signInWithGoogle();
      setUser(u);
    } catch {
      setError('Google-pålogging mislyktes. Prøv igjen.');
    }
  }

  async function handleCreateServer() {
    if (!user) return;
    setCreating(true);
    setError(null);
    try {
      const fns = getFunctions(firebaseApp, 'europe-west1');
      const createGame = httpsCallable<{ name: string }, CallableResult>(fns, 'createGame');
      const result = await createGame({ name: serverName.trim() || 'Geopolity-server' });
      const data = result.data;
      if (!data.ok) {
        setError(data.melding);
        return;
      }
      setServerName('');
    } catch {
      setError('Noe gikk galt. Prøv igjen.');
    } finally {
      setCreating(false);
    }
  }

  async function callTeacherAction(action: string, gameId: string) {
    setActionId(gameId + action);
    setError(null);
    try {
      const fns = getFunctions(firebaseApp, 'europe-west1');
      const fn = httpsCallable<{ gameId: string }, CallableResult>(fns, action);
      const result = await fn({ gameId });
      const data = result.data;
      if (!data.ok) setError(data.melding);
    } catch {
      setError('Handlingen mislyktes. Prøv igjen.');
    } finally {
      setActionId(null);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-inkLo font-serif italic">Laster …</p>
      </div>
    );
  }

  const myServers = servers && user
    ? Object.entries(servers)
        .filter(([, s]) => s.teacherId === user.uid)
        .sort(([, a], [, b]) => b.createdAt - a.createdAt)
    : [];

  return (
    <main
      className="min-h-screen bg-bg text-ink p-4 sm:p-8"
      aria-label="Lærerpanel GEOPOLITY"
    >
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="flex items-center justify-between pt-2 pb-4 border-b border-panelEdge/30">
          <div>
            <h1
              className="font-serif text-accent text-3xl sm:text-4xl tracking-wide"
              style={{ fontVariant: 'small-caps' }}
            >
              Lærerpanel
            </h1>
            <p className="font-serif italic text-inkLo text-sm mt-0.5">
              Administrer klasserommets spill
            </p>
          </div>
          <Link
            to="/servers"
            className="inline-flex items-center gap-1 text-inkLo text-sm font-serif italic hover:text-accent transition-colors"
          >
            <ArrowLeft size={14} />
            Til serverliste
          </Link>
        </header>

        {!user ? (
          <div className="parchment border border-panelEdge/60 rounded-paper shadow-paper p-6 space-y-4 text-center">
            <Crown size={36} className="mx-auto text-accent" strokeWidth={1.5} />
            <p className="text-inkLo text-sm font-serif">
              Logg inn med Google for å administrere spill.
            </p>
            {error && <p className="text-danger text-sm" role="alert">{error}</p>}
            <button
              onClick={() => void handleGoogleLogin()}
              className="bg-accent text-panel font-serif px-6 py-2 rounded-paper shadow-paper hover:brightness-110 transition-all"
            >
              Logg inn med Google
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-inkLo text-sm font-serif italic">
              <Crown size={14} className="text-accent" />
              Logget inn som
              <span className="text-ink not-italic font-semibold">
                {user.displayName ?? user.email}
              </span>
            </div>

            {error && (
              <p
                className="text-danger text-sm bg-danger/10 border border-danger/30 rounded-paper py-2 px-3"
                role="alert"
              >
                {error}
              </p>
            )}

            {/* Opprett ny server */}
            <section className="parchment border border-panelEdge/60 rounded-paper shadow-paper p-5 space-y-3">
              <h2 className="font-serif text-ink text-xl flex items-center gap-2">
                <Plus size={18} className="text-accent" />
                Opprett nytt klasserom
              </h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={serverName}
                  onChange={e => setServerName(e.target.value)}
                  placeholder="Navn på serveren (valgfritt)"
                  className="flex-1 bg-bg/50 border border-panelEdge/50 rounded-paper px-3 py-2 text-ink placeholder-inkLo/70 font-serif focus:outline-none focus:border-accent focus:bg-bg/80"
                  onKeyDown={e => { if (e.key === 'Enter') void handleCreateServer(); }}
                />
                <button
                  onClick={() => void handleCreateServer()}
                  disabled={creating}
                  className="bg-accent text-panel font-serif px-5 py-2 rounded-paper shadow-paper hover:brightness-110 disabled:opacity-40 transition-all whitespace-nowrap"
                >
                  {creating ? 'Oppretter …' : 'Opprett'}
                </button>
              </div>
            </section>

            {/* Mine servere */}
            <section className="space-y-3">
              <h2 className="font-serif text-ink text-xl">Mine klasserom</h2>
              {myServers.length === 0 ? (
                <p className="text-inkLo text-sm font-serif italic">
                  Du har ingen klasserom ennå. Opprett ett over.
                </p>
              ) : (
                <div className="space-y-3">
                  {myServers.map(([gameId, server]) => {
                    const isOpen = openDashboardId === gameId;
                    return (
                      <article
                        key={gameId}
                        className="parchment border border-panelEdge/60 rounded-paper shadow-paper overflow-hidden"
                      >
                        <div className="p-4 flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-serif text-ink text-lg leading-tight">
                                {server.name}
                              </h3>
                              <StatusBadge status={server.status} />
                            </div>
                            <p className="text-inkLo text-sm mt-1 inline-flex items-center gap-1.5 font-serif italic">
                              <Users size={14} className="text-accent" />
                              {server.playerCount} spiller{server.playerCount !== 1 ? 'e' : ''}
                            </p>
                          </div>
                        </div>

                        <div className="px-4 pb-4 space-y-3">
                          {/* Spilltilstand */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-serif italic text-inkLo uppercase tracking-wider mr-1">
                              Tilstand:
                            </span>
                            {server.status === 'active' && (
                              <ActionButton
                                icon={<Snowflake size={14} />}
                                label="Frys"
                                variant="warn"
                                onClick={() => void callTeacherAction('freezeGame', gameId)}
                                disabled={actionId !== null}
                                loading={actionId === gameId + 'freezeGame'}
                              />
                            )}
                            {server.status === 'frozen' && (
                              <ActionButton
                                icon={<Play size={14} />}
                                label="Gjenoppta"
                                variant="good"
                                onClick={() => void callTeacherAction('resumeGame', gameId)}
                                disabled={actionId !== null}
                                loading={actionId === gameId + 'resumeGame'}
                              />
                            )}
                            {server.status !== 'ended' && (
                              <ActionButton
                                icon={<XCircle size={14} />}
                                label="Avslutt"
                                variant="danger"
                                onClick={() => void callTeacherAction('endGame', gameId)}
                                disabled={actionId !== null}
                                loading={actionId === gameId + 'endGame'}
                              />
                            )}
                          </div>

                          {/* Administrasjon */}
                          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-panelEdge/20">
                            <span className="text-xs font-serif italic text-inkLo uppercase tracking-wider mr-1 mt-2">
                              Administrasjon:
                            </span>
                            <ActionButton
                              icon={isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              label={isOpen ? 'Skjul dashboard' : 'Vis dashboard'}
                              variant="neutral"
                              onClick={() => setOpenDashboardId(isOpen ? null : gameId)}
                            />
                            <ActionButton
                              icon={<BarChart3 size={14} />}
                              label="Åpne kart"
                              variant="neutral"
                              onClick={() => window.open(`#/game?observe=${gameId}`, '_blank')}
                            />
                            <ActionButton
                              icon={<Trash2 size={14} />}
                              label="Slett"
                              variant="danger"
                              onClick={() => void callTeacherAction('deleteGame', gameId)}
                              disabled={actionId !== null}
                              loading={actionId === gameId + 'deleteGame'}
                            />
                          </div>
                        </div>

                        {isOpen && (
                          <div className="border-t border-panelEdge/30 p-4 bg-bg/30">
                            <DashboardPanel gameId={gameId} />
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
