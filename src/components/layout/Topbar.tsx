'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Menu, Landmark } from 'lucide-react';
import { useChamber } from '@/contexts/ChamberContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ?? 'http://localhost:3001';

export function Topbar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { user } = useAuth();
  const chamber = useChamber();

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

      {/* Câmara do usuário: logo + nome sempre visíveis (inclusive no tablet/celular, sem o menu lateral) */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center rounded-xl flex-shrink-0 overflow-hidden"
             style={{ width: 38, height: 38, background: '#F6F7F9', border: '1px solid rgba(15,23,42,0.08)' }}>
          {chamber?.logo
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={chamber.logo} alt={`Brasão da ${chamber.name}`} style={{ width: 32, height: 32, objectFit: 'contain' }} />
            : <Landmark size={18} color="#1447E6" />}
        </div>
        <div className="min-w-0 leading-tight">
          <p className="text-[14px] font-semibold truncate" style={{ color: '#0B1220', letterSpacing: '-0.01em' }}>
            {chamber?.name ?? ' '}
          </p>
          <p className="text-[11px] truncate" style={{ color: '#8A94A2' }}>
            {chamber ? `Poder Legislativo · ${chamber.city}/${chamber.state}` : ' '}
          </p>
        </div>
      </div>

      {/* Sessão: "ao vivo" só quando há sessão em andamento */}
      <div className="hidden sm:flex items-center gap-1.5 ml-auto px-2.5 py-1 rounded-full text-[11px] font-mono-jet font-semibold tracking-wider flex-shrink-0"
           style={chamber?.live
             ? { border: '1px solid #A7F3D0', background: '#ECFDF5', color: '#047857' }
             : { border: '1px solid rgba(15,23,42,0.08)', color: '#8A94A2' }}>
        <span className={`w-1.5 h-1.5 rounded-full ${chamber?.live ? 'animate-pulse-dot' : ''}`}
              style={{ background: chamber?.live ? '#10b981' : '#CBD5E1' }} />
        {chamber?.live ? 'SESSÃO AO VIVO' : 'SEM SESSÃO'}
      </div>
      <div className="sm:hidden ml-auto" />

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
                {user.role === 'presidente' ? 'PRES' : user.role === 'vice_presidente' ? 'VICE' : user.role === 'vereador' ? 'VER' : 'ADM'}
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
