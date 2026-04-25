'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import {
  Radio, FileText, Users, Shield, Clock, Video, LogOut, Mic, BarChart3, BookOpen, X,
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '@/lib/api';

interface ActiveSession {
  id: string;
  number: number;
  type: string;
  scheduledAt: string | null;
  startedAt: string | null;
}

const TYPE_LABEL: Record<string, string> = { ordinaria: 'Ordinária', extraordinaria: 'Extraordinária', solene: 'Solene' };

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [agendaCount, setAgendaCount] = useState<number | null>(null);
  const [presenceCount, setPresenceCount] = useState<string | null>(null);

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

  const NAV_ITEMS = [
    {
      section: 'Sessão em andamento',
      items: [
        { href: '/dashboard', icon: Radio, label: 'Votação ao vivo', badge: 'LIVE', badgeLive: true },
        { href: '/dashboard/pauta', icon: FileText, label: 'Ordem do dia', badge: agendaCount !== null ? String(agendaCount) : undefined },
        { href: '/dashboard/quorum', icon: Users, label: 'Quórum', badge: presenceCount ?? undefined },
        { href: '/dashboard/expediente', icon: Mic, label: 'Expediente' },
        ...(isPresidente ? [{ href: '/dashboard/transmissao', icon: Video, label: 'Transmissão' }] : []),
      ],
    },
    {
      section: 'Câmara',
      items: [
        { href: '/dashboard/regimento', icon: BookOpen, label: 'Regimento Interno' },
        ...(isPresidente ? [
          { href: '/dashboard/sessoes', icon: Clock, label: 'Sessões' },
          { href: '/dashboard/vereadores', icon: Users, label: 'Vereadores' },
        ] : []),
        { href: '/dashboard/estatisticas', icon: BarChart3, label: 'Estatísticas' },
        { href: '/dashboard/auditoria', icon: Shield, label: 'Auditoria' },
      ],
    },
  ];

  return (
    <nav
      className={clsx(
        'flex flex-col overflow-y-auto',
        // Mobile/tablet: drawer fixo abaixo do topbar (top-14 = 56px = altura do Topbar)
        'fixed top-14 bottom-0 left-0 z-30',
        'transition-transform duration-200 ease-in-out',
        // Desktop: parte do layout normal (sem posicionamento fixo)
        'lg:relative lg:top-0 lg:bottom-auto lg:left-auto lg:z-auto lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
      style={{
        width: 240,
        borderRight: '1px solid rgba(15,23,42,0.08)',
        background: '#fff',
        padding: '12px 10px 16px',
        flexShrink: 0,
      }}
    >
      {/* Botão fechar — apenas mobile/tablet */}
      <div className="flex items-center justify-between px-1 mb-2 lg:hidden">
        <span className="text-[10px] font-mono-jet tracking-widest" style={{ color: '#8A94A2', letterSpacing: '0.1em' }}>MENU</span>
        <button
          onClick={onClose}
          className="flex items-center justify-center rounded-lg"
          style={{ width: 32, height: 32, color: '#8A94A2' }}
          aria-label="Fechar menu"
        >
          <X size={16} />
        </button>
      </div>

      {NAV_ITEMS.map((group) => (
        <div key={group.section}>
          <p className="font-mono-jet text-[10px] px-2.5 py-2 mb-1 mt-2 first:mt-0"
             style={{ color: '#8A94A2', letterSpacing: '0.08em' }}>
            {group.section.toUpperCase()}
          </p>
          {group.items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={clsx(
                  'flex items-center gap-2.5 px-2.5 rounded-xl text-sm font-medium mb-0.5 transition-colors',
                  active ? 'bg-gray-100 text-gray-900 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
                )}
                style={{ minHeight: 44 }}
              >
                <item.icon size={16} />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className={clsx('text-[10px] font-semibold font-mono-jet px-1.5 py-0.5 rounded', item.badgeLive ? 'text-white' : 'text-gray-400 bg-gray-100')}
                        style={item.badgeLive ? { background: 'oklch(0.52 0.16 255)' } : {}}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="mt-auto pt-3">
        {/* Card sessão ativa */}
        <div className="rounded-xl p-3 mb-2 text-xs" style={{ background: '#F6F7F9', border: '1px solid rgba(15,23,42,0.08)' }}>
          <p className="font-mono-jet text-[10px] mb-1 flex items-center gap-1.5" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>
            {activeSession ? (
              <><span className="w-1.5 h-1.5 rounded-full animate-pulse-dot inline-block" style={{ background: '#10b981' }} /> SESSÃO ATIVA</>
            ) : 'SEM SESSÃO'}
          </p>
          {activeSession ? (
            <>
              <p className="font-semibold text-gray-800">{activeSession.number}ª Sessão {TYPE_LABEL[activeSession.type] ?? activeSession.type}</p>
              <p className="text-gray-500 mt-0.5">
                {activeSession.startedAt
                  ? `Iniciada às ${new Date(activeSession.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                  : '—'}
              </p>
            </>
          ) : (
            <p className="text-gray-400">Nenhuma sessão ativa</p>
          )}
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-red-500 transition-colors"
          style={{ minHeight: 44 }}
        >
          <LogOut size={15} />
          <span className="flex-1 text-left">Sair</span>
        </button>
      </div>
    </nav>
  );
}
