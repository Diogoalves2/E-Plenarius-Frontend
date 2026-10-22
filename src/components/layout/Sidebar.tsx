'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import {
  Radio, FileText, Users, Shield, Clock, Video, LogOut, Mic, BarChart3, BookOpen, X, Building2, Archive, Tablet, Scale, AudioLines, Globe, ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '@/lib/api';
import { useChamber } from '@/contexts/ChamberContext';

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
  const chamber = useChamber();
  const chamberName = chamber?.name ?? null;
  const [pendingDevices, setPendingDevices] = useState(0);

  useEffect(() => {
    if (!user?.chamberId) return;

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
  const canConduct = isPresidente || user?.role === 'vice_presidente';

  // Tablets aguardando aprovação (badge no menu)
  useEffect(() => {
    if (!user?.chamberId || !isPresidente) return;
    const load = () => api.get(`/devices/chamber/${user.chamberId}`)
      .then(({ data }) => setPendingDevices((data as any[]).filter(d => d.status === 'pendente').length))
      .catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [user?.chamberId, isPresidente]);

  const NAV_ITEMS = [
    {
      section: 'Sessão',
      items: [
        { href: '/dashboard',            icon: Radio,    label: 'Votação ao vivo',  badge: 'LIVE', badgeLive: true },
        { href: '/dashboard/pauta',      icon: FileText, label: 'Ordem do dia',     badge: agendaCount !== null ? String(agendaCount) : undefined },
        { href: '/dashboard/quorum',     icon: Users,    label: 'Quórum',           badge: presenceCount ?? undefined },
        { href: '/dashboard/expediente', icon: Mic,      label: 'Expediente' },
        ...(canConduct ? [{ href: '/dashboard/transmissao', icon: Video, label: 'Transmissão' }] : []),
      ],
    },
    {
      section: 'Câmara',
      items: [
        { href: '/dashboard/projetos',     icon: Archive,   label: 'Projetos Votados' },
        { href: '/dashboard/regimento',    icon: BookOpen,  label: 'Regimento Interno' },
        { href: '/dashboard/degravacao',   icon: AudioLines, label: 'Degravação' },
        ...(canConduct ? [{ href: '/dashboard/sessoes', icon: Clock, label: 'Sessões' }] : []),
        ...(isPresidente ? [
          { href: '/dashboard/vereadores', icon: Users,     label: 'Vereadores' },
          { href: '/dashboard/dispositivos', icon: Tablet,  label: 'Tablets', badge: pendingDevices ? String(pendingDevices) : undefined },
          { href: '/dashboard/configuracoes', icon: Scale,  label: 'Regras do regimento' },
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
      {/* ── Marca do sistema (a câmara fica em destaque no topo da página) ── */}
      <div className="flex items-center gap-3 flex-shrink-0"
           style={{ height: 56, padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Building2 size={22} color="#63A0FF" style={{ flexShrink: 0 }} />
        <div className="flex-1 min-w-0 leading-tight">
          <p className="font-tight font-semibold text-white text-sm" style={{ letterSpacing: '-0.01em' }}>E-Plenarius</p>
          <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>{chamberName ?? 'Painel legislativo'}</p>
        </div>
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
        {user?.chamberId && (
          <a href={`/publico/${user.chamberId}`} target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium"
             style={{ color: SIDEBAR_TEXT }}
             onMouseEnter={e => { e.currentTarget.style.background = HOVER_BG; e.currentTarget.style.color = '#fff'; }}
             onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = SIDEBAR_TEXT; }}>
            <Globe size={16} />
            <span className="flex-1">Portal público</span>
            <ExternalLink size={13} style={{ opacity: 0.6 }} />
          </a>
        )}
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
