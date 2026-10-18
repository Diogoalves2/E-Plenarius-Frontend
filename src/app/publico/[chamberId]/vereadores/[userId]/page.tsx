'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';
import { PublicShell, publicGet, PUBLIC_MEDIA, STATUS_PUB, CHOICE_PUB } from '@/components/public/PublicShell';

interface Perfil {
  id: string; name: string; party: string | null; role: string; title: string | null; avatarUrl: string | null; initials: string | null;
  sessoes: number; presencas: number; taxaPresenca: number | null;
  votos: { id: string; number: string; title: string; status: string; choice: string; votingClosedAt: string; sessionNumber: number }[];
  autorias: { id: string; number: string; type: string; title: string; status: string }[];
}

export default function PerfilVereadorPage() {
  const { chamberId, userId } = useParams<{ chamberId: string; userId: string }>();
  const [p, setP] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicGet<Perfil>(`/public/chambers/${chamberId}/vereadores/${userId}`).then(d => { setP(d); setLoading(false); });
  }, [chamberId, userId]);

  return (
    <PublicShell chamberId={chamberId} active="vereadores" title={p?.name ?? 'Vereador'}>
      <Link href={`/publico/${chamberId}/vereadores`} className="inline-flex items-center gap-1 text-sm mb-4" style={{ color: '#1447E6' }}>
        <ArrowLeft size={14} /> Todos os vereadores
      </Link>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" size={22} color="#8A94A2" /></div>
        : !p ? <p className="text-sm text-gray-500">Vereador não encontrado.</p> : (
        <>
          <div className="bg-white rounded-xl p-5 flex items-center gap-4 mb-5" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
            {p.avatarUrl
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={`${PUBLIC_MEDIA}${p.avatarUrl}`} alt="" className="rounded-full object-cover" style={{ width: 64, height: 64 }} />
              : <div className="rounded-full flex items-center justify-center text-xl font-bold text-white" style={{ width: 64, height: 64, background: '#1447E6' }}>{p.initials}</div>}
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold" style={{ color: '#0B1220' }}>{p.name}</p>
              <p className="text-sm" style={{ color: '#8A94A2' }}>{[p.party, p.role === 'presidente' ? 'Presidente da Câmara' : p.role === 'vice_presidente' ? 'Vice-presidente' : p.title].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold" style={{ color: '#1447E6' }}>{p.taxaPresenca == null ? '—' : `${p.taxaPresenca}%`}</p>
              <p className="text-xs" style={{ color: '#8A94A2' }}>presença ({p.presencas}/{p.sessoes})</p>
            </div>
          </div>

          <h2 className="text-sm font-bold mb-2" style={{ color: '#0B1220' }}>Votos nominais</h2>
          <p className="text-xs mb-3" style={{ color: '#8A94A2' }}>Somente votações abertas. Em votação secreta o voto individual não é registrado.</p>
          <div className="bg-white rounded-xl divide-y mb-6" style={{ border: '1px solid rgba(15,23,42,0.08)', borderColor: 'rgba(15,23,42,0.06)' }}>
            {p.votos.length === 0 ? <p className="p-4 text-sm" style={{ color: '#8A94A2' }}>Nenhum voto nominal registrado.</p> : p.votos.map(v => (
              <Link key={v.id} href={`/publico/${chamberId}/votacoes/${v.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: '#0B1220' }}>{v.number} — {v.title}</p>
                  <p className="text-xs" style={{ color: '#8A94A2' }}>{v.sessionNumber}ª sessão · {STATUS_PUB[v.status]?.label ?? v.status}</p>
                </div>
                <span className="text-sm font-bold" style={{ color: CHOICE_PUB[v.choice]?.color }}>{CHOICE_PUB[v.choice]?.label ?? v.choice}</span>
              </Link>
            ))}
          </div>

          <h2 className="text-sm font-bold mb-3" style={{ color: '#0B1220' }}>Matérias de autoria</h2>
          <div className="bg-white rounded-xl divide-y" style={{ border: '1px solid rgba(15,23,42,0.08)', borderColor: 'rgba(15,23,42,0.06)' }}>
            {p.autorias.length === 0 ? <p className="p-4 text-sm" style={{ color: '#8A94A2' }}>Nenhuma matéria registrada.</p> : p.autorias.map(a => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: '#0B1220' }}>{a.number} — {a.title}</p>
                  <p className="text-xs" style={{ color: '#8A94A2' }}>{a.type}</p>
                </div>
                {STATUS_PUB[a.status] && (
                  <span className="text-[11px] font-bold px-2 py-1 rounded" style={{ color: STATUS_PUB[a.status].color, background: STATUS_PUB[a.status].bg }}>
                    {STATUS_PUB[a.status].label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </PublicShell>
  );
}
