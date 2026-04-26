import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import { useGameStore } from '../../game/store';
import { useLeagues } from '../league/useLeagues';
import { colors } from '../../ui/tokens';

interface NodeDatum {
  id: string;
  name: string;
  color: string;
  isMe: boolean;
  flag?: string;
  nationName?: string;
  /** Relativt mål for nodestørrelse — drevet av antall regioner. */
  val: number;
  regionCount: number;
}

interface LinkDatum {
  source: string;
  target: string;
  status: 'alliance' | 'war' | 'pending-alliance' | 'trade' | 'league';
  /** Tidspunkt status sist endret seg — brukes til å regne varighet. */
  since?: number;
}

const STATUS_COLOR: Record<LinkDatum['status'], string> = {
  alliance:           colors.good,
  war:                colors.danger,
  'pending-alliance': colors.warn,
  trade:              colors.accent,
  league:             '#a78bfa', // lilla — tydelig forskjellig fra de øvrige
};

/**
 * Tegne-bredde per lenke. Allianse-lenker gror med varighet (1–4 px),
 * krig er alltid 3, forbund er stiplet og 1.
 */
function computeLinkWidth(l: LinkDatum): number {
  if (l.status === 'war') return 3;
  if (l.status === 'league') return 1;
  if (l.status === 'alliance' && typeof l.since === 'number') {
    const ageDays = (Date.now() - l.since) / (1000 * 60 * 60 * 24);
    return Math.min(4, 1 + ageDays / 2); // +1 px per 2 døgn, capped 4
  }
  return 2;
}

const STATUS_LABEL: Record<LinkDatum['status'], string> = {
  alliance:           'Allianse',
  war:                'Krig',
  'pending-alliance': 'Pågående forslag',
  trade:              'Handel',
  league:             'Forbund',
};

interface DiplomacyForceGraphProps {
  onSelectNode?: (slotId: string) => void;
  selectedSlotId?: string | null;
}

export function DiplomacyForceGraph({ onSelectNode, selectedSlotId }: DiplomacyForceGraphProps) {
  const players = useGameStore(s => s.players);
  const nations = useGameStore(s => s.nations);
  const diplomacy = useGameStore(s => s.diplomacy);
  const mySlot = useGameStore(s => s.slotId);
  const gameId = useGameStore(s => s.gameId);
  const leagues = useLeagues(gameId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 400, height: 280 });
  const [hover, setHover] = useState<{ node: NodeDatum; x: number; y: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<ForceGraphMethods<any, any>>(undefined as unknown as ForceGraphMethods<any, any>);

  const { nodes, links } = useMemo(() => {
    // Bygg slotId → nation lookup for å vise flag i tooltip
    const slotToNation = new Map<string, { name: string; flag: string; nationId: string }>();
    for (const [nationId, n] of Object.entries(nations)) {
      slotToNation.set(n.founderId, { name: n.name, flag: n.flag, nationId });
    }

    const ns: NodeDatum[] = Object.entries(players).map(([id, p]) => {
      const n = slotToNation.get(id);
      const regionCount = (p.regionIds ?? []).length;
      return {
        id,
        name: p.displayName,
        color: p.empireColor || '#888',
        isMe: id === mySlot,
        flag: n?.flag,
        nationName: n?.name,
        regionCount,
        // val styrer nodestørrelse i ForceGraph2D (skalert sqrt for jevnere visuell vekst)
        val: 1 + Math.sqrt(regionCount),
      };
    });

    const ls: LinkDatum[] = [];
    for (const [key, d] of Object.entries(diplomacy)) {
      if (d.status === 'neutral') continue;
      const [a, b] = key.split('__');
      if (!players[a] || !players[b]) continue;
      ls.push({
        source: a,
        target: b,
        status: d.status as LinkDatum['status'],
        since: d.since,
      });
    }

    // Forbund-edges: tegn lette lenker mellom alle medlems-grunnleggere i samme forbund
    for (const league of Object.values(leagues)) {
      const founderSlots = league.memberNationIds
        .map(nid => nations[nid]?.founderId)
        .filter((s): s is string => !!s && !!players[s]);
      for (let i = 0; i < founderSlots.length; i++) {
        for (let j = i + 1; j < founderSlots.length; j++) {
          ls.push({ source: founderSlots[i], target: founderSlots[j], status: 'league' });
        }
      }
    }

    return { nodes: ns, links: ls };
  }, [players, nations, diplomacy, leagues, mySlot]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setSize({
          width: Math.max(200, entry.contentRect.width),
          height: Math.max(200, entry.contentRect.height),
        });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const fg = fgRef.current;
    if (!fg) return;
    const z = fg.zoom();
    fg.zoom(z * factor, 250);
  }, []);

  const zoomReset = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.zoomToFit(300, 40);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-bg/30 rounded overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        graphData={{ nodes, links }}
        width={size.width}
        height={size.height}
        nodeRelSize={6}
        nodeVal={(n: NodeDatum) => n.val}
        nodeLabel=""
        nodeColor={(n: NodeDatum) =>
          selectedSlotId === n.id ? '#ffffff' : n.isMe ? colors.accent : n.color
        }
        linkColor={(l: LinkDatum) => STATUS_COLOR[l.status] ?? '#888'}
        linkWidth={(l: LinkDatum) => computeLinkWidth(l)}
        linkLineDash={(l: LinkDatum) => (l.status === 'league' ? [4, 4] : null)}
        linkDirectionalParticles={(l: LinkDatum) => (l.status === 'alliance' ? 2 : 0)}
        linkDirectionalParticleColor={() => colors.good}
        onNodeClick={(n: NodeDatum) => onSelectNode?.(n.id)}
        onNodeHover={(n: NodeDatum | null) => {
          if (!n) {
            setHover(null);
            return;
          }
          // Vi bruker offsetX/Y fra fg-canvas (n.x/y er world-coords) — projicer
          const fg = fgRef.current;
          if (!fg) {
            setHover({ node: n, x: 0, y: 0 });
            return;
          }
          // graph2ScreenCoords gir piksler innen canvas-en
          const pt = fg.graph2ScreenCoords(
            (n as NodeDatum & { x?: number }).x ?? 0,
            (n as NodeDatum & { y?: number }).y ?? 0,
          );
          setHover({ node: n, x: pt.x, y: pt.y });
        }}
        cooldownTicks={80}
        backgroundColor="rgba(0,0,0,0)"
      />

      {/* Hover-tooltip */}
      {hover && (
        <div
          className="absolute pointer-events-none bg-panel border border-panelEdge rounded px-2 py-1 text-[10px] text-textHi shadow-lg whitespace-nowrap z-10"
          style={{
            left: Math.min(size.width - 160, Math.max(0, hover.x + 12)),
            top: Math.min(size.height - 60, Math.max(0, hover.y - 8)),
          }}
          aria-hidden="true"
        >
          {hover.node.flag && hover.node.nationName && (
            <div className="font-semibold">{hover.node.flag} {hover.node.nationName}</div>
          )}
          <div className="text-textHi">{hover.node.name}{hover.node.isMe && ' (deg)'}</div>
          <div className="text-textLo">{hover.node.regionCount} {hover.node.regionCount === 1 ? 'region' : 'regioner'}</div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-2 left-2 bg-bg/80 backdrop-blur rounded px-2 py-1.5 text-[10px] space-y-0.5 pointer-events-none">
        {(Object.keys(STATUS_COLOR) as LinkDatum['status'][]).map(status => (
          <div key={status} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-0.5 shrink-0"
              style={{
                backgroundColor: STATUS_COLOR[status],
                borderTop: status === 'league' ? `1px dashed ${STATUS_COLOR[status]}` : undefined,
                background: status === 'league' ? 'transparent' : STATUS_COLOR[status],
              }}
              aria-hidden="true"
            />
            <span className="text-textHi">{STATUS_LABEL[status]}</span>
          </div>
        ))}
      </div>

      {/* Zoom-kontroller */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => zoomBy(1.4)}
          className="w-6 h-6 rounded bg-bg/80 backdrop-blur text-textHi text-sm hover:bg-bg"
          aria-label="Zoom inn"
        >+</button>
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.4)}
          className="w-6 h-6 rounded bg-bg/80 backdrop-blur text-textHi text-sm hover:bg-bg"
          aria-label="Zoom ut"
        >−</button>
        <button
          type="button"
          onClick={zoomReset}
          className="w-6 h-6 rounded bg-bg/80 backdrop-blur text-textHi text-[9px] hover:bg-bg"
          aria-label="Tilpass visning"
        >fit</button>
      </div>
    </div>
  );
}
