import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

type Anchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface FloatingPanelProps {
  title: string;
  anchor: Anchor;
  children: ReactNode;
  /** Desktop pixel width. Mobile becomes full-width bottom sheet. */
  width?: number;
  defaultCollapsed?: boolean;
  className?: string;
  /** Maximum height as a CSS value, e.g. 'calc(100vh - 200px)'. Defaults to a sensible value. */
  maxHeight?: string;
}

const ANCHOR_CLASSES: Record<Anchor, string> = {
  'top-left':     'md:top-3 md:left-3 md:right-auto',
  'top-right':    'md:top-3 md:right-3 md:left-auto',
  'bottom-left':  'md:bottom-3 md:left-3 md:right-auto',
  'bottom-right': 'md:bottom-3 md:right-3 md:left-auto',
};

export function FloatingPanel({
  title,
  anchor,
  children,
  width = 290,
  defaultCollapsed = false,
  className = '',
  maxHeight = 'calc(100% - 24px)',
}: FloatingPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  // On mobile, dock to the relevant edge; on desktop, use anchor
  const mobileEdge = anchor.startsWith('top') ? 'top-2 left-2 right-2' : 'bottom-2 left-2 right-2';

  return (
    <aside
      className={[
        'absolute z-[400] pointer-events-auto',
        mobileEdge,
        ANCHOR_CLASSES[anchor],
        // On mobile, full-bleed; on desktop, fixed width
        'md:w-[var(--fp-w)]',
        className,
      ].join(' ')}
      style={
        {
          // CSS var so Tailwind arbitrary value works without runtime template
          // (Tailwind JIT can't see md:w-[290px] dynamically)
          ['--fp-w' as string]: `${width}px`,
        } as React.CSSProperties
      }
      aria-label={title}
    >
      <div
        className="parchment border border-panelEdge/70 rounded-paper shadow-paperLg backdrop-blur-sm bg-panel/90 overflow-hidden flex flex-col"
        style={{ maxHeight }}
      >
        <header className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-panelEdge/40 bg-bg/50 shrink-0">
          <h3 className="font-serif text-ink text-base leading-tight tracking-wide truncate">
            {title}
          </h3>
          <button
            type="button"
            onClick={() => setCollapsed(c => !c)}
            className="p-1 -mr-1 rounded hover:bg-panelEdge/15 text-inkLo hover:text-ink transition-colors"
            aria-label={collapsed ? `Vis ${title}` : `Skjul ${title}`}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </header>
        {!collapsed && (
          <div className="overflow-y-auto text-ink">
            {children}
          </div>
        )}
      </div>
    </aside>
  );
}
