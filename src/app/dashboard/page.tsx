'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { useVoting } from '@/hooks/useVoting';
import api from '@/lib/api';
import {
  Play, Square, Eye, EyeOff, Clock, ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';

const MEDIA = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');

const VOTO_COLORS = {
  sim: { bg: 'oklch(0.50 0.15 155)', light: 'rgba(34,197,94,0.12)', text: '#16a34a' },
  nao: { bg: 'oklch(0.52 0.20 25)', light: 'rgba(239,68,68,0.12)', text: '#dc2626' },
  abstencao: { bg: 'oklch(0.60 0.02 250)', light: 'rgba(100,116,139,0.12)', text: '#475569' },
};

interface SessionInfo { id: string; number: number; type: string; }

export default function VotacaoAoVivoPage() {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [presentes, setPresentes] = useState(0);
  const [timer, setTimer] = useState(0);

  const { socket, connected } = useSocket(sessionId);
  const { agenda, activeItem, counts, voteLog, loading, openVoting, closeVoting } = useVoting(sessionId, socket);

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
    return () => socket.off('quorum:updated', handler);
  }, [socket, sessionId]);

  useEffect(() => {
    if (!activeItem) { setTimer(0); return; }
    // Votação encerrada — mostra duração total fixa
    if (activeItem.status !== 'em_votacao' && activeItem.votingOpenedAt && activeItem.votingClosedAt) {
      setTimer(Math.floor(
        (new Date(activeItem.votingClosedAt).getTime() - new Date(activeItem.votingOpenedAt).getTime()) / 1000
      ));
      return;
    }
    const startMs = activeItem.votingOpenedAt
      ? new Date(activeItem.votingOpenedAt).getTime()
      : Date.now();
    const tick = () => setTimer(Math.floor((Date.now() - startMs) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeItem?.id, activeItem?.status]);

  const mm = String(Math.floor(timer / 60)).padStart(2, '0');
  const ss = String(timer % 60).padStart(2, '0');
  const totalVotos = counts.sim + counts.nao + counts.abstencao;
  const isPresidente = user?.role === 'presidente';

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
          {/* Hero card — item em votação */}
          <div className="rounded-2xl p-6 relative overflow-hidden"
               style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
            {activeItem && (
              <div className="absolute inset-0 pointer-events-none"
                   style={{ background: 'radial-gradient(600px 200px at 85% 0%, rgba(82,130,255,0.06), transparent 60%)' }} />
            )}
            <div className="flex items-start gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <StatusBadge status={activeItem ? 'em_votacao' : 'aguardando'} />
                  {activeItem && (
                    <>
                      <Chip mono>{activeItem.number}</Chip>
                      <Chip>{activeItem.type}</Chip>
                      <Chip icon={activeItem.votingType === 'secreta' ? <EyeOff size={10} /> : <Eye size={10} />}>
                        {activeItem.votingType === 'secreta' ? 'Secreta' : 'Aberta'}
                      </Chip>
                    </>
                  )}
                </div>
                <h1 className="font-tight font-semibold text-gray-900 text-2xl tracking-tight leading-tight mb-2">
                  {activeItem?.title ?? 'Aguardando abertura da votação'}
                </h1>
                {activeItem && (
                  <p className="text-sm text-gray-500 leading-relaxed max-w-2xl mb-3">
                    {activeItem.description}
                  </p>
                )}
                {activeItem?.authorUser && (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                         style={{ background: 'oklch(0.52 0.16 255)' }}>
                      {activeItem.authorUser.initials}
                    </div>
                    <span className="text-xs text-gray-500">
                      <span className="font-semibold text-gray-700">{activeItem.authorUser.name}</span>
                      {' '}· {activeItem.authorUser.party}
                    </span>
                  </div>
                )}
              </div>

              {/* Timer + controles */}
              <div className="flex flex-col items-end gap-3 flex-shrink-0">
                <div className="text-right">
                  <div className="font-mono-jet font-medium text-gray-900"
                       style={{ fontSize: 52, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {mm}:{ss}
                  </div>
                  <div className="text-[10px] font-mono-jet tracking-widest mt-1"
                       style={{ color: '#8A94A2', letterSpacing: '0.08em' }}>
                    TEMPO EM VOTAÇÃO
                  </div>
                </div>
                {isPresidente && (
                  <div className="flex gap-2">
                    {activeItem?.status !== 'em_votacao' && agenda.some(i => i.status === 'pendente') && (
                      <button
                        onClick={() => {
                          const next = agenda.find(i => i.status === 'pendente');
                          if (next) openVoting(next.id);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white"
                        style={{ background: 'oklch(0.52 0.16 255)' }}>
                        <Play size={13} /> Abrir votação
                      </button>
                    )}
                    {activeItem?.status === 'em_votacao' && (
                      <button
                        onClick={() => closeVoting(activeItem.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white"
                        style={{ background: 'oklch(0.52 0.20 25)' }}>
                        <Square size={13} /> Encerrar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Grid: plenário + resultado + auditoria */}
          <div className="grid gap-5 grid-cols-1 lg:grid-cols-[1fr_300px]">
            {/* Grid de vereadores */}
            <div className="rounded-2xl overflow-hidden"
                 style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
              <div className="flex items-center gap-3 px-5 py-3.5"
                   style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                <span className="text-sm font-semibold text-gray-800">Plenário</span>
                <span className="text-xs font-mono-jet text-gray-400">
                  {totalVotos}/{presentes} votaram
                </span>
                <div className="ml-auto h-1.5 rounded-full overflow-hidden" style={{ width: 140, background: '#EFF1F4' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                       style={{ width: `${presentes ? (totalVotos / presentes) * 100 : 0}%`, background: 'oklch(0.52 0.16 255)' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3">
                {voteLog.slice(0, 9).concat(
                  Array.from({ length: Math.max(0, 9 - voteLog.length) }, (_, i) => null) as any
                ).map((v, i) => (
                  <VereadorCell key={i} event={v} index={i} />
                ))}
              </div>
            </div>

            {/* Resultado + auditoria */}
            <div className="flex flex-col gap-4">
              {/* Contagem */}
              <div className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
                <p className="text-[10px] font-mono-jet tracking-widest mb-4"
                   style={{ color: '#8A94A2', letterSpacing: '0.08em' }}>
                  {activeItem?.status === 'aprovado' || activeItem?.status === 'rejeitado' ? 'RESULTADO FINAL' : 'RESULTADO PARCIAL'}
                </p>
                <div className="flex flex-col gap-3">
                  <VoteBar label="SIM" count={counts.sim} total={presentes} color="oklch(0.50 0.15 155)" />
                  <VoteBar label="NÃO" count={counts.nao} total={presentes} color="oklch(0.52 0.20 25)" />
                  <VoteBar label="ABSTENÇÃO" count={counts.abstencao} total={presentes} color="oklch(0.60 0.02 250)" />
                </div>
                {(activeItem?.status === 'aprovado' || activeItem?.status === 'rejeitado') && (
                  <div className="mt-4 p-3 rounded-xl"
                       style={{
                         background: activeItem.status === 'aprovado' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                         border: `1px solid ${activeItem.status === 'aprovado' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                       }}>
                    <div className="text-[10px] font-mono-jet tracking-wider mb-1" style={{ color: '#8A94A2' }}>RESULTADO</div>
                    <div className="font-tight font-bold text-xl tracking-tight"
                         style={{ color: activeItem.status === 'aprovado' ? '#16a34a' : '#dc2626' }}>
                      {activeItem.status === 'aprovado' ? 'APROVADO' : 'REPROVADO'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {counts.sim} a {counts.nao} · {counts.abstencao} abstenção(ões)
                    </div>
                  </div>
                )}
              </div>

              {/* Feed de auditoria */}
              <div className="rounded-2xl p-4 flex-1" style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
                <p className="text-[10px] font-mono-jet tracking-widest mb-3"
                   style={{ color: '#8A94A2', letterSpacing: '0.08em' }}>
                  AUDITORIA · EVENTOS
                </p>
                <div className="flex flex-col gap-0">
                  {voteLog.length === 0 && (
                    <p className="text-xs text-gray-400 font-mono-jet">Aguardando votos…</p>
                  )}
                  {voteLog.slice(0, 6).map((e, i) => (
                    <div key={i} className="flex items-center gap-2 py-2"
                         style={{ borderBottom: i < Math.min(voteLog.length, 6) - 1 ? '1px dashed rgba(15,23,42,0.08)' : 'none' }}>
                      <span className="font-mono-jet text-[10px]" style={{ color: '#8A94A2' }}>
                        {new Date().toTimeString().slice(0, 8)}
                      </span>
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
                      <span className="font-mono-jet text-[9px]" style={{ color: '#8A94A2' }}>{e.hash}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Pauta da sessão */}
          <div className="rounded-2xl overflow-hidden"
               style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
            <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
              <span className="text-sm font-semibold text-gray-800">Ordem do dia · {agenda.length} itens</span>
            </div>
            {agenda.map((item, i) => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-3.5"
                   style={{ borderBottom: i < agenda.length - 1 ? '1px solid rgba(15,23,42,0.06)' : 'none',
                            background: item.status === 'em_votacao' ? 'rgba(82,130,255,0.03)' : 'transparent' }}>
                <span className="font-mono-jet text-xs w-7 text-right flex-shrink-0" style={{ color: '#8A94A2' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-mono-jet text-xs font-semibold flex-shrink-0 w-28" style={{ color: '#4B5563' }}>
                  {item.number}
                </span>
                <span className="text-sm text-gray-800 font-medium flex-1 truncate">{item.title}</span>
                <span className="text-xs text-gray-400 hidden lg:block">{item.authorName}</span>
                <ItemStatus status={item.status} />
                {isPresidente && item.status === 'pendente' && !activeItem && (
                  <button onClick={() => openVoting(item.id)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white flex-shrink-0"
                    style={{ background: 'oklch(0.52 0.16 255)' }}>
                    Abrir
                  </button>
                )}
              </div>
            ))}
            {loading && (
              <div className="px-5 py-4 text-sm text-gray-400 font-mono-jet">Carregando pauta…</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NoSessionCard() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <Clock size={40} style={{ color: '#8A94A2' }} />
      <h2 className="font-tight font-semibold text-xl text-gray-700">Nenhuma sessão em andamento</h2>
      <p className="text-sm text-gray-400 max-w-sm">
        Crie e inicie uma sessão pelo Swagger ou aguarde o presidente iniciar a sessão do dia.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    aguardando: { label: 'Aguardando abertura', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    em_votacao: { label: 'Em votação', color: 'oklch(0.52 0.16 255)', bg: 'rgba(82,130,255,0.1)' },
    encerrada: { label: 'Encerrada', color: '#475569', bg: 'rgba(100,116,139,0.1)' },
  }[status] ?? { label: status, color: '#475569', bg: 'rgba(100,116,139,0.1)' };

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
  const pct = total ? (count / total) * 100 : 0;
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

function VereadorCell({ event, index }: { event: any; index: number }) {
  if (!event) return (
    <div className="p-3 flex items-center gap-2.5" style={{ background: '#fff', borderBottom: '1px solid rgba(15,23,42,0.04)' }}>
      <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ background: '#EFF1F4' }} />
      <div className="flex-1">
        <div className="h-2 w-20 rounded mb-1" style={{ background: '#EFF1F4' }} />
        <div className="h-1.5 w-12 rounded" style={{ background: '#F6F7F9' }} />
      </div>
    </div>
  );

  const colorMap: Record<string, string> = { sim: '#16a34a', nao: '#dc2626', abstencao: '#475569', secreta: 'oklch(0.52 0.16 255)' };
  const c = colorMap[event.choice] || '#8A94A2';
  const voteLabel = event.choice !== 'secreta' ? event.choice.toUpperCase() : '●●●';

  const avatarColors = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#EC4899'];
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
      {/* Avatar com foto real */}
      <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold"
           style={{ background: avatarSrc ? 'transparent' : avatarBg, color: '#fff' }}>
        {avatarSrc
          ? <img src={avatarSrc} alt={event.userName}
                 style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : initials}
      </div>
      {/* Nome + partido */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-gray-800 truncate">{displayName}</div>
        {event.userParty && (
          <div className="text-[10px] font-mono-jet truncate" style={{ color: '#8A94A2' }}>{event.userParty}</div>
        )}
      </div>
      {/* Voto */}
      <span className="text-[10px] font-mono-jet font-bold flex-shrink-0 px-2 py-0.5 rounded"
            style={{ color: c, background: c + '15', letterSpacing: '0.06em' }}>
        {voteLabel}
      </span>
    </div>
  );
}

function ItemStatus({ status }: { status: string }) {
  const cfg: Record<string, any> = {
    pendente: { label: 'Pendente', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    em_votacao: { label: 'Em votação', color: 'oklch(0.52 0.16 255)', bg: 'rgba(82,130,255,0.1)' },
    aprovado: { label: 'Aprovado', color: '#16a34a', bg: 'rgba(34,197,94,0.1)' },
    rejeitado: { label: 'Reprovado', color: '#dc2626', bg: 'rgba(239,68,68,0.1)' },
    retirado: { label: 'Retirado', color: '#475569', bg: 'rgba(100,116,139,0.1)' },
  };
  const c = cfg[status] ?? cfg.pendente;
  return (
    <span className="text-[10px] font-mono-jet font-semibold px-2 py-0.5 rounded-md flex-shrink-0"
          style={{ background: c.bg, color: c.color }}>
      {c.label.toUpperCase()}
    </span>
  );
}
