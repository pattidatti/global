interface ResourceCounterProps {
  icon: string;
  label: string;
  value: number;
  low?: boolean;
  surplus?: boolean;
}

export function ResourceCounter({ icon, label, value, low, surplus }: ResourceCounterProps) {
  const colorClass = low
    ? 'text-warn'
    : surplus
    ? 'text-good'
    : 'text-accent';

  const formatted = value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}M`
    : value >= 1_000
    ? `${(value / 1_000).toFixed(1)}K`
    : String(value);

  return (
    <div
      className="flex items-center gap-1 font-mono text-sm leading-none"
      aria-label={`${label}: ${formatted}`}
      title={label}
    >
      <span aria-hidden="true" className="text-base opacity-90">{icon}</span>
      <span className={`${colorClass} font-semibold tabular-nums`}>{formatted}</span>
    </div>
  );
}
