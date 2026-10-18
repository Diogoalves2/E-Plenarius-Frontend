'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Download, Search } from 'lucide-react';
import { PublicShell, publicGet, PUBLIC_API, STATUS_PUB } from '@/components/public/PublicShell';

interface Votacao {
  id: string; number: string; type: string; title: string; authorName: string; votingType: string; majority: string;
  status: string; votesYes: number; votesNo: number; votesAbstain: number; votingClosedAt: string;
  sessionNumber: number; sessionDate: string;
}

const MAJ: Record<string, string> = { simples: 'Maioria simples', absoluta: 'Maioria absoluta', dois_tercos: 'Dois terços' };

export default function VotacoesPublicoPage() {
  const { chamberId } = useParams<{ chamberId: string }>();
  const [list, setList] = useState<Votacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    publicGet<Votacao[]>(`/public/chambers/${chamberId}/votacoes?limit=200`).then(d => { setList(d ?? []); setLoading(false); });
  }, [chamberId]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? list.filter(v => `${v.number} ${v.title} ${v.authorName} ${v.type}`.toLowerCase().includes(t)) : list;
  }, [list, q]);

  return (
    <PublicShell chamberId={chamberId} active="votacoes" title="Votações">
      <div className="flex items-center gap-2 bg-white rounded-xl px-3 mb-4" style={{ border: '1px solid rgba(15,23,42,0.1)' }}>
        <Search size={16} color="#8A94A2" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por número, ementa, autor…"
               className="flex-1 py-2.5 text-sm outline-none bg-transparent" />
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" size={22} color="#8A94A2" /></div> : (
        <div className="bg-white rounded-xl divide-y mb-8" style={{ border: '1px solid rgba(15,23,42,0.08)', borderColor: 'rgba(15,23,42,0.06)' }}>
          {filtered.length === 0 ? <p className="p-4 text-sm" style={{ color: '#8A94A2' }}>Nenhuma votação encontrada.</p> : filtered.map(v => (
            <Link key={v.id} href={`/publico/${chamberId}/votacoes/${v.id}`} className="block px-4 py-3 hover:bg-gray-50">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold" style={{ color: '#0B1220' }}>{v.number} — {v.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#8A94A2' }}>
                    {v.type} · {v.authorName} · {v.sessionNumber}ª sessão · {MAJ[v.majority] ?? v.majority} · votação {v.votingType}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-[11px] font-bold px-2 py-1 rounded" style={{ color: STATUS_PUB[v.status]?.color, background: STATUS_PUB[v.status]?.bg }}>
                    {STATUS_PUB[v.status]?.label}
                  </span>
                  <p className="text-xs mt-1 font-mono" style={{ color: '#64748B' }}>{v.votesYes}·{v.votesNo}·{v.votesAbstain}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <section id="dados-abertos" className="bg-white rounded-xl p-5" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
        <h2 className="text-sm font-bold" style={{ color: '#0B1220' }}>Dados abertos</h2>
        <p className="text-xs mt-1 mb-4" style={{ color: '#8A94A2' }}>
          Arquivos CSV (separador “;”, UTF-8) atualizados automaticamente. Uso livre, citando a fonte — Lei de Acesso à Informação (Lei 12.527/2011).
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            ['votacoes.csv', 'Votações e resultados'],
            ['votos-nominais.csv', 'Votos nominais (votações abertas)'],
            ['presencas.csv', 'Presença por vereador'],
          ].map(([f, label]) => (
            <a key={f} href={`${PUBLIC_API}/public/chambers/${chamberId}/dados/${f}`}
               className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
               style={{ border: '1px solid rgba(20,71,230,0.25)', color: '#1447E6' }}>
              <Download size={14} /> {label}
            </a>
          ))}
        </div>
        <p className="text-xs mt-4" style={{ color: '#8A94A2' }}>
          API JSON: <code className="font-mono">{PUBLIC_API}/public/chambers/{chamberId}/votacoes</code>
        </p>
      </section>
    </PublicShell>
  );
}
