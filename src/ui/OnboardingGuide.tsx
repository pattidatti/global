import { useState } from 'react';
import { useMyRegions } from '../game/selectors';

const STEPS = [
  {
    icon: '🗺️',
    title: 'Velg din startregion',
    desc: 'Kartet har allerede zoomet til din region. Klikk på den fargede regionen for å åpne detaljer.',
  },
  {
    icon: '🏗️',
    title: 'Bygg din første bygning',
    desc: 'Åpne «Region»-panelet og klikk «+ Bygg ny». En gård gir mat, en gruve gir metall, kaserner gir militærmakt.',
  },
  {
    icon: '⚔️',
    title: 'Ekspander imperiet',
    desc: 'Du starter med 50 militær — nok til to ekspansjoner. Klikk en nabobregion og bruk «Ekspander»-knappen.',
  },
  {
    icon: '⏱️',
    title: 'Vent på produksjonst­ikk',
    desc: 'Hvert 10. minutt kjører en produksjonstikk. Bygningene dine samler ressurser, som du så høster manuelt. Nedtellingen vises øverst til høyre.',
  },
];

export function OnboardingGuide() {
  const myRegions = useMyRegions();
  const hasBuildings = Object.values(myRegions).some(
    r => Object.keys(r.buildings ?? {}).length > 0,
  );
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('onboarding-done') === 'true',
  );
  const [step, setStep] = useState(0);

  if (hasBuildings || dismissed) return null;

  function dismiss() {
    sessionStorage.setItem('onboarding-done', 'true');
    setDismissed(true);
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] w-[340px] max-w-[calc(100vw-2rem)] pointer-events-auto"
      role="dialog"
      aria-label="Kom i gang-guide"
    >
      <div className="parchment border border-panelEdge rounded-paper shadow-paperLg p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">{current.icon}</span>
            <div>
              <div className="font-serif font-semibold text-ink text-sm">{current.title}</div>
              <div className="text-inkLo text-xs mt-0.5 leading-relaxed">{current.desc}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 text-inkLo hover:text-ink text-lg leading-none mt-0.5"
            aria-label="Lukk guide"
          >
            ×
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={[
                  'w-2 h-2 rounded-full transition-colors',
                  i === step ? 'bg-accent' : 'bg-panelEdge',
                ].join(' ')}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="px-2 py-1 rounded text-xs text-inkLo hover:text-ink border border-panelEdge/50 hover:bg-panelEdge/20 transition-colors"
              >
                Tilbake
              </button>
            )}
            {isLast ? (
              <button
                type="button"
                onClick={dismiss}
                className="px-3 py-1 rounded text-xs font-semibold bg-accent text-white hover:brightness-110 transition-colors"
              >
                Forstått!
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                className="px-3 py-1 rounded text-xs font-semibold bg-accent text-white hover:brightness-110 transition-colors"
              >
                Neste →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
