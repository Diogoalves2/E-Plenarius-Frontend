'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Users, FileText, CheckCircle, XCircle, Loader2, Radio } from 'lucide-react';
import Link from 'next/link';
import { PublicShell, PUBLIC_MEDIA, ROLE_PUB } from '@/components/public/PublicShell';
import { Avatar } from '@/components/public/charts';

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
interface Member {
  id: string; name: string; party: string | null; role: string; title: string | null;
  initials: string | null; avatarUrl: string | null; isActive?: boolean;
}
const MEMBER_ROLES = ['vereador', 'presidente', 'vice_presidente'];
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
  const [members, setMembers] = useState<Member[]>([]);
  const [chamberRules, setChamberRules] = useState<{ totalSeats: number | null; defaultQuorum: number | null } | null>(null);
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

  // Composição da Casa (não muda durante a sessão): busca uma vez
  useEffect(() => {
    Promise.all([
      fetch(`${API}/users/chamber/${chamberId}`).then(r => (r.ok ? r.json() : [])),
      fetch(`${API}/chambers/${chamberId}`).then(r => (r.ok ? r.json() : null)),
    ]).then(([m, c]) => {
      setMembers((m as Member[]).filter(u => u.isActive !== false && MEMBER_ROLES.includes(u.role)));
      if (c) setChamberRules({ totalSeats: c.totalSeats ?? null, defaultQuorum: c.defaultQuorum ?? null });
    }).catch(() => {});
  }, [chamberId]);

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
    <PublicShell chamberId={chamberId} active="sessoes"
                 title={`${session.number}ª Sessão ${TYPE_LABEL[session.type] ?? session.type}`}
                 subtitle={new Date(session.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}>
      <div className="flex items-center justify-between gap-3 mb-5">
        <Link href={`/publico/${chamberId}`} className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: '#1447E6' }}>
          <ArrowLeft size={14} /> Todas as sessões
        </Link>
        {isLive && (
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: 'rgba(5,150,105,0.08)', color: '#047857', border: '1px solid rgba(5,150,105,0.25)' }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#059669' }} /> <Radio size={12} /> AO VIVO
          </span>
        )}
      </div>
      <div>

        {/* Presença */}
        <PresenceCard session={session} presences={vereadores} members={members} rules={chamberRules} />

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
                              {isAprovado ? 'APROVADO' : 'REJEITADO'}
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
    </PublicShell>
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

function PresenceCard({ session, presences, members, rules }: {
  session: Session; presences: Presence[]; members: Member[];
  rules: { totalSeats: number | null; defaultQuorum: number | null } | null;
}) {
  const presentIds = new Set(presences.map(p => p.userId));
  // Quem marcou presença mas não está na lista de membros (ex.: cadastro novo) também aparece
  const all: Member[] = [...members];
  for (const p of presences) {
    if (!all.some(m => m.id === p.userId)) all.push({ ...p.user, title: null, initials: p.user.initials, avatarUrl: p.user.avatarUrl ?? null });
  }
  const presentes = all.filter(m => presentIds.has(m.id));
  const ausentes = all.filter(m => !presentIds.has(m.id));
  const seats = rules?.totalSeats ?? (all.length || 1);
  const quorum = rules?.defaultQuorum ?? Math.floor(seats / 2) + 1;
  const ok = presentes.length >= quorum;
  const started = session.status !== 'agendada';
  const pct = (n: number) => `${Math.min(100, (n / seats) * 100)}%`;

  return (
    <section className="bg-white rounded-2xl p-5" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Users size={17} color="#1447E6" />
        <h3 className="text-[15px] font-semibold" style={{ color: '#0B1220' }}>Presença</h3>
        <span className="text-sm" style={{ color: '#64748B' }}>
          <b style={{ color: '#0B1220' }}>{presentes.length}</b> de {seats} vereadores
        </span>
        {started && (
          <span className="ml-auto flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                style={ok ? { background: 'rgba(5,150,105,0.1)', color: '#047857' } : { background: 'rgba(217,119,6,0.12)', color: '#92400E' }}>
            {ok ? <CheckCircle size={13} /> : <XCircle size={13} />}
            {ok ? 'Quórum atingido' : `Faltam ${quorum - presentes.length} para o quórum`}
          </span>
        )}
      </div>

      {/* Medidor: presentes x cadeiras, com a marca do quórum */}
      <div className="mb-5">
        <div className="relative h-2.5 rounded-full" style={{ background: '#E2E8F0' }}>
          <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: pct(presentes.length), background: ok ? '#059669' : '#1447E6' }} />
          <div className="absolute -top-1.5 -bottom-1.5" style={{ left: pct(quorum), width: 2, background: '#0B1220' }} title={`Quórum: ${quorum}`} />
        </div>
        <div className="relative h-4 mt-1 text-[11px]" style={{ color: '#64748B' }}>
          <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pct(quorum) }}>quórum: {quorum}</span>
        </div>
      </div>

      {all.length === 0 ? (
        <p className="text-sm" style={{ color: '#8A94A2' }}>Nenhum vereador cadastrado.</p>
      ) : (
        <>
          {presentes.length > 0 && (
            <MemberGrid label={`Presentes (${presentes.length})`} list={presentes} present />
          )}
          {ausentes.length > 0 && (
            <MemberGrid label={started ? `Ausentes (${ausentes.length})` : 'Aguardando o início da sessão'} list={ausentes} present={false} dim={started} />
          )}
        </>
      )}
    </section>
  );
}

function MemberGrid({ label, list, present, dim }: { label: string; list: Member[]; present: boolean; dim?: boolean }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: '#8A94A2' }}>{label}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {list.map(m => (
          <div key={m.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
               style={{ background: present ? 'rgba(5,150,105,0.05)' : '#F8FAFC', border: `1px solid ${present ? 'rgba(5,150,105,0.18)' : '#EEF2F6'}`, opacity: dim ? 0.6 : 1 }}>
            <div className="relative flex-shrink-0" style={{ filter: dim ? 'grayscale(1)' : undefined }}>
              <div className="rounded-full p-[2px]" style={{ background: present ? '#059669' : 'transparent' }}>
                <div className="rounded-full bg-white p-[2px]">
                  <Avatar src={m.avatarUrl ? `${PUBLIC_MEDIA}${m.avatarUrl}` : null} initials={m.initials || m.name.slice(0, 2).toUpperCase()} size={44} />
                </div>
              </div>
              {present && (
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full flex items-center justify-center"
                      style={{ width: 18, height: 18, background: '#059669', border: '2px solid #fff' }}>
                  <CheckCircle size={11} color="#fff" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: '#0B1220' }}>{m.name}</p>
              <p className="text-xs truncate" style={{ color: '#64748B' }}>{[m.party, ROLE_PUB(m)].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
