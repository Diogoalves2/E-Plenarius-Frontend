'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { useVoting, type LiveVoteEvent } from '@/hooks/useVoting';
import api from '@/lib/api';
import {
  Play, Square, Eye, EyeOff, Clock, ChevronRight, ChevronLeft, Lock,
} from 'lucide-react';
import { clsx } from 'clsx';
import { SecretTally } from '@/components/voting/SecretTally';
import { PhaseBar } from '@/components/session/PhaseBar';
import { MAJORITY_LABEL, requiredVotes, useChamberRules } from '@/lib/legislativo';
import Link from 'next/link';
import { canConductSession } from '@/lib/auth';
import { useDialog } from '@/components/ui/Dialog';

const MEDIA = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');

interface SessionInfo { id: string; number: number; type: string; }

const ITEM_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pendente: { label: 'Pendente', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  em_votacao: { label: 'Em votação', color: '#1447E6', bg: 'rgba(82,130,255,0.1)' },
  aprovado: { label: 'Aprovado', color: '#16a34a', bg: 'rgba(34,197,94,0.1)' },
  rejeitado: { label: 'Rejeitado', color: '#dc2626', bg: 'rgba(239,68,68,0.1)' },
  retirado: { label: 'Retirado', color: '#475569', bg: 'rgba(100,116,139,0.1)' },
};

export default function VotacaoAoVivoPage() {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [presentes, setPresentes] = useState(0);
  const [timer, setTimer] = useState(0);
  const [actionError, setActionError] = useState<{ message: string; tie?: boolean } | null>(null);
  const { rules } = useChamberRules(user?.chamberId);
  const heroRef = useRef<HTMLDivElement>(null);
  const dialog = useDialog();

  const { socket, connected } = useSocket(sessionId);
  const { agenda, activeItem, counts, countsHidden, totalVotes, voteLog, loading, openVoting, closeVoting } = useVoting(sessionId, socket);

  useEffect(() => {
    if (!user?.chamberId) return;
    api.get(`/sessions/active/${user.chamberId}`)
      .then(r => {
        if (r.data?.id) {
          setSessionId(r.data.id);
          setSessionInfo(r.data);
        }
      })
      .catch(() => {});
  }, [user]);

  // Fetch presences count
  useEffect(() => {
    if (!sessionId) return;
    api.get(`/sessions/${sessionId}/presences`)
      .then(r => setPresentes(Array.isArray(r.data) ? r.data.length : 0))
      .catch(() => {});
  }, [sessionId]);

  // Update presences count on quorum events
  useEffect(() => {
    if (!socket || !sessionId) return;
    const handler = () => {
      api.get(`/sessions/${sessionId}/presences`)
        .then(r => setPresentes(Array.isArray(r.data) ? r.data.length : 0))
        .catch(() => {});
    };
    socket.on('quorum:updated', handler);
    return () => { socket.off('quorum:updated', handler); };
  }, [socket, sessionId]);

  // ── Navegação entre os projetos do dia ────────────────────────────────
  const votingNow = agenda.find(i => i.status === 'em_votacao') ?? (activeItem?.status === 'em_votacao' ? activeItem : null);
  const [viewId, setViewId] = useState<string | null>(null);
  // Votação aberta: o painel vai direto para ela
  useEffect(() => { if (votingNow) setViewId(votingNow.id); }, [votingNow?.id]);
  // Item padrão: em votação > próximo pendente > último votado > primeiro
  useEffect(() => {
    if (viewId && agenda.some(i => i.id === viewId)) return;
    const def = votingNow ?? agenda.find(i => i.status === 'pendente') ?? activeItem ?? agenda[0];
    if (def) setViewId(def.id);
  }, [agenda, viewId, votingNow, activeItem]);

  const viewIdx = agenda.findIndex(i => i.id === viewId);
  const base = viewIdx >= 0 ? agenda[viewIdx] : null;
  const view = base && activeItem?.id === base.id ? { ...base, ...activeItem } : base;
  const showingActive = !!view && activeItem?.id === view.id;
  const isVoted = view?.status === 'aprovado' || view?.status === 'rejeitado';
  const nextPending = agenda.slice(viewIdx + 1).find(i => i.status === 'pendente') ?? agenda.find(i => i.status === 'pendente');
  const go = (id: string) => { setViewId(id); setActionError(null); };

  // Projeto já votado que não é o último: busca os votos dele
  const [otherLog, setOtherLog] = useState<{ id: string; log: LiveVoteEvent[] } | null>(null);
  useEffect(() => {
    if (!view || showingActive || !isVoted) return;
    let off = false;
    api.get(`/voting/item/${view.id}/votes`).then(r => {
      if (off) return;
      setOtherLog({
        id: view.id,
        log: (r.data as any[]).reverse().map(v => ({
          userId: v.userId, userName: v.user?.name ?? '', userAvatarUrl: v.user?.avatarUrl ?? null,
          userParty: v.user?.party ?? null, userInitials: v.user?.initials ?? null,
          agendaItemId: v.agendaItemId, choice: v.choice, hash: v.hash, counts: null,
        })),
      });
    }).catch(() => {});
    return () => { off = true; };
  }, [view?.id, view?.status, showingActive, isVoted]);

  const vCounts = showingActive ? counts : { sim: view?.votesYes ?? 0, nao: view?.votesNo ?? 0, abstencao: view?.votesAbstain ?? 0 };
  const vHidden = showingActive ? countsHidden : false;
  const vTotal = showingActive ? totalVotes : (view?.votesTotal ?? vCounts.sim + vCounts.nao + vCounts.abstencao);
  const vLog = showingActive ? voteLog : (otherLog && otherLog.id === view?.id ? otherLog.log : []);

  // Cronômetro do projeto exibido
  useEffect(() => {
    if (!view?.votingOpenedAt) { setTimer(0); return; }
    const startMs = new Date(view.votingOpenedAt).getTime();
    if (view.status !== 'em_votacao') {
      setTimer(view.votingClosedAt ? Math.floor((new Date(view.votingClosedAt).getTime() - startMs) / 1000) : 0);
      return;
    }
    const tick = () => setTimer(Math.floor((Date.now() - startMs) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [view?.id, view?.status, view?.votingOpenedAt, view?.votingClosedAt]);

  const mm = String(Math.floor(timer / 60)).padStart(2, '0');
  const ss = String(timer % 60).padStart(2, '0');
  const isPresidente = canConductSession(user?.role);

  async function runAction(fn: () => Promise<unknown>) {
    setActionError(null);
    try { await fn(); }
    catch (e: any) {
      const d = e.response?.data;
      setActionError({ message: d?.message ?? 'Erro ao executar a ação', tie: d?.code === 'TIE_NEEDS_PRESIDENT' });
    }
  }

  return (
    <div className="p-6 flex flex-col gap-5 min-h-full" style={{ background: '#F6F7F9' }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-mono-jet" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>
        <span>{sessionInfo ? `${sessionInfo.number}ª Sessão ${sessionInfo.type.charAt(0).toUpperCase() + sessionInfo.type.slice(1)}` : 'Sessão'}</span>
        <ChevronRight size={12} />
        <span>Ordem do dia</span>
        <ChevronRight size={12} />
        <span className="text-gray-700">Votação ao vivo</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className={clsx('w-1.5 h-1.5 rounded-full', connected ? 'animate-pulse-dot' : '')}
                style={{ background: connected ? 'oklch(0.50 0.15 155)' : '#8A94A2' }} />
          <span>{connected ? 'WebSocket conectado' : 'Desconectado'}</span>
        </div>
      </div>

      {!sessionId ? (
        <NoSessionCard />
      ) : (
        <>
          {user?.chamberId && (
            <PhaseBar sessionId={sessionId} chamberId={user.chamberId} socket={socket} canControl={isPresidente} />
          )}

          {/* Navegação entre os projetos do dia */}
          {agenda.length > 0 && (
            <div className="rounded-2xl flex items-center gap-2 px-2.5 py-2"
                 style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
              <NavButton disabled={viewIdx <= 0} onClick={() => go(agenda[viewIdx - 1].id)} label="Projeto anterior">
                <ChevronLeft size={16} />
              </NavButton>
              <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto py-0.5" style={{ scrollbarWidth: 'thin' }}>
                {agenda.map((item, i) => {
                  const sel = item.id === viewId;
                  return (
                    <button key={item.id} onClick={() => go(item.id)} title={item.title}
                            className="flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors flex-shrink-0 hover:bg-gray-50"
                            style={{ background: sel ? 'rgba(20,71,230,0.07)' : undefined,
                                     border: `1px solid ${sel ? 'rgba(20,71,230,0.35)' : 'rgba(15,23,42,0.08)'}`,
                                     color: sel ? '#1447E6' : '#4B5563' }}>
                      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', item.status === 'em_votacao' && 'animate-pulse-dot')}
                            style={{ background: ITEM_STATUS[item.status]?.color ?? '#8A94A2' }} />
                      <span className="font-mono-jet" style={{ color: sel ? '#1447E6' : '#8A94A2' }}>{String(i + 1).padStart(2, '0')}</span>
                      <span className="font-semibold">{item.number}</span>
                    </button>
                  );
                })}
              </div>
              <span className="text-xs font-mono-jet px-1 flex-shrink-0 hidden sm:block" style={{ color: '#8A94A2' }}>
                {viewIdx + 1}/{agenda.length}
              </span>
              <NavButton disabled={viewIdx < 0 || viewIdx >= agenda.length - 1} onClick={() => go(agenda[viewIdx + 1].id)} label="Próximo projeto">
                <ChevronRight size={16} />
              </NavButton>
            </div>
          )}

          {/* Hero card — projeto selecionado */}
          <div ref={heroRef} className="rounded-2xl p-6 relative overflow-hidden"
               style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
            {view?.status === 'em_votacao' && (
              <div className="absolute inset-0 pointer-events-none"
                   style={{ background: 'radial-gradient(600px 200px at 85% 0%, rgba(82,130,255,0.06), transparent 60%)' }} />
            )}
            <div className="flex items-start gap-6 relative">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <StatusBadge status={view?.status ?? 'aguardando'} />
                  {view && (
                    <>
                      <Chip mono>{view.number}</Chip>
                      <Chip>{view.type}</Chip>
                      <Chip icon={view.votingType === 'secreta' ? <EyeOff size={10} /> : <Eye size={10} />}>
                        {view.votingType === 'secreta' ? 'Secreta' : 'Aberta'}
                      </Chip>
                      {view.majority && view.majority !== 'simples' && (
                        <Chip>
                          {MAJORITY_LABEL[view.majority]}
                          {rules ? ` · ${requiredVotes(view.majority, rules.seats)} votos SIM` : ''}
                        </Chip>
                      )}
                    </>
                  )}
                </div>
                <h1 className="font-tight font-semibold text-gray-900 text-2xl tracking-tight leading-tight mb-2">
                  {view?.title ?? (loading ? 'Carregando pauta…' : 'Nenhum projeto na ordem do dia')}
                </h1>
                {view?.description && (
                  <p className="text-sm text-gray-500 leading-relaxed max-w-2xl mb-3">{view.description}</p>
                )}
                {view?.authorName && (
                  <p className="text-xs text-gray-500">Autoria: <span className="font-semibold text-gray-700">{view.authorName}</span></p>
                )}
              </div>

              {/* Timer + controles */}
              <div className="flex flex-col items-end gap-3 flex-shrink-0">
                <div className="text-right">
                  <div className="font-mono-jet font-medium"
                       style={{ fontSize: 52, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                                color: view?.votingOpenedAt ? '#0B1220' : '#D1D5DB' }}>
                    {view?.votingOpenedAt ? `${mm}:${ss}` : '--:--'}
                  </div>
                  <div className="text-[10px] font-mono-jet tracking-widest mt-1" style={{ color: '#8A94A2', letterSpacing: '0.08em' }}>
                    {view?.status === 'em_votacao' ? 'TEMPO EM VOTAÇÃO' : 'DURAÇÃO DA VOTAÇÃO'}
                  </div>
                </div>
                {isPresidente && view && (
                  <div className="flex flex-wrap justify-end gap-2">
                    {view.status === 'em_votacao' && (
                      <button onClick={() => runAction(() => closeVoting(view.id))}
                              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                              style={{ background: 'oklch(0.52 0.20 25)' }}>
                        <Square size={13} /> Encerrar votação
                      </button>
                    )}
                    {view.status === 'pendente' && (
                      <button disabled={!!votingNow}
                              onClick={async () => {
                                const ok = await dialog.confirm({
                                  title: 'Abrir votação?',
                                  message: <><b style={{ color: '#0B1220' }}>{view.number}</b> · {view.title}<br />Os vereadores presentes poderão votar a partir de agora.</>,
                                  confirmLabel: 'Abrir votação',
                                });
                                if (ok) runAction(() => openVoting(view.id));
                              }}
                              title={votingNow ? 'Encerre a votação em andamento primeiro' : undefined}
                              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-opacity enabled:hover:opacity-90 disabled:cursor-not-allowed"
                              style={votingNow ? { background: '#EFF1F4', color: '#8A94A2' } : { background: '#1447E6', color: '#fff' }}>
                        <Play size={13} /> Abrir votação
                      </button>
                    )}
                    {(isVoted || view.status === 'retirado') && (
                      <button disabled className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold cursor-not-allowed"
                              style={{ background: '#EFF1F4', color: '#8A94A2' }}>
                        <Lock size={13} /> {view.status === 'retirado' ? 'Retirado de pauta' : 'Já votado'}
                      </button>
                    )}
                  </div>
                )}
                {votingNow && view && votingNow.id !== view.id && (
                  <button onClick={() => go(votingNow.id)} className="text-xs font-semibold underline underline-offset-2" style={{ color: '#1447E6' }}>
                    Ir para a votação em andamento
                  </button>
                )}
              </div>
            </div>
          </div>

          {actionError && (
            <div className="rounded-xl px-4 py-3 text-sm flex flex-wrap items-center gap-3"
                 style={{ background: actionError.tie ? 'rgba(245,158,11,0.10)' : 'rgba(239,68,68,0.08)',
                          color: actionError.tie ? '#92400e' : '#dc2626',
                          border: `1px solid ${actionError.tie ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.2)'}` }}>
              <span className="font-semibold">{actionError.message}</span>
              {actionError.tie && (
                <Link href="/dashboard/votar" className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ background: '#1447E6' }}>
                  Votar para desempatar
                </Link>
              )}
            </div>
          )}

          {/* Grid: plenário + resultado + auditoria (do projeto selecionado) */}
          <div className="grid gap-5 grid-cols-1 lg:grid-cols-[1fr_300px]">
            <div className="rounded-2xl overflow-hidden"
                 style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
              <div className="flex items-center gap-3 px-5 py-3.5"
                   style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                <span className="text-sm font-semibold text-gray-800">Plenário</span>
                <span className="text-xs font-mono-jet text-gray-400">
                  {view?.status === 'pendente' ? 'aguardando votação' : `${vTotal}/${presentes} votaram`}
                </span>
                <div className="ml-auto h-1.5 rounded-full overflow-hidden" style={{ width: 140, background: '#EFF1F4' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                       style={{ width: `${presentes ? Math.min(100, (vTotal / presentes) * 100) : 0}%`, background: '#1447E6' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3">
                {vLog.slice(0, 9).concat(
                  Array.from({ length: Math.max(0, 9 - vLog.length) }, () => null) as any
                ).map((v, i) => (
                  <VereadorCell key={i} event={v} />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
                <p className="text-[10px] font-mono-jet tracking-widest mb-4"
                   style={{ color: '#8A94A2', letterSpacing: '0.08em' }}>
                  {isVoted ? 'RESULTADO FINAL' : 'RESULTADO PARCIAL'}
                </p>
                {vHidden ? <SecretTally total={vTotal} /> : (
                  <div className="flex flex-col gap-3">
                    <VoteBar label="SIM" count={vCounts.sim} total={presentes} color="oklch(0.50 0.15 155)" />
                    <VoteBar label="NÃO" count={vCounts.nao} total={presentes} color="oklch(0.52 0.20 25)" />
                    <VoteBar label="ABSTENÇÃO" count={vCounts.abstencao} total={presentes} color="oklch(0.60 0.02 250)" />
                  </div>
                )}
                {isVoted && view && (
                  <div className="mt-4 p-3 rounded-xl"
                       style={{
                         background: view.status === 'aprovado' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                         border: `1px solid ${view.status === 'aprovado' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                       }}>
                    <div className="text-[10px] font-mono-jet tracking-wider mb-1" style={{ color: '#8A94A2' }}>RESULTADO</div>
                    <div className="font-tight font-bold text-xl tracking-tight"
                         style={{ color: view.status === 'aprovado' ? '#16a34a' : '#dc2626' }}>
                      {view.status === 'aprovado' ? 'APROVADO' : 'REJEITADO'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {view.resultExplanation || `${vCounts.sim} a ${vCounts.nao} · ${vCounts.abstencao} abstenção(ões)`}
                    </div>
                  </div>
                )}
                {isVoted && nextPending && (
                  <button onClick={() => { go(nextPending.id); heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                          className="mt-3 w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors hover:bg-gray-50"
                          style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono-jet tracking-wider" style={{ color: '#8A94A2' }}>PRÓXIMO DA PAUTA</div>
                      <div className="text-sm font-semibold truncate" style={{ color: '#0B1220' }}>{nextPending.number}</div>
                      <div className="text-xs truncate" style={{ color: '#8A94A2' }}>{nextPending.title}</div>
                    </div>
                    <ChevronRight size={16} style={{ color: '#1447E6', flexShrink: 0 }} />
                  </button>
                )}
              </div>

              <div className="rounded-2xl p-4 flex-1" style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
                <p className="text-[10px] font-mono-jet tracking-widest mb-3"
                   style={{ color: '#8A94A2', letterSpacing: '0.08em' }}>
                  AUDITORIA · EVENTOS
                </p>
                <div className="flex flex-col gap-0">
                  {vLog.length === 0 && (
                    <p className="text-xs text-gray-400 font-mono-jet">{view?.status === 'pendente' ? 'Votação não iniciada.' : 'Aguardando votos…'}</p>
                  )}
                  {vLog.slice(0, 6).map((e, i) => (
                    <div key={i} className="flex items-center gap-2 py-2"
                         style={{ borderBottom: i < Math.min(vLog.length, 6) - 1 ? '1px dashed rgba(15,23,42,0.08)' : 'none' }}>
                      <span className="font-semibold text-xs text-gray-700 flex-1 truncate">
                        {e.userName?.split(' ')[0]}
                      </span>
                      {e.choice !== 'secreta' && (
                        <span className="text-[10px] font-mono-jet font-bold px-1.5 py-0.5 rounded"
                              style={{
                                background: e.choice === 'sim' ? 'rgba(34,197,94,0.1)' : e.choice === 'nao' ? 'rgba(239,68,68,0.1)' : 'rgba(100,116,139,0.1)',
                                color: e.choice === 'sim' ? '#16a34a' : e.choice === 'nao' ? '#dc2626' : '#475569',
                              }}>
                          {e.choice.toUpperCase()}
                        </span>
                      )}
                      <span className="font-mono-jet text-[9px] truncate max-w-[90px]" style={{ color: '#8A94A2' }}>{e.hash}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Pauta da sessão — clique para ver o projeto */}
          <div className="rounded-2xl overflow-hidden"
               style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
            <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
              <span className="text-sm font-semibold text-gray-800">Ordem do dia · {agenda.length} itens</span>
            </div>
            {agenda.map((item, i) => {
              const sel = item.id === viewId;
              return (
                <div key={item.id} role="button" tabIndex={0}
                     onClick={() => { go(item.id); heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                     onKeyDown={e => { if (e.key === 'Enter') go(item.id); }}
                     className="flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors hover:bg-gray-50"
                     style={{ borderBottom: i < agenda.length - 1 ? '1px solid rgba(15,23,42,0.06)' : 'none',
                              background: sel ? 'rgba(20,71,230,0.04)' : undefined,
                              boxShadow: sel ? 'inset 3px 0 0 #1447E6' : undefined }}>
                  <span className="font-mono-jet text-xs w-7 text-right flex-shrink-0" style={{ color: '#8A94A2' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-mono-jet text-xs font-semibold flex-shrink-0 w-28" style={{ color: '#4B5563' }}>
                    {item.number}
                  </span>
                  <span className="text-sm text-gray-800 font-medium flex-1 truncate">{item.title}</span>
                  <span className="text-xs text-gray-400 hidden lg:block">{item.authorName}</span>
                  <ItemStatus status={item.status} />
                </div>
              );
            })}
            {loading && (
              <div className="px-5 py-4 text-sm text-gray-400 font-mono-jet">Carregando pauta…</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NavButton({ children, onClick, disabled, label }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label}
            className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 transition-colors enabled:hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: '#4B5563' }}>
      {children}
    </button>
  );
}

function NoSessionCard() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <Clock size={40} style={{ color: '#8A94A2' }} />
      <h2 className="font-tight font-semibold text-xl text-gray-700">Nenhuma sessão em andamento</h2>
      <p className="text-sm text-gray-400 max-w-sm">
        Quando o presidente iniciar a sessão do dia (menu Sessões), a votação aparece aqui automaticamente.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = status === 'pendente' || status === 'aguardando'
    ? { label: 'Aguardando votação', color: '#d97706', bg: 'rgba(245,158,11,0.1)' }
    : ITEM_STATUS[status] ?? ITEM_STATUS.retirado;

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono-jet font-semibold px-2.5 py-1 rounded-full"
          style={{ background: cfg.bg, color: cfg.color }}>
      {status === 'em_votacao' && (
        <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot inline-block" style={{ background: cfg.color }} />
      )}
      {cfg.label.toUpperCase()}
    </span>
  );
}

function Chip({ children, mono, icon }: { children: React.ReactNode; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md"
          style={{ border: '1px solid rgba(15,23,42,0.08)', background: '#F6F7F9', color: '#4B5563',
                   fontFamily: mono ? '"JetBrains Mono", monospace' : 'inherit' }}>
      {icon}{children}
    </span>
  );
}

function VoteBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total ? Math.min(100, (count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[11px] font-mono-jet font-semibold" style={{ color: '#4B5563', letterSpacing: '0.04em' }}>{label}</span>
        <span className="font-tight font-medium text-2xl tracking-tight" style={{ color, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#EFF1F4' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function VereadorCell({ event }: { event: any }) {
  if (!event) return (
    <div className="p-3 flex items-center gap-2.5" style={{ background: '#fff', borderBottom: '1px solid rgba(15,23,42,0.04)' }}>
      <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ background: '#EFF1F4' }} />
      <div className="flex-1">
        <div className="h-2 w-20 rounded mb-1" style={{ background: '#EFF1F4' }} />
        <div className="h-1.5 w-12 rounded" style={{ background: '#F6F7F9' }} />
      </div>
    </div>
  );

  const colorMap: Record<string, string> = { sim: '#16a34a', nao: '#dc2626', abstencao: '#475569', secreta: '#1447E6' };
  const c = colorMap[event.choice] || '#8A94A2';
  const voteLabel = event.choice !== 'secreta' ? event.choice.toUpperCase() : '●●●';

  const avatarColors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
  const avatarBg = avatarColors[(event.userName?.charCodeAt(0) ?? 0) % avatarColors.length];
  const initials = event.userInitials
    || event.userName?.split(' ').filter(Boolean).slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
    || '?';
  const avatarSrc = event.userAvatarUrl
    ? (event.userAvatarUrl.startsWith('http') ? event.userAvatarUrl : `${MEDIA}${event.userAvatarUrl}`)
    : null;

  const words = event.userName?.split(' ').filter(Boolean) ?? [];
  const displayName = words.length >= 2
    ? `${words[0]} ${words[words.length - 1]}`
    : words[0] ?? '—';

  return (
    <div className="p-3 flex items-center gap-2.5 relative"
         style={{ background: '#fff', borderBottom: '1px solid rgba(15,23,42,0.04)' }}>
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r" style={{ background: c }} />
      <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold"
           style={{ background: avatarSrc ? 'transparent' : avatarBg, color: '#fff' }}>
        {avatarSrc
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={avatarSrc} alt={event.userName}
                 style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-gray-800 truncate">{displayName}</div>
        {event.userParty && (
          <div className="text-[10px] font-mono-jet truncate" style={{ color: '#8A94A2' }}>{event.userParty}</div>
        )}
      </div>
      <span className="text-[10px] font-mono-jet font-bold flex-shrink-0 px-2 py-0.5 rounded"
            style={{ color: c, background: c + '15', letterSpacing: '0.06em' }}>
        {voteLabel}
      </span>
    </div>
  );
}

function ItemStatus({ status }: { status: string }) {
  const c = ITEM_STATUS[status] ?? ITEM_STATUS.pendente;
  return (
    <span className="text-[10px] font-mono-jet font-semibold px-2 py-0.5 rounded-md flex-shrink-0"
          style={{ background: c.bg, color: c.color }}>
      {c.label.toUpperCase()}
    </span>
  );
}
