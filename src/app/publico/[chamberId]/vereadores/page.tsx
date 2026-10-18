'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { PublicShell, publicGet, PUBLIC_MEDIA } from '@/components/public/PublicShell';

interface Membro {
  id: string; name: string; party: string | null; role: string; title: string | null;
  avatarUrl: string | null; initials: string | null; sessoes: number; presencas: number; taxaPresenca: number | null;
}

export default function VereadoresPublicoPage() {
  const { chamberId } = useParams<{ chamberId: string }>();
  const [data, setData] = useState<{ totais: { sessoes: number; aprovadas: number; rejeitadas: number }; membros: Membro[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicGet<any>(`/public/chambers/${chamberId}`).then(d => { setData(d); setLoading(false); });
  }, [chamberId]);

  return (
    <PublicShell chamberId={chamberId} active="vereadores" title="Vereadores e presença">
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" size={22} color="#8A94A2" /></div>
        : !data ? <p className="text-sm text-gray-500">Dados indisponíveis.</p> : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Stat label="Sessões realizadas" value={data.totais.sessoes} />
            <Stat label="Matérias aprovadas" value={data.totais.aprovadas} color="#059669" />
            <Stat label="Matérias rejeitadas" value={data.totais.rejeitadas} color="#dc2626" />
          </div>
          <div className="bg-white rounded-xl divide-y" style={{ border: '1px solid rgba(15,23,42,0.08)', borderColor: 'rgba(15,23,42,0.06)' }}>
            {data.membros.map(m => (
              <Link key={m.id} href={`/publico/${chamberId}/vereadores/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                {m.avatarUrl
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={`${PUBLIC_MEDIA}${m.avatarUrl}`} alt="" className="rounded-full object-cover flex-shrink-0" style={{ width: 40, height: 40 }} />
                  : <div className="rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ width: 40, height: 40, background: '#1447E6' }}>{m.initials}</div>}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: '#0B1220' }}>{m.name}</p>
                  <p className="text-xs" style={{ color: '#8A94A2' }}>{[m.party, m.role === 'presidente' ? 'Presidente' : m.role === 'vice_presidente' ? 'Vice-presidente' : m.title].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="text-right flex-shrink-0" style={{ minWidth: 110 }}>
                  <p className="text-sm font-bold" style={{ color: '#0B1220' }}>{m.taxaPresenca == null ? '—' : `${m.taxaPresenca}%`}</p>
                  <p className="text-[11px]" style={{ color: '#8A94A2' }}>{m.presencas}/{m.sessoes} sessões</p>
                  <div className="h-1 rounded-full mt-1" style={{ background: 'rgba(15,23,42,0.06)' }}>
                    <div className="h-1 rounded-full" style={{ width: `${m.taxaPresenca ?? 0}%`, background: '#1447E6' }} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </PublicShell>
  );
}

function Stat({ label, value, color = '#0B1220' }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-white rounded-xl p-4" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs" style={{ color: '#8A94A2' }}>{label}</p>
    </div>
  );
}
