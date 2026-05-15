'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Users, FileText, CheckCircle, XCircle, Loader2, Radio } from 'lucide-react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Session {
  id: string; number: number; type: string; date: string;
  status: 'agendada' | 'em_andamento' | 'encerrada';
  startedAt: string | null; endedAt: string | null;
}
interface Presence {
  userId: string;
  user: { id: string; name: string; party: string | null; role: string; initials: string; avatarUrl?: string | null };
}
interface AgendaItem {
  id: string; number: string; type: string; title: string; authorName: string;
  status: string; votingType: string; votesYes: number; votesNo: number; votesAbstain: number;
  orderIndex: number;
}

const TYPE_LABEL: Record<string, string> = {
  ordinaria: 'Ordinária', extraordinaria: 'Extraordinária', solene: 'Solene', especial: 'Especial',
};

export default function SessaoPublicaPage() {
  const { chamberId, sessionId } = useParams<{ chamberId: string; sessionId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [sR, pR, aR] = await Promise.all([
        fetch(`${API}/sessions/${sessionId}`),
        fetch(`${API}/sessions/${sessionId}/presences`),
        fetch(`${API}/agenda/session/${sessionId}`),
      ]);
      if (sR.ok) setSession(await sR.json());
      if (pR.ok) setPresences(await pR.json());
      if (aR.ok) setAgenda(await aR.json());
    } finally { setLoading(false); }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  // Poll while session is live
  useEffect(() => {
    if (session?.status !== 'em_andamento') return;
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [session?.status, load]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F6F7F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} style={{ color: '#8A94A2' }} />
      </div>
    );
  }

  if (!session) {
    return <div style={{ padding: 40, color: '#8A94A2', textAlign: 'center' }}>Sessão não encontrada</div>;
  }

  const isLive = session.status === 'em_andamento';
  const vereadores = presences.filter(p => p.user.role !== 'superadmin');

  return (
    <div style={{ minHeight: '100vh', background: '#F6F7F9', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#0B0D10', color: '#E9EDF2', padding: '20px 40px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <Link href={`/publico/${chamberId}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5B636D',
                         textDecoration: 'none', marginBottom: 12, fontFamily: 'monospace' }}>
            <ArrowLeft size={13} /> Voltar às sessões
          </Link>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ fontSize: 10, letterSpacing: '0.1em', color: '#5B636D', marginBottom: 4, fontFamily: 'monospace' }}>
                {new Date(session.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
                {session.number}ª Sessão {TYPE_LABEL[session.type] ?? session.type}
              </h1>
            </div>
            {isLive && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999,
                            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', flexShrink: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                <Radio size={12} style={{ color: '#10b981' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>AO VIVO</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 40px' }}>

        {/* Presença */}
        <Card>
          <CardHeader icon={<Users size={15} />} title={`Presença — ${vereadores.length} presente${vereadores.length !== 1 ? 's' : ''}`} />
          {vereadores.length === 0 ? (
            <p style={{ fontSize: 13, color: '#8A94A2', margin: 0 }}>Nenhuma presença registrada</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {vereadores.map(p => (
                <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MiniAvatar user={p.user} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#0B1220', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.user.name}
                    </p>
                    {p.user.party && <p style={{ fontSize: 11, color: '#8A94A2', margin: 0 }}>{p.user.party}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Pauta */}
        <Card style={{ marginTop: 16 }}>
          <CardHeader icon={<FileText size={15} />} title={`Ordem do Dia — ${agenda.length} item${agenda.length !== 1 ? 's' : ''}`} />
          {agenda.length === 0 ? (
            <p style={{ fontSize: 13, color: '#8A94A2', margin: 0 }}>Nenhum item na pauta</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {agenda.map((item, i) => {
                const isAprovado = item.status === 'aprovado';
                const isRejeitado = item.status === 'rejeitado';
                const isVotando = item.status === 'em_votacao';
                return (
                  <div key={item.id} style={{ padding: '12px 14px', borderRadius: 10,
                                              background: isVotando ? 'rgba(82,130,255,0.05)' : '#f8fafc',
                                              border: `1px solid ${isVotando ? 'rgba(82,130,255,0.2)' : '#f1f5f9'}` }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#8A94A2', minWidth: 20, marginTop: 2, fontFamily: 'monospace' }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, color: '#8A94A2', margin: '0 0 2px', fontFamily: 'monospace' }}>
                          {item.number} · {item.type}
                        </p>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#0B1220', margin: '0 0 4px' }}>{item.title}</p>
                        <p style={{ fontSize: 12, color: '#8A94A2', margin: 0 }}>Autoria: {item.authorName}</p>

                        {/* Resultado */}
                        {(isAprovado || isRejeitado) && (
                          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '6px 10px', borderRadius: 8,
                                        background: isAprovado ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                                        border: `1px solid ${isAprovado ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                            {isAprovado
                              ? <CheckCircle size={14} style={{ color: '#059669', flexShrink: 0 }} />
                              : <XCircle size={14} style={{ color: '#DC2626', flexShrink: 0 }} />}
                            <span style={{ fontSize: 12, fontWeight: 700, color: isAprovado ? '#059669' : '#DC2626' }}>
                              {isAprovado ? 'APROVADO' : 'REPROVADO'}
                            </span>
                            <span style={{ fontSize: 12, color: '#8A94A2', marginLeft: 4 }}>
                              Sim: {item.votesYes ?? 0} · Não: {item.votesNo ?? 0} · Abs.: {item.votesAbstain ?? 0}
                            </span>
                          </div>
                        )}

                        {isVotando && (
                          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1447E6', display: 'inline-block' }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#1447E6', fontFamily: 'monospace' }}>
                              VOTAÇÃO EM ANDAMENTO
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {isLive && (
          <p style={{ fontSize: 11, color: '#8A94A2', textAlign: 'center', marginTop: 20, fontFamily: 'monospace' }}>
            Dados atualizados automaticamente a cada 30 segundos
          </p>
        )}
      </div>
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 20px', border: '1px solid rgba(15,23,42,0.08)', ...style }}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <span style={{ color: '#8A94A2' }}>{icon}</span>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0B1220', margin: 0 }}>{title}</h2>
    </div>
  );
}

function MiniAvatar({ user }: { user: Presence['user'] }) {
  const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
  const color = colors[user.name.charCodeAt(0) % colors.length];
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt={user.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: 11, fontWeight: 700 }}>
      {user.initials || user.name.slice(0, 2).toUpperCase()}
    </div>
  );
}
