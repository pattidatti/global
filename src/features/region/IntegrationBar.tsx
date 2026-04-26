import { useEffect, useState } from 'react';

interface IntegrationBarProps {
  integration: number;       // 0–100 fra RTDB (ground truth)
  integrationStartedAt: number | null;
}

const INTEGRATION_DURATION_MS = 24 * 60 * 60 * 1000;

export function IntegrationBar({ integration, integrationStartedAt }: IntegrationBarProps) {
  const [display, setDisplay] = useState(integration);

  // Interpoler mellom RTDB-tikk visuelt (hvert sekund)
  useEffect(() => {
    setDisplay(integration);
    if (!integrationStartedAt || integration >= 100) return;

    const id = setInterval(() => {
      const elapsed = Date.now() - integrationStartedAt;
      const visual = Math.min((elapsed / INTEGRATION_DURATION_MS) * 100, 100);
      setDisplay(visual);
    }, 1000);

    return () => clearInterval(id);
  }, [integration, integrationStartedAt]);

  if (integration >= 100 || integrationStartedAt === null) return null;

  const pct = Math.round(display);
  const eta = integrationStartedAt
    ? Math.max(0, Math.round((INTEGRATION_DURATION_MS - (Date.now() - integrationStartedAt)) / 60_000))
    : null;

  return (
    <div className="space-y-1" aria-label="Integrasjonsfremdrift">
      <div className="flex justify-between text-xs text-textLo">
        <span>Integrasjon</span>
        <span>{pct}%{eta !== null && ` · ${eta} min igjen`}</span>
      </div>
      <div className="h-1.5 bg-panelEdge rounded-full overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
