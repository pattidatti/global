import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithGoogle, onAuthChange } from '../firebase/auth';

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

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: 'url(/landingpage.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
      aria-label="Innlogging GEOPOLITY"
    >
      {/* Warm sepia overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(50,28,10,0.35) 0%, rgba(30,16,4,0.78) 100%)',
        }}
        aria-hidden="true"
      />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
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

        <div className="parchment border border-panelEdge rounded-paper shadow-paperLg p-7 space-y-5">
          <div className="text-center space-y-1">
            <h2 className="font-serif text-ink text-2xl">Velkommen</h2>
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

          <div className="text-center pt-2 border-t border-panelEdge/30">
            <Link
              to="/teacher"
              className="inline-block text-inkLo text-sm font-serif italic hover:text-accent transition-colors"
            >
              Lærer? Gå til lærerpanelet →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
