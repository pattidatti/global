import type { CSSProperties } from 'react';

interface Props {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function CompassRoseSVG({ size = 120, className = '', style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Kompassrose"
      aria-hidden="true"
      className={className}
      style={{ display: 'block', ...style }}
    >
      {/* Outer ring — rotates slowly */}
      <g
        className="animate-compass"
        style={{ transformOrigin: '60px 60px' }}
      >
        {/* N point */}
        <polygon points="60,8 55,48 60,56 65,48" fill="#a85a2a" />
        {/* S point */}
        <polygon points="60,112 55,72 60,64 65,72" fill="#d4906a" />
        {/* E point */}
        <polygon points="112,60 72,55 64,60 72,65" fill="#d4906a" />
        {/* W point */}
        <polygon points="8,60 48,55 56,60 48,65" fill="#d4906a" />
        {/* NE intercardinal */}
        <polygon points="94,26 72,52 68,56 74,50" fill="#a85a2a" opacity="0.6" />
        {/* NW intercardinal */}
        <polygon points="26,26 48,52 52,56 46,50" fill="#a85a2a" opacity="0.6" />
        {/* SE intercardinal */}
        <polygon points="94,94 72,68 68,64 74,70" fill="#a85a2a" opacity="0.6" />
        {/* SW intercardinal */}
        <polygon points="26,94 48,68 52,64 46,70" fill="#a85a2a" opacity="0.6" />
        {/* Outer ring circle */}
        <circle cx="60" cy="60" r="26" fill="none" stroke="#a85a2a" strokeWidth="0.8" opacity="0.4" />
        <circle cx="60" cy="60" r="30" fill="none" stroke="#a85a2a" strokeWidth="0.4" opacity="0.25" />
      </g>

      {/* Inner — static labels and center dot */}
      <g>
        <circle cx="60" cy="60" r="5" fill="#a85a2a" />
        <circle cx="60" cy="60" r="3" fill="#fbf6e9" />
        <text x="60" y="22" textAnchor="middle" fontFamily="'EB Garamond', Georgia, serif"
          fontSize="9" fill="#a85a2a" fontWeight="700">N</text>
        <text x="60" y="103" textAnchor="middle" fontFamily="'EB Garamond', Georgia, serif"
          fontSize="9" fill="#d4906a">S</text>
        <text x="99" y="64" textAnchor="middle" fontFamily="'EB Garamond', Georgia, serif"
          fontSize="9" fill="#d4906a">Ø</text>
        <text x="21" y="64" textAnchor="middle" fontFamily="'EB Garamond', Georgia, serif"
          fontSize="9" fill="#d4906a">V</text>
      </g>
    </svg>
  );
}
