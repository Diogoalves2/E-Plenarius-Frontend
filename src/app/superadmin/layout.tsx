'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Settings, LogOut, LayoutDashboard } from 'lucide-react';

const NAV = [
  { label: 'Visão Geral',    href: '/superadmin',              icon: LayoutDashboard, exact: true },
  { label: 'Câmaras',        href: '/superadmin/camaras',      icon: Building2,       exact: false },
  { label: 'Configurações',  href: '/superadmin/configuracoes', icon: Settings,       exact: false },
];

const SIDEBAR_BG   = 'radial-gradient(120% 90% at 40% 30%, rgb(26, 26, 26) 0%, rgb(13, 13, 13) 50%, rgb(0, 0, 0) 100%)';
const SIDEBAR_TEXT = 'rgba(255,255,255,0.65)';
const ACTIVE_BG    = 'rgba(99,160,255,0.18)';
const ACTIVE_TEXT  = '#FFFFFF';
const HOVER_BG     = 'rgba(255,255,255,0.06)';

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'superadmin') router.push('/dashboard');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F6F7F9' }}>
        <div className="text-sm font-mono-jet" style={{ color: '#8A94A2' }}>Carregando…</div>
      </div>
    );
  }

  function isActive(item: typeof NAV[0]) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F6F7F9' }}>
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col h-full" style={{ background: SIDEBAR_BG }}>
        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 px-5 flex-shrink-0"
             style={{ borderBottom: 'rgba(255,255,255,0.08) 1px solid' }}>
          <Brasao size={26} color="#63A0FF" />
          <div>
            <div className="font-tight font-semibold text-sm leading-none text-white">E-Plenarius</div>
            <div className="font-mono-jet text-[10px] font-semibold mt-0.5" style={{ color: '#63A0FF' }}>SUPERADMIN</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = isActive(item);
            return (
              <Link key={item.href} href={item.href}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: active ? ACTIVE_BG : 'transparent', color: active ? ACTIVE_TEXT : SIDEBAR_TEXT }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = HOVER_BG; e.currentTarget.style.color = '#fff'; } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = SIDEBAR_TEXT; } }}>
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User / Logout */}
        <div className="px-3 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-semibold truncate text-white">{user.name}</p>
            <p className="text-xs truncate mt-0.5" style={{ color: SIDEBAR_TEXT }}>{user.email}</p>
          </div>
          <button onClick={logout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ color: SIDEBAR_TEXT }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#fca5a5'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = SIDEBAR_TEXT; }}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 flex-shrink-0 flex items-center justify-between px-6 bg-white"
                style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
          <h1 className="font-tight font-semibold text-sm" style={{ color: '#0B1220' }}>
            {NAV.find(n => isActive(n))?.label ?? 'Painel'}
          </h1>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function Brasao({ size = 40, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="40" cy="40" r="38" stroke={color} strokeWidth="1.5" />
      <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="0.9" strokeDasharray="2 3" opacity="0.5" />
      <path d="M40 18 L44.5 32 L59 32 L47.2 40.5 L51.8 54.5 L40 46 L28.2 54.5 L32.8 40.5 L21 32 L35.5 32 Z" fill={color} opacity="0.92" />
      <path d="M14 56 L66 56" stroke={color} strokeWidth="1.2" opacity="0.6" />
      <text x="40" y="68" textAnchor="middle" fontSize="8" fontFamily="Inter Tight, sans-serif" fontWeight="700" fill={color} letterSpacing="2">VA</text>
    </svg>
  );
}
