'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Users } from 'lucide-react';
import { PublicShell, publicGet, PUBLIC_MEDIA, ROLE_PUB, T } from '@/components/public/PublicShell';
import { Avatar, Legend, StackedBar, useTip } from '@/components/public/charts';

interface Membro {
  id: string; name: string; party: string | null; role: string; title: string | null; avatarUrl: string | null; initials: string | null;
  sessoes: number; presencas: number; taxaPresenca: number | null;
  votos: { sim: number; nao: number; abstencao: number; naoVotou: number; elegiveis: number };
  alinhamento: number | null; autorias: { total: number; aprovadas: number };
}

export default function VereadoresPublicoPage() {
  const { chamberId } = useParams<{ chamberId: string }>();
  const [membros, setMembros] = useState<Membro[] | null>(null);
  const [loading, setLoading] = useState(true);
  const tip = useTip();

  useEffect(() => {
    publicGet<{ membros: Membro[] }>(`/public/chambers/${chamberId}/estatisticas`).then(d => { setMembros(d?.membros ?? null); setLoading(false); });
  }, [chamberId]);

  return (
    <PublicShell chamberId={chamberId} active="vereadores" title="Vereadores"
                 subtitle="Composição da Casa, presença nas sessões e participação nas votações nominais.">
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={24} color={T.muted} /></div>
        : !membros?.length ? (
          <div className="bg-white rounded-2xl py-16 text-center" style={{ border: `1px solid ${T.hair}` }}>
            <Users size={36} className="mx-auto mb-3" color="#CBD5E1" />
            <p className="font-semibold">Nenhum vereador cadastrado</p>
          </div>
        ) : (
        <div ref={tip.box} className="relative">
          {tip.node}
          <div className="mb-4">
            <Legend items={[{ label: 'Sim', color: T.sim }, { label: 'Abstenção', color: T.abst }, { label: 'Não', color: T.nao }, { label: 'Não votou', color: T.ausente }]} />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {membros.map(m => {
              const votou = m.votos.sim + m.votos.nao + m.votos.abstencao;
              return (
                <Link key={m.id} href={`/publico/${chamberId}/vereadores/${m.id}`}
                      className="bg-white rounded-2xl p-5 flex flex-col gap-4 hover:shadow-md transition-shadow"
                      style={{ border: `1px solid ${T.hair}` }}>
                  <div className="flex items-center gap-3">
                    <Avatar src={m.avatarUrl ? `${PUBLIC_MEDIA}${m.avatarUrl}` : null} initials={m.initials} size={56} />
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight" style={{ color: T.ink }}>{m.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: T.muted }}>{[m.party, ROLE_PUB(m)].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between text-xs mb-1.5">
                      <span style={{ color: T.muted }}>Presença</span>
                      <span style={{ color: T.ink2 }}><b className="text-sm" style={{ color: T.ink }}>{m.taxaPresenca == null ? '—' : `${m.taxaPresenca}%`}</b> · {m.presencas}/{m.sessoes} sessões</span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: '#E0E7FF' }}>
                      <div className="h-2 rounded-full" style={{ width: `${m.taxaPresenca ?? 0}%`, background: T.accent }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between text-xs mb-1.5">
                      <span style={{ color: T.muted }}>Votações nominais</span>
                      <span style={{ color: T.ink2 }}>{votou} de {m.votos.elegiveis}</span>
                    </div>
                    <StackedBar title={m.name} tip={tip} height={8} focusable={false} segs={[
                      { key: 's', label: 'sim', value: m.votos.sim, color: T.sim },
                      { key: 'a', label: 'abstenção', value: m.votos.abstencao, color: T.abst },
                      { key: 'n', label: 'não', value: m.votos.nao, color: T.nao },
                      { key: 'x', label: 'não votou', value: m.votos.naoVotou, color: T.ausente },
                    ]} />
                    <p className="text-xs mt-1.5" style={{ color: T.ink2, fontVariantNumeric: 'tabular-nums' }}>
                      <b>{m.votos.sim}</b> sim · <b>{m.votos.nao}</b> não · <b>{m.votos.abstencao}</b> abst.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-3 mt-auto" style={{ borderTop: `1px solid ${T.grid}` }}>
                    <div>
                      <p className="text-base font-bold" style={{ color: T.ink }}>{m.alinhamento == null ? '—' : `${m.alinhamento}%`}</p>
                      <p className="text-[11px]" style={{ color: T.muted }}>acompanhou o resultado</p>
                    </div>
                    <div>
                      <p className="text-base font-bold" style={{ color: T.ink }}>{m.autorias.total}</p>
                      <p className="text-[11px]" style={{ color: T.muted }}>matéria(s) de autoria · {m.autorias.aprovadas} aprovada(s)</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </PublicShell>
  );
}
