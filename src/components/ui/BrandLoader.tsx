/**
 * Carregamento com a marca do E-Plenarius: o "E" do ícone do app, o check dourado
 * que se desenha em loop e o anel ciano girando. Sem texto "Carregando…" na tela
 * (fica só para leitores de tela). Respeita "reduzir movimento" do sistema.
 */
export function BrandLoader({ size = 76, label = 'Carregando', fullScreen = true, dark = false }: {
  size?: number; label?: string; fullScreen?: boolean; dark?: boolean;
}) {
  const mark = (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-4">
      <div className="ep-tile" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
          <defs>
            <radialGradient id="ep-bg" cx="50%" cy="22%" r="85%">
              <stop offset="0" stopColor="#3566E8" />
              <stop offset="0.55" stopColor="#1638B8" />
              <stop offset="1" stopColor="#0B1D5E" />
            </radialGradient>
            <linearGradient id="ep-e" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#D9E2FF" />
            </linearGradient>
            <linearGradient id="ep-check" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FCE08A" />
              <stop offset="1" stopColor="#C8952E" />
            </linearGradient>
            <filter id="ep-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.1" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <rect width="100" height="100" rx="23" fill="url(#ep-bg)" />

          {/* Anel segmentado (6 arcos) + pontos, girando */}
          <g className="ep-ring" filter="url(#ep-glow)">
            <circle cx="50" cy="50" r="30" fill="none" stroke="#5EE7FF" strokeWidth="1.8" strokeLinecap="round"
                    strokeDasharray="24.4 7" transform="rotate(-80 50 50)" />
            <circle cx="50" cy="20" r="1.6" fill="#8FF3FF" />
            <circle cx="24" cy="65" r="1.6" fill="#8FF3FF" />
            <circle cx="71" cy="71" r="1.6" fill="#8FF3FF" />
          </g>
          <circle cx="50" cy="50" r="25.5" fill="none" stroke="#7FDCFF" strokeOpacity="0.35" strokeWidth="0.6"
                  strokeDasharray="0.4 2.2" strokeLinecap="round" />

          {/* E da marca */}
          <path d="M35.5 34 H64.5 L61.6 40.4 H43.1 V46.9 H55.2 L52.4 53.1 H43.1 V59.6 H64.5 L61.6 66 H35.5 Z" fill="url(#ep-e)" />

          {/* Check dourado que se desenha */}
          <path className="ep-check" d="M53.5 54.2 L58.2 58.8 L68.6 45.6" fill="none" stroke="url(#ep-check)"
                strokeWidth="5.4" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
        </svg>
      </div>
      <span className="sr-only">{label}…</span>
      <style>{`
        .ep-tile { border-radius: 24%; animation: ep-breathe 2.4s ease-in-out infinite;
                   box-shadow: 0 10px 30px -8px rgba(20,71,230,${dark ? '0.55' : '0.45'}); }
        .ep-ring { transform-origin: 50px 50px; animation: ep-spin 3.2s linear infinite; }
        .ep-check { stroke-dasharray: 1; stroke-dashoffset: 1; animation: ep-draw 2.4s cubic-bezier(.65,0,.35,1) infinite; }
        @keyframes ep-spin { to { transform: rotate(360deg); } }
        @keyframes ep-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
        @keyframes ep-draw {
          0% { stroke-dashoffset: 1; opacity: 1; }
          35% { stroke-dashoffset: 0; opacity: 1; }
          75% { stroke-dashoffset: 0; opacity: 1; }
          92%, 100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ep-tile, .ep-ring { animation: none; }
          .ep-check { animation: none; stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );

  if (!fullScreen) return mark;
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: dark ? '#0B0D10' : '#F6F7F9' }}>
      {mark}
    </div>
  );
}
