'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import {
  Radio, FileText, Users, Shield, Clock, Video, LogOut, Mic, BarChart3, BookOpen, X, Building2,
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '@/lib/api';

const API_BASE     = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';
const SIDEBAR_BG   = 'radial-gradient(120% 90% at 40% 30%, rgb(26,26,26) 0%, rgb(13,13,13) 50%, rgb(0,0,0) 100%)';
const SIDEBAR_TEXT = 'rgba(255,255,255,0.65)';
const ACTIVE_BG    = 'rgba(99,160,255,0.18)';
const ACTIVE_TEXT  = '#FFFFFF';
const HOVER_BG     = 'rgba(255,255,255,0.06)';

interface ActiveSession {
  id: string;
  number: number;
  type: string;
  startedAt: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  ordinaria: 'Ordinária',
  extraordinaria: 'Extraordinária',
  solene: 'Solene',
};

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [agendaCount, setAgendaCount]     = useState<number | null>(null);
  const [presenceCount, setPresenceCount] = useState<string | null>(null);
  const [chamberLogo, setChamberLogo]     = useState<string | null>(null);
  const [chamberName, setChamberName]     = useState<string | null>(null);

  useEffect(() => {
    if (!user?.chamberId) return;

    api.get(`/chambers/${user.chamberId}`)
      .then(({ data }) => {
        setChamberName(data.name);
        if (data.logoUrl) setChamberLogo(`${API_BASE}${data.logoUrl}`);
      })
      .catch(() => {});

    api.get(`/sessions/active/${user.chamberId}`)
      .then(async ({ data }) => {
        if (!data?.id) { setActiveSession(null); return; }
        setActiveSession(data);
        const [agendaRes, presRes] = await Promise.allSettled([
          api.get(`/agenda/session/${data.id}`),
          api.get(`/sessions/${data.id}/presences`),
        ]);
        if (agendaRes.status === 'fulfilled') setAgendaCount(agendaRes.value.data.length);
        if (presRes.status === 'fulfilled') setPresenceCount(String(presRes.value.data.length));
      })
      .catch(() => setActiveSession(null));
  }, [user?.chamberId]);

  const isPresidente = user?.role === 'presidente' || user?.role === 'superadmin';

  const NAV_ITEMS = [
    {
      section: 'Sessão',
      items: [
        { href: '/dashboard',            icon: Radio,    label: 'Votação ao vivo',  badge: 'LIVE', badgeLive: true },
        { href: '/dashboard/pauta',      icon: FileText, label: 'Ordem do dia',     badge: agendaCount !== null ? String(agendaCount) : undefined },
        { href: '/dashboard/quorum',     icon: Users,    label: 'Quórum',           badge: presenceCount ?? undefined },
        { href: '/dashboard/expediente', icon: Mic,      label: 'Expediente' },
        ...(isPresidente ? [{ href: '/dashboard/transmissao', icon: Video, label: 'Transmissão' }] : []),
      ],
    },
    {
      section: 'Câmara',
      items: [
        { href: '/dashboard/regimento',    icon: BookOpen,  label: 'Regimento Interno' },
        ...(isPresidente ? [
          { href: '/dashboard/sessoes',    icon: Clock,     label: 'Sessões' },
          { href: '/dashboard/vereadores', icon: Users,     label: 'Vereadores' },
        ] : []),
        { href: '/dashboard/estatisticas', icon: BarChart3, label: 'Estatísticas' },
        { href: '/dashboard/auditoria',    icon: Shield,    label: 'Auditoria' },
      ],
    },
  ];

  return (
    <aside
      className={clsx(
        'fixed top-0 bottom-0 left-0 z-30 overflow-y-auto',
        'transition-transform duration-200 ease-in-out',
        'lg:relative lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
      style={{ width: 272, background: SIDEBAR_BG, flexShrink: 0 }}
    >
      {/* ── Logo + nome da câmara ── */}
      <div className="flex items-center gap-3 flex-shrink-0"
           style={{ height: 56, padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {chamberLogo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={chamberLogo} alt="Logo" style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} />
        ) : (
          <Building2 size={26} color="#63A0FF" style={{ flexShrink: 0 }} />
        )}
        <span className="font-tight font-semibold text-white text-sm leading-tight truncate flex-1"
              style={{ letterSpacing: '-0.01em' }}>
          {chamberName ?? '…'}
        </span>
        <button onClick={onClose} className="lg:hidden flex-shrink-0" style={{ color: SIDEBAR_TEXT }} aria-label="Fechar menu">
          <X size={16} />
        </button>
      </div>

      {/* ── Navegação ── */}
      <div style={{ padding: '12px' }}>
        {NAV_ITEMS.map((group) => (
          <div key={group.section} style={{ marginBottom: 8 }}>
            <p className="font-mono-jet text-[10px]"
               style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', padding: '8px 12px 4px' }}>
              {group.section.toUpperCase()}
            </p>
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-0.5"
                  style={{ background: active ? ACTIVE_BG : 'transparent', color: active ? ACTIVE_TEXT : SIDEBAR_TEXT }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = HOVER_BG; e.currentTarget.style.color = '#fff'; } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = SIDEBAR_TEXT; } }}
                >
                  <item.icon size={16} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] font-semibold font-mono-jet px-1.5 py-0.5 rounded"
                          style={item.badgeLive
                            ? { background: '#1447E6', color: '#fff' }
                            : { background: 'rgba(255,255,255,0.1)', color: SIDEBAR_TEXT }}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Rodapé ── */}
      <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 8 }}>
        <div className="rounded-lg p-3 mb-3 text-xs"
             style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="font-mono-jet text-[10px] mb-1.5 flex items-center gap-1.5"
             style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em' }}>
            {activeSession
              ? <><span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: '#10b981' }} />SESSÃO ATIVA</>
              : 'SEM SESSÃO'}
          </p>
          {activeSession ? (
            <>
              <p className="font-semibold text-white">
                {activeSession.number}ª Sessão {TYPE_LABEL[activeSession.type] ?? activeSession.type}
              </p>
              <p className="mt-0.5" style={{ color: SIDEBAR_TEXT }}>
                {activeSession.startedAt
                  ? `Iniciada às ${new Date(activeSession.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                  : '—'}
              </p>
            </>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.25)' }}>Nenhuma sessão ativa</p>
          )}
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium"
          style={{ color: SIDEBAR_TEXT }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#fca5a5'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = SIDEBAR_TEXT; }}
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  );
}
