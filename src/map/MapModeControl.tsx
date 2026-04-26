import { Map, Globe, Crown } from 'lucide-react';

export type MapMode = 'region' | 'culture' | 'empire';

const MODES: { id: MapMode; Icon: typeof Map; label: string }[] = [
  { id: 'region',  Icon: Map,   label: 'Regioner' },
  { id: 'culture', Icon: Globe, label: 'Kultur' },
  { id: 'empire',  Icon: Crown, label: 'Imperium' },
];

interface MapModeControlProps {
  mode: MapMode;
  onChange: (mode: MapMode) => void;
}

export function MapModeControl({ mode, onChange }: MapModeControlProps) {
  return (
    <div className="flex gap-1">
      {MODES.map(({ id, Icon, label }) => (
        <button
          key={id}
          title={label}
          onClick={() => onChange(id)}
          className={[
            'w-9 h-9 flex items-center justify-center rounded-paper border transition-colors',
            mode === id
              ? 'bg-accent/90 border-accent text-white shadow-paper'
              : 'bg-panel/85 border-panelEdge/50 text-inkLo hover:text-ink hover:bg-panel backdrop-blur-sm',
          ].join(' ')}
        >
          <Icon size={16} strokeWidth={mode === id ? 2.2 : 1.6} aria-hidden />
        </button>
      ))}
    </div>
  );
}
