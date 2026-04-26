import { RefreshCw } from 'lucide-react';

interface SchemaVersionBannerProps {
  visible: boolean;
}

export function SchemaVersionBanner({ visible }: SchemaVersionBannerProps) {
  if (!visible) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 backdrop-blur-sm"
    >
      <div className="parchment border border-warn/70 rounded-paper shadow-paperLg p-7 max-w-sm text-center space-y-4">
        <RefreshCw className="mx-auto text-warn" size={36} strokeWidth={1.8} />
        <h2 className="font-serif text-ink text-xl">Spillet har blitt oppdatert</h2>
        <p className="text-inkLo text-sm leading-relaxed">
          En ny versjon av <span className="font-serif italic">Geopolity</span> er tilgjengelig.
          Last inn siden på nytt for å fortsette.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full py-2 bg-accent text-panel rounded-paper font-semibold hover:brightness-110 transition-all shadow-paper"
        >
          Last inn på nytt
        </button>
      </div>
    </div>
  );
}
