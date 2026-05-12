'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Menu } from 'lucide-react';
import api from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';

function Brasao({ size = 26, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="38" stroke={color} strokeWidth="1.5" />
      <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="0.9"
              strokeDasharray="2 3" opacity="0.5" />
      <path d="M40 18 L44.5 32 L59 32 L47.2 40.5 L51.8 54.5 L40 46 L28.2 54.5 L32.8 40.5 L21 32 L35.5 32 Z"
            fill={color} opacity="0.92" />
      <path d="M14 56 L66 56" stroke={color} strokeWidth="1.2" opacity="0.6" />
      <text x="40" y="68" textAnchor="middle" fontSize="8" fontFamily="Inter Tight, sans-serif"
            fontWeight="700" fill={color} letterSpacing="2">VA</text>
    </svg>
  );
}

export function Topbar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { user } = useAuth();
  const [chamberName, setChamberName] = useState<string | null>(null);
  const [chamberLogo, setChamberLogo] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.chamberId) return;
    api.get(`/chambers/${user.chamberId}`)
      .then(({ data }) => {
        setChamberName(data.name);
        if (data.logoUrl) setChamberLogo(`${API_BASE}${data.logoUrl}`);
      })
      .catch(() => {});
  }, [user?.chamberId]);

  return (
    <header className="flex items-center gap-3 px-4 h-14 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(15,23,42,0.08)', background: '#fff' }}>

      {/* Hamburger — visível apenas em tablet/mobile */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ width: 40, height: 40, color: '#4B5563', background: '#F6F7F9', border: '1px solid rgba(15,23,42,0.08)' }}
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>

      {/* Logo + nome da câmara */}
      <div className="flex items-center gap-2.5 flex-shrink-0" style={{ minWidth: 0, maxWidth: 220 }}>
        {chamberLogo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={chamberLogo} alt="logo" className="object-contain flex-shrink-0" style={{ width: 28, height: 28 }} />
        ) : (
          <Brasao size={26} color="#1447E6" />
        )}
        <span className="font-tight font-semibold text-gray-900 text-[13px] tracking-tight truncate hidden sm:block">
          {chamberName ?? '…'}
        </span>
      </div>

      {/* Live indicator — oculto em mobile para poupar espaço */}
      <div className="hidden md:flex items-center gap-1.5 ml-auto px-2.5 py-1 rounded-full text-[11px] font-mono-jet font-semibold tracking-wider"
           style={{ border: '1px solid rgba(15,23,42,0.08)', color: '#4B5563' }}>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
              style={{ background: '#10b981' }} />
        AO VIVO
      </div>

      {/* User chip */}
      {user && (
        <div className="flex items-center gap-2 px-2 py-1 rounded-full ml-auto md:ml-0"
             style={{ border: '1px solid rgba(15,23,42,0.08)', background: '#F6F7F9' }}>
          {user.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={`${API_BASE}${user.avatarUrl}`} alt={user.name}
                 className="rounded-full object-cover flex-shrink-0" style={{ width: 28, height: 28 }} />
          ) : (
            <div className="rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                 style={{ width: 28, height: 28, background: '#1447E6' }}>
              {user.initials || user.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="text-[13px] font-semibold text-gray-800 pr-1 hidden sm:block">
            {user.name.split(' ')[0]}
          </span>
          <span className="text-[10px] font-mono-jet px-1.5 py-0.5 rounded hidden sm:block"
                style={{ background: '#EFF1F4', color: '#8A94A2' }}>
            {user.role === 'presidente' ? 'PRES' : user.role === 'vereador' ? 'VER' : 'SEC'}
          </span>
        </div>
      )}
    </header>
  );
}
