import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithGoogle, signInAnon, onAuthChange } from '../firebase/auth';
import { CompassRoseSVG } from '../ui/CompassRoseSVG';

function FeaturePillar({
  icon,
  title,
  body,
  delayClass,
}: {
  icon: string;
  title: string;
  body: string;
  delayClass: string;
}) {
  return (
    <div className={`text-center ${delayClass}`}>
      <span className="text-2xl">{icon}</span>
      <p className="font-serif text-[#f5e9c8] text-sm font-semibold mt-1">{title}</p>
      <p className="text-[#e8d5a8] text-xs mt-0.5 leading-snug">{body}</p>
    </div>
  );
}

export function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthChange(user => {
      if (user) navigate('/servers', { replace: true });
    });
  }, [navigate]);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      navigate('/servers');
    } catch {
      setError('Pålogging mislyktes. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDevLogin() {
    setLoading(true);
    setError(null);
    try {
      await signInAnon();
      navigate('/servers');
    } catch {
      setError('Dev-pålogging mislyktes.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-4"
      aria-label="Innlogging GEOPOLITY"
    >
      {/* Animated warm sepia overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(50,28,10,0.35) 0%, rgba(30,16,4,0.78) 100%)',
          animation: 'pulseGlow 6s ease-in-out infinite',
        }}
        aria-hidden="true"
      />

      {/* Warm copper glow behind the card */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(168,90,42,0.12) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="w-full max-w-md relative z-10">
        {/* Title block */}
        <div className="text-center mb-8 animate-fade-up">
          <CompassRoseSVG size={72} className="mx-auto mb-4 opacity-80" />
          <h1
            className="font-serif text-[#f5e9c8] text-6xl sm:text-7xl tracking-[0.12em] drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]"
            style={{ fontVariant: 'small-caps' }}
          >
            Geopolity
          </h1>
          <p className="mt-2 font-serif italic text-[#e8d5a8] text-base sm:text-lg drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
            Et geopolitisk strategispill for klasserommet
          </p>
        </div>

        {/* Ornamental rule above card */}
        <div aria-hidden="true" className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#a85a2a]/50" />
          <span className="text-[#a85a2a]/60 font-serif text-xs">✦</span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#a85a2a]/50" />
        </div>

        <div className="parchment border border-panelEdge rounded-paper shadow-paperLg p-7 space-y-5 animate-fade-up-delay-1">
          <div className="text-center space-y-2">
            <h2 className="font-serif text-ink text-2xl">Velkommen</h2>
            <div
              aria-hidden="true"
              className="mx-auto w-12 h-px bg-gradient-to-r from-transparent via-[#a85a2a]/60 to-transparent"
            />
            <p className="text-inkLo text-sm">
              Logg inn for å bli med i et spill eller administrere klasserommet.
            </p>
          </div>

          {error && (
            <p
              className="text-danger text-sm text-center bg-danger/10 border border-danger/30 rounded-paper py-2 px-3"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            onClick={() => void handleLogin()}
            disabled={loading}
            className="w-full bg-accent text-panel font-serif text-lg tracking-wide py-2.5 rounded-paper shadow-paper hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {loading ? 'Logger inn …' : 'Logg inn med Google'}
          </button>

          {import.meta.env.DEV && (
            <button
              onClick={() => void handleDevLogin()}
              disabled={loading}
              data-testid="dev-login"
              className="w-full bg-warn/20 text-warn border border-warn/40 font-serif text-sm tracking-wide py-2 rounded-paper hover:bg-warn/30 disabled:opacity-50 transition-all"
            >
              Dev: Spill som anonym
            </button>
          )}

          <div className="text-center pt-2 border-t border-panelEdge/30">
            <Link
              to="/teacher"
              className="inline-block text-inkLo text-sm font-serif italic hover:text-accent transition-colors"
            >
              Lærer? Gå til lærerpanelet →
            </Link>
          </div>
        </div>

        {/* Ornamental rule below card */}
        <div aria-hidden="true" className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#a85a2a]/50" />
          <span className="text-[#a85a2a]/60 font-serif text-xs">✦</span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#a85a2a]/50" />
        </div>
      </div>

      {/* Feature pillars */}
      <div className="w-full max-w-md mt-6 grid grid-cols-3 gap-3 relative z-10">
        <FeaturePillar
          icon="🗺️"
          title="Territorium"
          body="Bygg et imperium fra én region"
          delayClass="animate-fade-up-delay-1"
        />
        <FeaturePillar
          icon="🤝"
          title="Diplomati"
          body="Alliér deg, forhandl, manipulér"
          delayClass="animate-fade-up-delay-2"
        />
        <FeaturePillar
          icon="⚔️"
          title="Krig"
          body="Erklær krig og send styrker i kamp"
          delayClass="animate-fade-up-delay-3"
        />
      </div>
    </main>
  );
}
