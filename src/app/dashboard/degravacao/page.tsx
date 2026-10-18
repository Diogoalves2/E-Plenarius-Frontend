'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, AudioLines, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { fullSessionTitle } from '@/lib/sessionTitle';

interface Row { id: string; number: number; type: string; date: string; status: string; rec: { status: string; progress: number } | null }

const REC: Record<string, { label: string; color: string; bg: string }> = {
  none:        { label: 'SEM GRAVAÇÃO',     color: '#8A94A2', bg: 'rgba(15,23,42,0.05)' },
  enviando:    { label: 'ENVIO INCOMPLETO', color: '#b45309', bg: 'rgba(245,158,11,0.12)' },
  na_fila:     { label: 'NA FILA',          color: '#1447E6', bg: 'rgba(20,71,230,0.08)' },
  processando: { label: 'TRANSCREVENDO',    color: '#1447E6', bg: 'rgba(20,71,230,0.08)' },
  transcrito:  { label: 'EM REVISÃO',       color: '#b45309', bg: 'rgba(245,158,11,0.12)' },
  aprovado:    { label: 'APROVADA',         color: '#059669', bg: 'rgba(16,185,129,0.10)' },
  erro:        { label: 'ERRO',             color: '#dc2626', bg: 'rgba(239,68,68,0.10)' },
};

export default function DegravacoesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [chamber, setChamber] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.chamberId) return;
    (async () => {
      try {
        api.get(`/chambers/${user.chamberId}`).then(r => setChamber(r.data)).catch(() => {});
        const { data: sessions } = await api.get(`/sessions/chamber/${user.chamberId}`);
        const relevant = (sessions as any[]).filter(s => s.status !== 'agendada').slice(0, 30);
        const withRec = await Promise.all(relevant.map(async s => {
          const { data } = await api.get(`/sessions/${s.id}/recordings`).catch(() => ({ data: [] }));
          return { ...s, rec: data[0] ?? null };
        }));
        setRows(withRec);
      } finally { setLoading(false); }
    })();
  }, [user?.chamberId]);

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <h2 className="font-tight font-semibold text-2xl" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>Degravação</h2>
      <p className="text-sm mt-1 mb-6" style={{ color: '#8A94A2' }}>
        Transcrição do áudio das sessões. A degravação é revisada e aprovada pela Mesa e entra como anexo da ata.
      </p>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin" style={{ color: '#8A94A2' }} /></div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <AudioLines size={36} style={{ color: '#D1D5DB' }} />
          <p className="mt-3 text-sm" style={{ color: '#8A94A2' }}>Nenhuma sessão realizada ainda.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl divide-y" style={{ border: '1px solid rgba(15,23,42,0.08)', borderColor: 'rgba(15,23,42,0.06)' }}>
          {rows.map(s => {
            const st = REC[s.rec?.status ?? 'none'];
            return (
              <Link key={s.id} href={`/dashboard/degravacao/${s.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#0B1220' }}>{fullSessionTitle(s.number, s.type, chamber)}</p>
                  <p className="text-xs" style={{ color: '#8A94A2' }}>
                    {new Date(s.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    {s.status === 'em_andamento' ? ' · em andamento' : ''}
                  </p>
                </div>
                <span className="font-mono-jet text-[10px] font-semibold px-2 py-1 rounded" style={{ color: st.color, background: st.bg }}>
                  {st.label}{s.rec?.status === 'processando' ? ` ${s.rec.progress}%` : ''}
                </span>
                <ChevronRight size={14} style={{ color: '#8A94A2' }} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
