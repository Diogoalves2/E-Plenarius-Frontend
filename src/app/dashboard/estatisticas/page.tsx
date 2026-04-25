'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart3, Users, CheckCircle2, XCircle, Calendar, Loader2, TrendingUp } from 'lucide-react';
import api from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';

interface Stats {
  sessions: { total: number; encerradas: number; emAndamento: number; agendadas: number; };
  votacoes: { aprovados: number; rejeitados: number; total: number; taxaAprovacao: number; };
  presenca: { media: number; };
  topPresenca: { name: string; initials: string; party: string | null; avatarUrl: string | null; count: number; }[];
  sessionsByMonth: { month: string; count: number; }[];
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

export default function EstatisticasPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.chamberId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/stats/chamber/${user.chamberId}`);
      setStats(data);
    } finally { setLoading(false); }
  }, [user?.chamberId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-8"><div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin" style={{ color: '#8A94A2' }} /></div></div>;
  if (!stats) return <div className="p-8 text-center text-gray-400">Sem dados disponíveis</div>;

  const maxMonth = Math.max(...stats.sessionsByMonth.map(s => s.count), 1);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="font-tight font-semibold text-2xl" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>
          Estatísticas
        </h2>
        <p className="text-sm mt-1" style={{ color: '#8A94A2' }}>Visão geral das atividades legislativas</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Calendar size={18} style={{ color: 'oklch(0.52 0.16 255)' }} />}
          label="Sessões realizadas"
          value={stats.sessions.encerradas}
          sub={`${stats.sessions.total} no total`}
          color="rgba(82,130,255,0.08)"
        />
        <StatCard
          icon={<CheckCircle2 size={18} style={{ color: '#059669' }} />}
          label="Taxa de aprovação"
          value={`${stats.votacoes.taxaAprovacao}%`}
          sub={`${stats.votacoes.aprovados} aprovados · ${stats.votacoes.rejeitados} reprovados`}
          color="rgba(16,185,129,0.08)"
        />
        <StatCard
          icon={<XCircle size={18} style={{ color: '#dc2626' }} />}
          label="Total de votações"
          value={stats.votacoes.total}
          sub={`${stats.votacoes.rejeitados} reprovad${stats.votacoes.rejeitados !== 1 ? 'os' : 'o'}`}
          color="rgba(239,68,68,0.08)"
        />
        <StatCard
          icon={<Users size={18} style={{ color: '#b45309' }} />}
          label="Média de presença"
          value={stats.presenca.media}
          sub="vereadores por sessão"
          color="rgba(245,158,11,0.08)"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Sessions by month */}
        <div className="bg-white rounded-xl p-6" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 size={16} style={{ color: '#8A94A2' }} />
            <h3 className="font-tight font-semibold text-sm" style={{ color: '#0B1220' }}>Sessões por mês</h3>
          </div>
          {stats.sessionsByMonth.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#8A94A2' }}>Nenhum dado disponível</p>
          ) : (
            <div className="flex items-end gap-2 h-32">
              {stats.sessionsByMonth.map(m => {
                const [year, month] = m.month.split('-');
                const pct = (m.count / maxMonth) * 100;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-mono-jet font-semibold" style={{ color: '#0B1220' }}>{m.count}</span>
                    <div className="w-full rounded-t-sm transition-all" style={{ height: `${Math.max(pct, 6)}%`, background: 'oklch(0.52 0.16 255)', minHeight: 4 }} />
                    <span className="text-[10px] font-mono-jet" style={{ color: '#8A94A2' }}>{MONTH_LABELS[month]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Session status breakdown */}
        <div className="bg-white rounded-xl p-6" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} style={{ color: '#8A94A2' }} />
            <h3 className="font-tight font-semibold text-sm" style={{ color: '#0B1220' }}>Distribuição de sessões</h3>
          </div>
          <div className="flex flex-col gap-3">
            <ProgressRow label="Encerradas" count={stats.sessions.encerradas} total={stats.sessions.total} color="#059669" />
            <ProgressRow label="Em andamento" count={stats.sessions.emAndamento} total={stats.sessions.total} color="oklch(0.52 0.16 255)" />
            <ProgressRow label="Agendadas" count={stats.sessions.agendadas} total={stats.sessions.total} color="#b45309" />
          </div>
          <div className="mt-5 pt-4 flex gap-4" style={{ borderTop: '1px solid rgba(15,23,42,0.06)' }}>
            <VoteBar label="Aprovados" count={stats.votacoes.aprovados} total={stats.votacoes.total} color="#059669" />
            <VoteBar label="Reprovados" count={stats.votacoes.rejeitados} total={stats.votacoes.total} color="#dc2626" />
          </div>
        </div>
      </div>

      {/* Top presença */}
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
        <div className="flex items-center gap-2 mb-5">
          <Users size={16} style={{ color: '#8A94A2' }} />
          <h3 className="font-tight font-semibold text-sm" style={{ color: '#0B1220' }}>Top 5 — Presença em sessões</h3>
        </div>
        {stats.topPresenca.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: '#8A94A2' }}>Nenhuma presença registrada</p>
        ) : (
          <div className="flex flex-col gap-3">
            {stats.topPresenca.map((v, i) => (
              <div key={v.name} className="flex items-center gap-3">
                <span className="font-mono-jet text-xs font-semibold w-5 text-center flex-shrink-0"
                      style={{ color: i === 0 ? '#b45309' : '#8A94A2' }}>
                  {i + 1}
                </span>
                <MemberAvatar name={v.name} initials={v.initials} avatarUrl={v.avatarUrl} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: '#0B1220' }}>{v.name}</p>
                  {v.party && <p className="text-xs" style={{ color: '#8A94A2' }}>{v.party}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,0.06)' }}>
                    <div className="h-full rounded-full"
                         style={{ width: `${(v.count / (stats.topPresenca[0]?.count || 1)) * 100}%`, background: 'oklch(0.52 0.16 255)' }} />
                  </div>
                  <span className="font-mono-jet text-xs font-semibold flex-shrink-0" style={{ color: '#0B1220', minWidth: 28, textAlign: 'right' }}>
                    {v.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-xl p-5" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: color }}>
        {icon}
      </div>
      <p className="font-tight font-semibold text-2xl" style={{ color: '#0B1220', letterSpacing: '-0.03em' }}>{value}</p>
      <p className="text-xs font-semibold mt-1" style={{ color: '#4B5563' }}>{label}</p>
      <p className="text-xs mt-0.5" style={{ color: '#8A94A2' }}>{sub}</p>
    </div>
  );
}

function ProgressRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold" style={{ color: '#4B5563' }}>{label}</span>
        <span className="font-mono-jet text-xs font-semibold" style={{ color: '#0B1220' }}>{count}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,0.06)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function VoteBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex-1 text-center">
      <p className="font-tight font-semibold text-xl" style={{ color, letterSpacing: '-0.02em' }}>{count}</p>
      <p className="text-xs font-semibold mt-0.5" style={{ color: '#4B5563' }}>{label}</p>
      <p className="font-mono-jet text-[10px]" style={{ color: '#8A94A2' }}>{pct}%</p>
    </div>
  );
}

function MemberAvatar({ name, initials, avatarUrl }: { name: string; initials: string; avatarUrl: string | null }) {
  if (avatarUrl) return (
    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${API_BASE}${avatarUrl}`} alt={name} className="w-full h-full object-cover" />
    </div>
  );
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
         style={{ background: 'oklch(0.52 0.16 255)' }}>
      {initials}
    </div>
  );
}
