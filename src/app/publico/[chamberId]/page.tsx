'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Calendar, ChevronRight, Loader2, Radio } from 'lucide-react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Session {
  id: string; number: number; type: string; date: string;
  status: 'agendada' | 'em_andamento' | 'encerrada';
  startedAt: string | null; endedAt: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  ordinaria: 'Ordinária', extraordinaria: 'Extraordinária', solene: 'Solene', especial: 'Especial',
};

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  agendada:     { label: 'Agendada',      color: '#b45309', bg: 'rgba(234,179,8,0.1)' },
  em_andamento: { label: 'Em andamento',  color: '#059669', bg: 'rgba(16,185,129,0.1)' },
  encerrada:    { label: 'Encerrada',     color: '#6B7280', bg: 'rgba(15,23,42,0.06)' },
};

export default function PublicoPage() {
  const { chamberId } = useParams<{ chamberId: string }>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/sessions/chamber/${chamberId}`);
      if (r.ok) setSessions(await r.json());
    } finally { setLoading(false); }
  }, [chamberId]);

  useEffect(() => { load(); }, [load]);

  const ativa = sessions.find(s => s.status === 'em_andamento');
  const encerradas = sessions.filter(s => s.status === 'encerrada');
  const agendadas = sessions.filter(s => s.status === 'agendada');

  return (
    <div style={{ minHeight: '100vh', background: '#F6F7F9', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#0B0D10', color: '#E9EDF2', padding: '24px 40px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Brasao size={40} />
          <div>
            <p style={{ fontSize: 10, letterSpacing: '0.1em', color: '#5B636D', marginBottom: 2, fontFamily: 'monospace' }}>
              CÂMARA MUNICIPAL · PORTAL PÚBLICO
            </p>
            <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
              Sessões Legislativas
            </h1>
          </div>
          {ativa && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 14px', borderRadius: 999, background: 'rgba(16,185,129,0.15)',
                          border: '1px solid rgba(16,185,129,0.3)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981',
                             animation: 'pulse 2s infinite', display: 'inline-block' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
                AO VIVO
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 40px' }}>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <Loader2 size={24} style={{ color: '#8A94A2', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <>
            {/* Sessão ao vivo */}
            {ativa && (
              <div style={{ marginBottom: 32 }}>
                <SectionTitle icon={<Radio size={14} />} label="EM ANDAMENTO" />
                <SessionCard session={ativa} chamberId={chamberId} highlight />
              </div>
            )}

            {/* Próximas */}
            {agendadas.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <SectionTitle icon={<Calendar size={14} />} label="PRÓXIMAS SESSÕES" />
                {agendadas.map(s => <SessionCard key={s.id} session={s} chamberId={chamberId} />)}
              </div>
            )}

            {/* Histórico */}
            {encerradas.length > 0 && (
              <div>
                <SectionTitle icon={<Calendar size={14} />} label="HISTÓRICO" />
                {encerradas.map(s => <SessionCard key={s.id} session={s} chamberId={chamberId} />)}
              </div>
            )}

            {sessions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#8A94A2' }}>
                <Calendar size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <p style={{ fontSize: 15 }}>Nenhuma sessão cadastrada</p>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
      <span style={{ color: '#8A94A2' }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#8A94A2', letterSpacing: '0.1em', fontFamily: 'monospace' }}>{label}</span>
    </div>
  );
}

function SessionCard({ session, chamberId, highlight }: { session: Session; chamberId: string; highlight?: boolean }) {
  const st = STATUS_STYLE[session.status];
  return (
    <Link href={`/publico/${chamberId}/sessao/${session.id}`}
          style={{ textDecoration: 'none', display: 'block', marginBottom: 8 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px',
                    border: `1px solid ${highlight ? 'rgba(16,185,129,0.3)' : 'rgba(15,23,42,0.08)'}`,
                    display: 'flex', alignItems: 'center', gap: 14,
                    boxShadow: highlight ? '0 0 0 3px rgba(16,185,129,0.08)' : 'none',
                    transition: 'box-shadow 0.15s' }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(82,130,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Calendar size={18} style={{ color: 'oklch(0.52 0.16 255)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#0B1220', margin: '0 0 2px' }}>
            {session.number}ª Sessão {TYPE_LABEL[session.type] ?? session.type}
          </p>
          <p style={{ fontSize: 12, color: '#8A94A2', margin: 0 }}>
            {new Date(session.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
                       background: st.bg, color: st.color, flexShrink: 0, fontFamily: 'monospace' }}>
          {st.label}
        </span>
        <ChevronRight size={16} style={{ color: '#C5CAD2', flexShrink: 0 }} />
      </div>
    </Link>
  );
}

function Brasao({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="40" cy="40" r="38" stroke="oklch(0.52 0.16 255)" strokeWidth="1.5" />
      <path d="M40 18 L44.5 32 L59 32 L47.2 40.5 L51.8 54.5 L40 46 L28.2 54.5 L32.8 40.5 L21 32 L35.5 32 Z"
            fill="oklch(0.52 0.16 255)" opacity="0.92" />
    </svg>
  );
}
