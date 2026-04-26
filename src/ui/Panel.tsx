import type { ReactNode } from 'react';

interface PanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
  role?: string;
  'aria-label'?: string;
  /** Show ornamental rule under title */
  ornate?: boolean;
}

export function Panel({
  title,
  children,
  className = '',
  role,
  'aria-label': ariaLabel,
  ornate = true,
}: PanelProps) {
  return (
    <section
      className={`parchment border border-panelEdge/60 rounded-paper shadow-paper overflow-hidden ${className}`}
      role={role}
      aria-label={ariaLabel ?? title}
    >
      {title && (
        <header className="px-3 sm:px-4 pt-2.5 pb-2 border-b border-panelEdge/30 bg-bg/40">
          <h2 className="font-serif text-ink text-base sm:text-lg leading-tight tracking-wide">
            {title}
          </h2>
          {ornate && (
            <div
              aria-hidden="true"
              className="mt-1 h-px w-10 bg-gradient-to-r from-accent/70 to-transparent"
            />
          )}
        </header>
      )}
      <div className="p-3 sm:p-4 text-ink">{children}</div>
    </section>
  );
}
