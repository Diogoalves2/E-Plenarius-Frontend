'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, ShieldCheck, ShieldAlert, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { PublicShell, publicGet, PUBLIC_MEDIA, CHOICE_PUB, T, dataPub } from '@/components/public/PublicShell';
import { ChartCard, DataTable, Legend, StackedBar, useTip } from '@/components/public/charts';

interface Detalhe {
  id: string; number: string; type: string; title: string; description: string | null; pdfUrl: string | null; author: string;
  sessionId: string; sessionNumber: number; sessionDate: string; votingType: string; majorityLabel: string; status: string; closedAt: string;
  counts: { sim: number; nao: number; abstencao: number }; requiredVotes: number | null; explanation: string | null; resultHash: string | null;
  nominal: { id: string; name: string; party: string | null; choice: string }[] | null;
  verificacao: { valid: boolean; totalVotes: number; problems: string[] };
}

export default function VotacaoPublicaPage() {
  const { chamberId, itemId } = useParams<{ chamberId: string; itemId: string }>();
  const [v, setV] = useState<Detalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const tip = useTip();

  useEffect(() => {
    publicGet<Detalhe>(`/public/votacoes/${itemId}`).then(d => { setV(d); setLoading(false); });
  }, [itemId]);

  const aprovado = v?.status === 'aprovado';
  const total = v ? v.counts.sim + v.counts.nao + v.counts.abstencao : 0;

  return (
    <PublicShell chamberId={chamberId} active="votacoes" title={v ? `${v.type} ${v.number}` : 'Votação'}>
      <Link href={`/publico/${chamberId}/votacoes`} className="inline-flex items-center gap-1 text-sm mb-5 font-semibold" style={{ color: T.accent }}>
        <ArrowLeft size={14} /> Todas as votações
      </Link>
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={24} color={T.muted} /></div>
        : !v ? <p className="text-sm" style={{ color: T.muted }}>Votação não encontrada ou ainda não encerrada.</p> : (
        <div ref={tip.box} className="relative flex flex-col gap-5">
          {tip.node}
          <section className="bg-white rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.hair}` }}>
            <div className="px-5 py-4 flex items-center gap-3" style={{ background: aprovado ? 'rgba(5,150,105,0.07)' : 'rgba(220,38,38,0.06)' }}>
              {aprovado ? <CheckCircle2 size={28} color={T.sim} /> : <XCircle size={28} color={T.nao} />}
              <div>
                <p className="text-lg font-bold" style={{ color: aprovado ? '#047857' : '#b91c1c' }}>{aprovado ? 'Aprovado' : 'Rejeitado'}</p>
                <p className="text-xs" style={{ color: T.ink2 }}>
                  {v.majorityLabel} · votação {v.votingType}{v.requiredVotes ? ` · exigia ${v.requiredVotes} voto(s) sim` : ''}
                </p>
              </div>
            </div>
            <div className="p-5">
              <p className="text-xs" style={{ color: T.muted }}>
                {[`${v.sessionNumber}ª sessão`, dataPub(v.sessionDate), v.author && `Autoria: ${v.author}`].filter(Boolean).join(' · ')}
              </p>
              <h3 className="text-lg font-semibold mt-1 leading-snug" style={{ color: T.ink }}>{v.title}</h3>
              {v.description && <p className="text-sm mt-2 leading-relaxed" style={{ color: T.ink2 }}>{v.description}</p>}
              {v.pdfUrl && (
                <a href={`${PUBLIC_MEDIA}${v.pdfUrl}`} target="_blank" rel="noreferrer"
                   className="inline-flex items-center gap-1.5 text-sm mt-3 font-semibold" style={{ color: T.accent }}>
                  <FileText size={15} /> Texto da matéria (PDF)
                </a>
              )}
            </div>
          </section>

          <ChartCard title="Placar" subtitle={`${total} voto(s) registrado(s)`}
                     legend={<Legend items={[{ label: 'Sim', color: T.sim }, { label: 'Abstenção', color: T.abst }, { label: 'Não', color: T.nao }]} />}
                     table={<DataTable head={['Voto', 'Quantidade']} rows={[['Sim', v.counts.sim], ['Não', v.counts.nao], ['Abstenção', v.counts.abstencao]]} />}>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {(['sim', 'nao', 'abstencao'] as const).map(c => (
                <div key={c} className="rounded-xl p-3 text-center" style={{ background: '#F8FAFC', border: `1px solid ${T.grid}` }}>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: CHOICE_PUB[c].color }} />
                    <span className="text-xs font-medium" style={{ color: T.muted }}>{CHOICE_PUB[c].label}</span>
                  </div>
                  <p className="text-3xl font-bold mt-1" style={{ color: T.ink }}>{v.counts[c]}</p>
                </div>
              ))}
            </div>
            <StackedBar title="Placar" tip={tip} height={14} segs={[
              { key: 's', label: 'sim', value: v.counts.sim, color: T.sim },
              { key: 'a', label: 'abstenção', value: v.counts.abstencao, color: T.abst },
              { key: 'n', label: 'não', value: v.counts.nao, color: T.nao },
            ]} />
            {v.explanation && <p className="text-sm mt-4" style={{ color: T.ink2 }}>{v.explanation}</p>}
          </ChartCard>

          {v.nominal ? (
            <section className="bg-white rounded-2xl p-4 sm:p-5" style={{ border: `1px solid ${T.hair}` }}>
              <h3 className="text-[15px] font-semibold mb-4">Como cada vereador votou</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {(['sim', 'nao', 'abstencao'] as const).map(c => {
                  const grupo = v.nominal!.filter(n => n.choice === c);
                  return (
                    <div key={c}>
                      <p className="flex items-center gap-2 text-xs font-semibold mb-2 pb-2" style={{ color: T.ink2, borderBottom: `2px solid ${CHOICE_PUB[c].color}` }}>
                        {CHOICE_PUB[c].label} <span style={{ color: T.muted }}>({grupo.length})</span>
                      </p>
                      {grupo.length === 0 ? <p className="text-xs" style={{ color: T.muted }}>Ninguém</p> : grupo.map(n => (
                        <Link key={n.id} href={`/publico/${chamberId}/vereadores/${n.id}`} className="block text-sm py-1.5 hover:underline" style={{ color: T.ink }}>
                          {n.name}{n.party && <span style={{ color: T.muted }}> · {n.party}</span>}
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <p className="text-sm px-1" style={{ color: T.muted }}>Votação secreta: o voto individual não é registrado pelo sistema, apenas o placar.</p>
          )}

          <section className="rounded-2xl p-4 sm:p-5" style={{
            background: v.verificacao.valid ? 'rgba(5,150,105,0.05)' : 'rgba(220,38,38,0.05)',
            border: `1px solid ${v.verificacao.valid ? 'rgba(5,150,105,0.25)' : 'rgba(220,38,38,0.25)'}`,
          }}>
            <p className="text-sm font-bold flex items-center gap-2" style={{ color: v.verificacao.valid ? '#047857' : '#b91c1c' }}>
              {v.verificacao.valid ? <ShieldCheck size={17} /> : <ShieldAlert size={17} />}
              {v.verificacao.valid ? 'Resultado verificado: íntegro' : 'Atenção: inconsistência detectada'}
            </p>
            <p className="text-xs mt-1" style={{ color: T.ink2 }}>
              O sistema recalculou agora a cadeia de {v.verificacao.totalVotes} voto(s), o placar e o selo do resultado.
            </p>
            {!v.verificacao.valid && (
              <ul className="text-xs mt-2 list-disc pl-5" style={{ color: '#b91c1c' }}>
                {v.verificacao.problems.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            )}
            {v.resultHash && <p className="text-[11px] mt-2 font-mono break-all" style={{ color: T.muted }}>Hash do resultado: {v.resultHash}</p>}
            <Link href={`/ata/${v.sessionId}`} className="inline-block text-xs mt-2 font-semibold" style={{ color: T.accent }}>Ver ata da sessão →</Link>
          </section>
        </div>
      )}
    </PublicShell>
  );
}
