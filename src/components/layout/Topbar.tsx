'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Menu } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';

export function Topbar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { user } = useAuth();

  return (
    <header className="flex items-center gap-3 px-6 h-14 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(15,23,42,0.08)', background: '#fff' }}>

      {/* Hamburger — mobile/tablet only */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ width: 40, height: 40, color: '#4B5563', background: '#F6F7F9', border: '1px solid rgba(15,23,42,0.08)' }}
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>

      {/* Live indicator */}
      <div className="flex items-center gap-1.5 ml-auto px-2.5 py-1 rounded-full text-[11px] font-mono-jet font-semibold tracking-wider flex-shrink-0"
           style={{ border: '1px solid rgba(15,23,42,0.08)', color: '#4B5563' }}>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: '#10b981' }} />
        AO VIVO
      </div>

      {/* Usuário (avatar + nome + email) */}
      {user && (
        <div className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
          {user.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={`${API_BASE}${user.avatarUrl}`} alt={user.name}
                 className="rounded-full object-cover flex-shrink-0" style={{ width: 32, height: 32 }} />
          ) : (
            <div className="rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                 style={{ width: 32, height: 32, background: '#1447E6' }}>
              {user.initials || user.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 leading-tight hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold truncate" style={{ color: '#0B1220', letterSpacing: '-0.01em' }}>
                {user.name}
              </span>
              <span className="text-[10px] font-mono-jet font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                {user.role === 'presidente' ? 'PRES' : user.role === 'vereador' ? 'VER' : 'SEC'}
              </span>
            </div>
            <p className="text-[11px] truncate" style={{ color: '#8A94A2' }}>
              {user.email}
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
