'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Download, Search, ChevronRight, Vote, FileSpreadsheet } from 'lucide-react';
import { PublicShell, publicGet, PUBLIC_API, PUBLIC_MEDIA, STATUS_PUB, ROLE_PUB, T, dataPub } from '@/components/public/PublicShell';
import {
  useTip, StatTile, Legend, ChartCard, DataTable, StackedBar, MonthlyColumns, fillMonths, monthLabel, Avatar,
} from '@/components/public/charts';

interface Votacao {
  id: string; number: string; type: string; title: string; authorName: string; votingType: string; majority: string;
  status: string; votesYes: number; votesNo: number; votesAbstain: number; votingClosedAt: string;
  sessionNumber: number; sessionDate: string;
}
interface Membro {
  id: string; name: string; party: string | null; role: string; title: string | null; avatarUrl: string | null; initials: string | null;
  taxaPresenca: number | null; presencas: number; sessoes: number;
  votos: { sim: number; nao: number; abstencao: number; naoVotou: number; elegiveis: number };
  alinhamento: number | null; autorias: { total: number; aprovadas: number };
}
interface Estatisticas {
  totais: { votacoes: number; aprovadas: number; rejeitadas: number; nominais: number; secretas: number; sessoes: number };
  porMes: { mes: string; aprovadas: number; rejeitadas: number }[];
  porTipo: { tipo: string; aprovadas: number; rejeitadas: number }[];
  membros: Membro[];
}

const MAJ: Record<string, string> = { simples: 'Maioria simples', absoluta: 'Maioria absoluta', dois_tercos: 'Dois terços' };
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—');

const VOTE_LEGEND = [
  { label: 'Sim', color: T.sim }, { label: 'Abstenção', color: T.abst },
  { label: 'Não', color: T.nao }, { label: 'Não votou', color: T.ausente },
];
const RESULT_LEGEND = [{ label: 'Aprovadas', color: T.sim }, { label: 'Rejeitadas', color: T.nao }];

export default function VotacoesPublicoPage() {
  const { chamberId } = useParams<{ chamberId: string }>();
  const [list, setList] = useState<Votacao[]>([]);
  const [est, setEst] = useState<Estatisticas | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [result, setResult] = useState('');
  const [tipo, setTipo] = useState('');
  const tip = useTip();

  useEffect(() => {
    Promise.all([
      publicGet<Votacao[]>(`/public/chambers/${chamberId}/votacoes?limit=200`),
      publicGet<Estatisticas>(`/public/chambers/${chamberId}/estatisticas`),
    ]).then(([l, e]) => { setList(l ?? []); setEst(e); setLoading(false); });
  }, [chamberId]);

  const tipos = useMemo(() => [...new Set(list.map(v => v.type).filter(Boolean))].sort(), [list]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return list.filter(v =>
      (!t || `${v.number} ${v.title} ${v.authorName} ${v.type}`.toLowerCase().includes(t))
      && (!result || v.status === result) && (!tipo || v.type === tipo));
  }, [list, q, result, tipo]);

  const meses = useMemo(() => fillMonths(est?.porMes ?? []), [est]);
  const voteBar = (m: Membro) => (
    <StackedBar title={m.name} tip={tip} height={14} focusable={false} segs={[
      { key: 's', label: 'sim', value: m.votos.sim, color: T.sim },
      { key: 'a', label: 'abstenção', value: m.votos.abstencao, color: T.abst },
      { key: 'n', label: 'não', value: m.votos.nao, color: T.nao },
      { key: 'x', label: 'não votou', value: m.votos.naoVotou, color: T.ausente },
    ]} />
  );
  const tot = est?.totais;
  const nada = !loading && (!tot || tot.votacoes === 0);

  return (
    <PublicShell chamberId={chamberId} active="votacoes" title="Votações"
                 subtitle="Resultados das matérias votadas em plenário e como cada vereador votou.">
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={24} color={T.muted} /></div> : (
        <div ref={tip.box} className="relative flex flex-col gap-5">
          {tip.node}

          {nada ? (
            <div className="bg-white rounded-2xl py-16 px-6 text-center" style={{ border: `1px solid ${T.hair}` }}>
              <Vote size={36} className="mx-auto mb-3" color="#CBD5E1" />
              <p className="font-semibold">Ainda não há votações concluídas</p>
              <p className="text-sm mt-1" style={{ color: T.muted }}>Os resultados aparecem aqui assim que cada votação é encerrada em plenário.</p>
            </div>
          ) : tot && est && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatTile label="Votações concluídas" value={tot.votacoes} hint={`em ${tot.sessoes} sessão(ões)`} />
                <StatTile label="Aprovadas" value={tot.aprovadas} hint={`${pct(tot.aprovadas, tot.votacoes)} das votações`} accent={T.sim} />
                <StatTile label="Rejeitadas" value={tot.rejeitadas} hint={`${pct(tot.rejeitadas, tot.votacoes)} das votações`} accent={T.nao} />
                <StatTile label="Votações nominais" value={tot.nominais}
                          hint={tot.secretas ? `${tot.secretas} secreta(s), sem voto individual` : 'todas com voto aberto'} />
              </div>

              <div className="grid lg:grid-cols-5 gap-5">
                <ChartCard className="lg:col-span-3" title="Votações por mês" subtitle="Últimos 12 meses, pela data de encerramento"
                           legend={<Legend items={RESULT_LEGEND} />}
                           table={<DataTable head={['Mês', 'Aprovadas', 'Rejeitadas', 'Total']}
                                             rows={meses.filter(m => m.aprovadas + m.rejeitadas).map(m => [monthLabel(m.mes), m.aprovadas, m.rejeitadas, m.aprovadas + m.rejeitadas])} />}>
                  <MonthlyColumns data={meses} tip={tip} />
                </ChartCard>

                <ChartCard className="lg:col-span-2" title="Resultado por tipo de matéria" subtitle="Total de matérias votadas de cada tipo"
                           legend={<Legend items={RESULT_LEGEND} />}
                           table={<DataTable head={['Tipo', 'Aprovadas', 'Rejeitadas']} rows={est.porTipo.map(t => [t.tipo, t.aprovadas, t.rejeitadas])} />}>
                  <div className="flex flex-col gap-3.5">
                    {est.porTipo.slice(0, 7).map(t => {
                      const total = t.aprovadas + t.rejeitadas;
                      const max = Math.max(...est.porTipo.map(x => x.aprovadas + x.rejeitadas));
                      return (
                        <div key={t.tipo}>
                          <div className="flex items-baseline justify-between text-sm mb-1.5">
                            <span className="truncate pr-2" style={{ color: T.ink }}>{t.tipo}</span>
                            <span className="text-xs flex-shrink-0" style={{ color: T.muted }}>{total}</span>
                          </div>
                          <div style={{ width: `${Math.max((total / max) * 100, 6)}%` }}>
                            <StackedBar title={t.tipo} tip={tip} height={10} segs={[
                              { key: 'a', label: 'aprovadas', value: t.aprovadas, color: T.sim },
                              { key: 'r', label: 'rejeitadas', value: t.rejeitadas, color: T.nao },
                            ]} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ChartCard>
              </div>

              <ChartCard title="Como cada vereador votou"
                         subtitle="Votações abertas (nominais). Em votação secreta o voto individual não é registrado. O presidente vota só nos casos previstos no regimento."
                         legend={<Legend items={VOTE_LEGEND} />}
                         table={<DataTable head={['Vereador', 'Sim', 'Não', 'Abstenção', 'Não votou', 'Acompanhou o resultado', 'Presença']}
                                           rows={est.membros.map(m => [m.name, m.votos.sim, m.votos.nao, m.votos.abstencao, m.votos.naoVotou,
                                             m.alinhamento == null ? '—' : `${m.alinhamento}%`, m.taxaPresenca == null ? '—' : `${m.taxaPresenca}%`])} />}>
                <div className="flex flex-col divide-y" style={{ borderColor: T.grid }}>
                  {est.membros.map(m => (
                    <Link key={m.id} href={`/publico/${chamberId}/vereadores/${m.id}`}
                          className="block py-3 hover:bg-slate-50 rounded-lg px-1 -mx-1">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:flex-none sm:w-56">
                          <Avatar src={m.avatarUrl ? `${PUBLIC_MEDIA}${m.avatarUrl}` : null} initials={m.initials} size={34} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: T.ink }}>{m.name}</p>
                            <p className="text-xs truncate" style={{ color: T.muted }}>{[m.party, ROLE_PUB(m)].filter(Boolean).join(' · ')}</p>
                          </div>
                        </div>
                        <div className="hidden sm:block flex-1 min-w-0">{voteBar(m)}</div>
                        <div className="text-right flex-shrink-0" style={{ minWidth: 92 }}>
                          <p className="text-sm font-semibold" style={{ color: T.ink }}>{m.alinhamento == null ? '—' : `${m.alinhamento}%`}</p>
                          <p className="text-[11px]" style={{ color: T.muted }}>acompanhou o resultado</p>
                        </div>
                      </div>
                      <div className="sm:hidden mt-2.5">{voteBar(m)}</div>
                    </Link>
                  ))}
                </div>
              </ChartCard>
            </>
          )}

          <section className="bg-white rounded-2xl p-4 sm:p-5" style={{ border: `1px solid ${T.hair}` }}>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <h3 className="text-[15px] font-semibold mr-auto">Todas as votações <span className="font-normal" style={{ color: T.muted }}>({filtered.length})</span></h3>
              <div className="flex items-center gap-2 rounded-lg px-3 flex-1 sm:flex-none sm:w-72" style={{ border: `1px solid ${T.hair}` }}>
                <Search size={15} color={T.muted} />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Número, ementa ou autor"
                       className="flex-1 py-2 text-sm outline-none bg-transparent min-w-0" aria-label="Buscar votação" />
              </div>
              <select value={result} onChange={e => setResult(e.target.value)} aria-label="Resultado"
                      className="text-sm rounded-lg px-2.5 py-2 bg-white" style={{ border: `1px solid ${T.hair}`, color: T.ink2 }}>
                <option value="">Todos os resultados</option>
                <option value="aprovado">Aprovadas</option>
                <option value="rejeitado">Rejeitadas</option>
              </select>
              {tipos.length > 1 && (
                <select value={tipo} onChange={e => setTipo(e.target.value)} aria-label="Tipo de matéria"
                        className="text-sm rounded-lg px-2.5 py-2 bg-white" style={{ border: `1px solid ${T.hair}`, color: T.ink2 }}>
                  <option value="">Todos os tipos</option>
                  {tipos.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
            </div>

            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: T.muted }}>Nenhuma votação encontrada.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filtered.map(v => {
                  const st = STATUS_PUB[v.status];
                  const total = (v.votesYes ?? 0) + (v.votesNo ?? 0) + (v.votesAbstain ?? 0);
                  return (
                    <Link key={v.id} href={`/publico/${chamberId}/votacoes/${v.id}`}
                          className="group block rounded-xl p-4 hover:shadow-sm transition-shadow"
                          style={{ border: `1px solid ${T.hair}` }}>
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-xs font-bold" style={{ color: T.accent }}>{v.number}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#F1F5F9', color: T.ink2 }}>{v.type}</span>
                            {v.votingType === 'secreta' && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#F1F5F9', color: T.ink2 }}>Secreta</span>}
                          </div>
                          <p className="text-sm font-semibold leading-snug" style={{ color: T.ink }}>{v.title}</p>
                          <p className="text-xs mt-1" style={{ color: T.muted }}>
                            {[v.authorName && `Autoria: ${v.authorName}`, `${v.sessionNumber}ª sessão`, dataPub(v.votingClosedAt), MAJ[v.majority]].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {st && <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: st.color, background: st.bg }}>{st.label}</span>}
                          <ChevronRight size={16} color="#CBD5E1" className="hidden sm:block group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                      {total > 0 && (
                        <div className="flex items-center gap-3 mt-3">
                          <div className="flex-1">
                            <StackedBar title={v.number} tip={tip} height={8} focusable={false} segs={[
                              { key: 's', label: 'sim', value: v.votesYes ?? 0, color: T.sim },
                              { key: 'a', label: 'abstenção', value: v.votesAbstain ?? 0, color: T.abst },
                              { key: 'n', label: 'não', value: v.votesNo ?? 0, color: T.nao },
                            ]} />
                          </div>
                          <span className="text-xs flex-shrink-0" style={{ color: T.ink2, fontVariantNumeric: 'tabular-nums' }}>
                            <b>{v.votesYes ?? 0}</b> sim · <b>{v.votesNo ?? 0}</b> não · <b>{v.votesAbstain ?? 0}</b> abst.
                          </span>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section id="dados-abertos" className="bg-white rounded-2xl p-4 sm:p-5 scroll-mt-4" style={{ border: `1px solid ${T.hair}` }}>
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={18} color={T.accent} />
              <h3 className="text-[15px] font-semibold">Dados abertos</h3>
            </div>
            <p className="text-sm mt-1 mb-4" style={{ color: T.muted }}>
              Planilhas CSV (separador “;”, UTF-8) atualizadas automaticamente. Uso livre, citando a fonte — Lei 12.527/2011.
            </p>
            <div className="grid sm:grid-cols-3 gap-2">
              {[
                ['votacoes.csv', 'Votações e resultados'],
                ['votos-nominais.csv', 'Votos nominais'],
                ['presencas.csv', 'Presença por vereador'],
              ].map(([f, label]) => (
                <a key={f} href={`${PUBLIC_API}/public/chambers/${chamberId}/dados/${f}`}
                   className="flex items-center gap-2 px-3.5 py-3 rounded-xl text-sm font-semibold hover:bg-slate-50"
                   style={{ border: `1px solid ${T.hair}`, color: T.ink }}>
                  <Download size={15} color={T.accent} /> {label}
                </a>
              ))}
            </div>
            <p className="text-xs mt-4 break-all" style={{ color: T.muted }}>
              API (JSON): <code>{PUBLIC_API}/public/chambers/{chamberId}/votacoes</code>
            </p>
          </section>
        </div>
      )}
    </PublicShell>
  );
}
