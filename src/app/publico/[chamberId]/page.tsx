'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, ChevronRight, Loader2, Radio, History, CalendarClock } from 'lucide-react';
import { PublicShell, publicGet, T, dataPub } from '@/components/public/PublicShell';
import { StatTile } from '@/components/public/charts';

interface Session {
  id: string; number: number; type: string; date: string;
  status: 'agendada' | 'em_andamento' | 'encerrada';
  startedAt: string | null; endedAt: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  ordinaria: 'Ordinária', extraordinaria: 'Extraordinária', solene: 'Solene', especial: 'Especial',
};

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  agendada:     { label: 'Agendada',     color: '#92400e', bg: 'rgba(234,179,8,0.12)' },
  em_andamento: { label: 'Ao vivo',      color: '#047857', bg: 'rgba(5,150,105,0.1)' },
  encerrada:    { label: 'Encerrada',    color: T.ink2,    bg: '#F1F5F9' },
};

export default function PublicoPage() {
  const { chamberId } = useParams<{ chamberId: string }>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [totais, setTotais] = useState<{ votacoes: number; aprovadas: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      publicGet<Session[]>(`/sessions/chamber/${chamberId}`),
      publicGet<any>(`/public/chambers/${chamberId}/estatisticas`),
    ]).then(([s, e]) => {
      setSessions(s ?? []);
      setTotais(e?.totais ?? null);
      setLoading(false);
    });
  }, [chamberId]);

  const ativa = sessions.find(s => s.status === 'em_andamento');
  const encerradas = sessions.filter(s => s.status === 'encerrada').sort((a, b) => b.date.localeCompare(a.date));
  const agendadas = sessions.filter(s => s.status === 'agendada').sort((a, b) => a.date.localeCompare(b.date));

  return (
    <PublicShell chamberId={chamberId} active="sessoes" title="Sessões plenárias"
                 subtitle="Acompanhe as sessões ao vivo, a pauta, a presença e os resultados de cada reunião.">
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={24} color={T.muted} /></div> : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label="Sessões realizadas" value={encerradas.length} />
            <StatTile label="Próximas sessões" value={agendadas.length} />
            <StatTile label="Matérias votadas" value={totais?.votacoes ?? 0} />
            <StatTile label="Matérias aprovadas" value={totais?.aprovadas ?? 0} accent={T.sim} />
          </div>

          {ativa && (
            <Link href={`/publico/${chamberId}/sessao/${ativa.id}`}
                  className="block rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #065f46, #047857)' }}>
              <div className="flex items-center gap-2 text-xs font-bold tracking-wide">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> <Radio size={14} /> AO VIVO AGORA
              </div>
              <p className="text-xl font-bold mt-2">{ativa.number}ª Sessão {TYPE_LABEL[ativa.type] ?? ativa.type}</p>
              <p className="text-sm opacity-90 mt-0.5">Acompanhe a pauta, a presença e os resultados em tempo real →</p>
            </Link>
          )}

          {agendadas.length > 0 && (
            <SessionList icon={<CalendarClock size={16} />} title="Próximas sessões" sessions={agendadas} chamberId={chamberId} />
          )}

          {encerradas.length > 0 && (
            <SessionList icon={<History size={16} />} title="Histórico" sessions={encerradas} chamberId={chamberId} />
          )}

          {sessions.length === 0 && (
            <div className="bg-white rounded-2xl py-16 text-center" style={{ border: `1px solid ${T.hair}` }}>
              <CalendarDays size={36} className="mx-auto mb-3" color="#CBD5E1" />
              <p className="font-semibold">Nenhuma sessão cadastrada ainda</p>
            </div>
          )}
        </div>
      )}
    </PublicShell>
  );
}

function SessionList({ icon, title, sessions, chamberId }: { icon: React.ReactNode; title: string; sessions: Session[]; chamberId: string }) {
  return (
    <section className="bg-white rounded-2xl p-4 sm:p-5" style={{ border: `1px solid ${T.hair}` }}>
      <h3 className="flex items-center gap-2 text-[15px] font-semibold mb-3" style={{ color: T.ink }}>
        <span style={{ color: T.accent }}>{icon}</span> {title}
        <span className="font-normal" style={{ color: T.muted }}>({sessions.length})</span>
      </h3>
      <div className="flex flex-col divide-y" style={{ borderColor: T.grid }}>
        {sessions.map(s => {
          const st = STATUS_STYLE[s.status];
          const d = new Date(s.date + 'T00:00:00');
          return (
            <Link key={s.id} href={`/publico/${chamberId}/sessao/${s.id}`}
                  className="group flex items-center gap-4 py-3 px-1 -mx-1 rounded-lg hover:bg-slate-50">
              <div className="flex-shrink-0 w-12 text-center rounded-xl py-1.5" style={{ background: '#EEF2FF' }}>
                <p className="text-[10px] font-bold uppercase" style={{ color: T.accent }}>{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</p>
                <p className="text-lg font-bold leading-none" style={{ color: T.ink }}>{d.getDate()}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: T.ink }}>{s.number}ª Sessão {TYPE_LABEL[s.type] ?? s.type}</p>
                <p className="text-xs" style={{ color: T.muted }}>
                  {dataPub(s.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: st.bg, color: st.color }}>{st.label}</span>
              <ChevronRight size={16} color="#CBD5E1" className="flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
