'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, ShieldCheck, ShieldAlert, FileText } from 'lucide-react';
import { PublicShell, publicGet, PUBLIC_MEDIA, STATUS_PUB, CHOICE_PUB } from '@/components/public/PublicShell';

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

  useEffect(() => {
    publicGet<Detalhe>(`/public/votacoes/${itemId}`).then(d => { setV(d); setLoading(false); });
  }, [itemId]);

  return (
    <PublicShell chamberId={chamberId} active="votacoes" title={v ? `${v.number}` : 'Votação'}>
      <Link href={`/publico/${chamberId}/votacoes`} className="inline-flex items-center gap-1 text-sm mb-4" style={{ color: '#1447E6' }}>
        <ArrowLeft size={14} /> Todas as votações
      </Link>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" size={22} color="#8A94A2" /></div>
        : !v ? <p className="text-sm text-gray-500">Votação não encontrada ou ainda não encerrada.</p> : (
        <>
          <div className="bg-white rounded-xl p-5 mb-4" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
            <p className="text-xs" style={{ color: '#8A94A2' }}>{v.type} · {v.sessionNumber}ª sessão · autoria: {v.author}</p>
            <h2 className="text-lg font-bold mt-1" style={{ color: '#0B1220' }}>{v.title}</h2>
            {v.description && <p className="text-sm mt-2" style={{ color: '#4B5563' }}>{v.description}</p>}
            {v.pdfUrl && (
              <a href={`${PUBLIC_MEDIA}${v.pdfUrl}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm mt-3" style={{ color: '#1447E6' }}>
                <FileText size={14} /> Texto da matéria (PDF)
              </a>
            )}
          </div>

          <div className="bg-white rounded-xl p-5 mb-4" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-bold px-3 py-1.5 rounded-lg" style={{ color: STATUS_PUB[v.status]?.color, background: STATUS_PUB[v.status]?.bg }}>
                {STATUS_PUB[v.status]?.label}
              </span>
              <span className="text-sm" style={{ color: '#4B5563' }}>{v.majorityLabel} · votação {v.votingType}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {(['sim', 'nao', 'abstencao'] as const).map(c => (
                <div key={c} className="rounded-lg p-3 text-center" style={{ background: 'rgba(15,23,42,0.03)' }}>
                  <p className="text-2xl font-bold" style={{ color: CHOICE_PUB[c].color }}>{v.counts[c]}</p>
                  <p className="text-xs" style={{ color: '#8A94A2' }}>{CHOICE_PUB[c].label}</p>
                </div>
              ))}
            </div>
            {v.explanation && <p className="text-sm mt-3" style={{ color: '#4B5563' }}>{v.explanation}</p>}
          </div>

          {v.nominal ? (
            <div className="bg-white rounded-xl divide-y mb-4" style={{ border: '1px solid rgba(15,23,42,0.08)', borderColor: 'rgba(15,23,42,0.06)' }}>
              <p className="px-4 py-3 text-sm font-bold" style={{ color: '#0B1220' }}>Votos nominais</p>
              {v.nominal.map(n => (
                <Link key={n.id} href={`/publico/${chamberId}/vereadores/${n.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                  <span className="text-sm" style={{ color: '#0B1220' }}>{n.name}{n.party ? ` (${n.party})` : ''}</span>
                  <span className="text-sm font-bold" style={{ color: CHOICE_PUB[n.choice]?.color }}>{CHOICE_PUB[n.choice]?.label ?? n.choice}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm mb-4 px-1" style={{ color: '#8A94A2' }}>Votação secreta: o voto individual não é registrado pelo sistema.</p>
          )}

          <div className="rounded-xl p-4" style={{
            background: v.verificacao.valid ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${v.verificacao.valid ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            <p className="text-sm font-bold flex items-center gap-2" style={{ color: v.verificacao.valid ? '#059669' : '#dc2626' }}>
              {v.verificacao.valid ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
              {v.verificacao.valid ? 'Resultado verificado: íntegro' : 'Atenção: inconsistência detectada'}
            </p>
            <p className="text-xs mt-1" style={{ color: '#4B5563' }}>
              O sistema recalculou agora a cadeia de {v.verificacao.totalVotes} voto(s), o placar e o hash do resultado.
            </p>
            {!v.verificacao.valid && (
              <ul className="text-xs mt-2 list-disc pl-5" style={{ color: '#dc2626' }}>
                {v.verificacao.problems.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            )}
            {v.resultHash && <p className="text-[11px] mt-2 font-mono break-all" style={{ color: '#64748B' }}>Hash do resultado: {v.resultHash}</p>}
            <Link href={`/ata/${v.sessionId}`} className="inline-block text-xs mt-2 font-semibold" style={{ color: '#1447E6' }}>Ver ata da sessão →</Link>
          </div>
        </>
      )}
    </PublicShell>
  );
}
