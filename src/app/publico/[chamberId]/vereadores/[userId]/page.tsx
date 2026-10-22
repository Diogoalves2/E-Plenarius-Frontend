'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, ChevronRight } from 'lucide-react';
import { PublicShell, publicGet, PUBLIC_MEDIA, STATUS_PUB, CHOICE_PUB, ROLE_PUB, T } from '@/components/public/PublicShell';
import { Avatar, ChartCard, DataTable, Legend, StackedBar, StatTile, useTip } from '@/components/public/charts';

interface Perfil {
  id: string; name: string; party: string | null; role: string; title: string | null; avatarUrl: string | null; initials: string | null;
  sessoes: number; presencas: number; taxaPresenca: number | null;
  votos: { id: string; number: string; title: string; status: string; choice: string; votingClosedAt: string; sessionNumber: number }[];
  autorias: { id: string; number: string; type: string; title: string; status: string }[];
}
interface Resumo {
  votos: { sim: number; nao: number; abstencao: number; naoVotou: number; elegiveis: number };
  alinhamento: number | null; autorias: { total: number; aprovadas: number };
}

export default function PerfilVereadorPage() {
  const { chamberId, userId } = useParams<{ chamberId: string; userId: string }>();
  const [p, setP] = useState<Perfil | null>(null);
  const [r, setR] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);
  const tip = useTip();

  useEffect(() => {
    Promise.all([
      publicGet<Perfil>(`/public/chambers/${chamberId}/vereadores/${userId}`),
      publicGet<{ membros: (Resumo & { id: string })[] }>(`/public/chambers/${chamberId}/estatisticas`),
    ]).then(([perfil, est]) => {
      setP(perfil);
      setR(est?.membros.find(m => m.id === userId) ?? null);
      setLoading(false);
    });
  }, [chamberId, userId]);

  const v = r?.votos;
  const votou = v ? v.sim + v.nao + v.abstencao : 0;

  return (
    <PublicShell chamberId={chamberId} active="vereadores" title="Perfil do vereador"
                 subtitle="Presença, votos nominais e matérias de autoria.">
      <Link href={`/publico/${chamberId}/vereadores`} className="inline-flex items-center gap-1 text-sm mb-5 font-semibold" style={{ color: T.accent }}>
        <ArrowLeft size={14} /> Todos os vereadores
      </Link>
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={24} color={T.muted} /></div>
        : !p ? <p className="text-sm" style={{ color: T.muted }}>Vereador não encontrado.</p> : (
        <div ref={tip.box} className="relative flex flex-col gap-5">
          {tip.node}
          <div className="bg-white rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4" style={{ border: `1px solid ${T.hair}` }}>
            <Avatar src={p.avatarUrl ? `${PUBLIC_MEDIA}${p.avatarUrl}` : null} initials={p.initials} size={88} />
            <div className="flex-1 min-w-0">
              <p className="text-xl font-bold" style={{ color: T.ink }}>{p.name}</p>
              <p className="text-sm" style={{ color: T.muted }}>{[p.party, ROLE_PUB(p)].filter(Boolean).join(' · ')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label="Presença" value={p.taxaPresenca == null ? '—' : `${p.taxaPresenca}%`} hint={`${p.presencas} de ${p.sessoes} sessões`} />
            <StatTile label="Votou nas nominais" value={v ? `${votou}/${v.elegiveis}` : '—'} hint="votações abertas" />
            <StatTile label="Acompanhou o resultado" value={r?.alinhamento == null ? '—' : `${r.alinhamento}%`} hint="dos votos sim/não" />
            <StatTile label="Matérias de autoria" value={r?.autorias.total ?? p.autorias.length} hint={`${r?.autorias.aprovadas ?? 0} aprovada(s)`} />
          </div>

          {v && (
            <ChartCard title="Distribuição dos votos" subtitle="Votações abertas desde o início do mandato no sistema"
                       legend={<Legend items={[{ label: 'Sim', color: T.sim }, { label: 'Abstenção', color: T.abst }, { label: 'Não', color: T.nao }, { label: 'Não votou', color: T.ausente }]} />}
                       table={<DataTable head={['Voto', 'Quantidade']} rows={[['Sim', v.sim], ['Não', v.nao], ['Abstenção', v.abstencao], ['Não votou', v.naoVotou]]} />}>
              <StackedBar title="Votos" tip={tip} height={28} showLabels segs={[
                { key: 's', label: 'sim', value: v.sim, color: T.sim },
                { key: 'a', label: 'abstenção', value: v.abstencao, color: T.abst },
                { key: 'n', label: 'não', value: v.nao, color: T.nao },
                { key: 'x', label: 'não votou', value: v.naoVotou, color: T.ausente },
              ]} />
            </ChartCard>
          )}

          <section className="bg-white rounded-2xl p-4 sm:p-5" style={{ border: `1px solid ${T.hair}` }}>
            <h3 className="text-[15px] font-semibold">Votos nominais</h3>
            <p className="text-xs mt-0.5 mb-3" style={{ color: T.muted }}>Somente votações abertas. Em votação secreta o voto individual não é registrado.</p>
            {p.votos.length === 0 ? <p className="py-6 text-center text-sm" style={{ color: T.muted }}>Nenhum voto nominal registrado.</p> : (
              <div className="flex flex-col divide-y" style={{ borderColor: T.grid }}>
                {p.votos.map(x => (
                  <Link key={x.id} href={`/publico/${chamberId}/votacoes/${x.id}`} className="group flex items-center gap-3 py-3 px-1 -mx-1 rounded-lg hover:bg-slate-50">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHOICE_PUB[x.choice]?.color ?? T.abst }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: T.ink }}>{x.number} — {x.title}</p>
                      <p className="text-xs" style={{ color: T.muted }}>{x.sessionNumber}ª sessão · matéria {STATUS_PUB[x.status]?.label.toLowerCase() ?? x.status}</p>
                    </div>
                    <span className="text-sm font-semibold flex-shrink-0" style={{ color: T.ink }}>Votou {CHOICE_PUB[x.choice]?.label.toLowerCase() ?? x.choice}</span>
                    <ChevronRight size={15} color="#CBD5E1" className="flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl p-4 sm:p-5" style={{ border: `1px solid ${T.hair}` }}>
            <h3 className="text-[15px] font-semibold mb-3">Matérias de autoria</h3>
            {p.autorias.length === 0 ? <p className="py-6 text-center text-sm" style={{ color: T.muted }}>Nenhuma matéria registrada.</p> : (
              <div className="flex flex-col divide-y" style={{ borderColor: T.grid }}>
                {p.autorias.map(a => (
                  <div key={a.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: T.ink }}>{a.number} — {a.title}</p>
                      <p className="text-xs" style={{ color: T.muted }}>{a.type}</p>
                    </div>
                    {STATUS_PUB[a.status]
                      ? <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: STATUS_PUB[a.status].color, background: STATUS_PUB[a.status].bg }}>{STATUS_PUB[a.status].label}</span>
                      : <span className="text-xs px-2.5 py-1 rounded-full" style={{ color: T.ink2, background: '#F1F5F9' }}>Em tramitação</span>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </PublicShell>
  );
}
