'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useVoting } from '@/hooks/useVoting';
import { useVotingSounds } from '@/hooks/useVotingSounds';
import { useExpedienteSounds } from '@/hooks/useExpedienteSounds';
import { useExpediente, ExpedienteAtivo, AparteAtivo } from '@/hooks/useExpediente';
import { Video, Volume2 } from 'lucide-react';
import { fullSessionTitle } from '@/lib/sessionTitle';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const MEDIA = API.replace('/api', '');

interface VereadorPresente {
  id: string; name: string; initials: string; avatarUrl: string | null; party: string | null; role: string;
}
interface SessionInfo { id: string; number: number; type: string; date: string; chamberId: string; startedAt?: string | null; youtubeUrl?: string | null; youtubeThumbnailUrl?: string | null; }
interface ChamberInfo { id: string; name: string; city: string; state: string; logoUrl?: string | null; bienioInicio?: number | null; bienioFim?: number | null; anoBienio?: number | null; }

export default function TelaoPage() {
  const [mounted, setMounted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [chamberInfo, setChamberInfo] = useState<ChamberInfo | null>(null);
  const [timer, setTimer] = useState(0);
  const [sessionTimer, setSessionTimer] = useState(0);

  useEffect(() => { setMounted(true); }, []);
  const [vereadores, setVereadores] = useState<VereadorPresente[]>([]);
  const [presentes, setPresentes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('sessionId') || localStorage.getItem('telao_session');
    if (sid) setSessionId(sid);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`${API}/sessions/${sessionId}`)
      .then(r => r.ok ? r.json() : null)
      .then(async (s: SessionInfo | null) => {
        if (!s) return;
        setSessionInfo(s);
        if (s.chamberId) {
          const cr = await fetch(`${API}/chambers/${s.chamberId}`);
          if (cr.ok) setChamberInfo(await cr.json());
        }
      })
      .catch(() => {});
  }, [sessionId]);

  const { socket, connected } = useSocket(sessionId);
  const { activeItem, counts, voteLog } = useVoting(sessionId, socket);
  const { expedienteAtivo, aparteAtivo } = useExpediente(sessionId);
  const { needsActivation: soundNeedsActivation, activate: activateSound } = useVotingSounds(socket);
  const { needsActivation: expedienteSoundNeedsActivation } = useExpedienteSounds(socket);
  const anySoundNeedsActivation = soundNeedsActivation || expedienteSoundNeedsActivation;

  // Controla exibição do resultado: true por 8s após voting:closed, depois volta ao quórum
  const [resultVisible, setResultVisible] = useState(false);
  useEffect(() => {
    if (!socket) return;
    const onClosed = () => {
      setResultVisible(true);
      setTimeout(() => setResultVisible(false), 8000);
    };
    socket.on('voting:closed', onClosed);
    return () => { socket.off('voting:closed', onClosed); };
  }, [socket]);

  // Mapa userId → choice, derivado do voteLog
  const votesMap = useMemo(() => {
    const m: Record<string, string> = {};
    voteLog.forEach(v => { m[v.userId] = v.choice; });
    return m;
  }, [voteLog]);

  // Fetch quorum data — all chamber members + who confirmed presence
  const fetchQuorum = useCallback(async () => {
    if (!sessionId || !sessionInfo?.chamberId) return;
    try {
      const [membersRes, presRes] = await Promise.all([
        fetch(`${API}/users/chamber/${sessionInfo.chamberId}`),
        fetch(`${API}/sessions/${sessionId}/presences`),
      ]);
      if (membersRes.ok) {
        const members: VereadorPresente[] = await membersRes.json();
        setVereadores(
          members
            .filter(u => (u.role === 'vereador' || u.role === 'presidente') && (u as any).isActive !== false)
            .sort((a, b) => {
              if (a.role === 'presidente' && b.role !== 'presidente') return -1;
              if (a.role !== 'presidente' && b.role === 'presidente') return 1;
              return a.name.localeCompare(b.name, 'pt-BR');
            })
        );
      }
      if (presRes.ok) {
        const presencas: { userId: string }[] = await presRes.json();
        setPresentes(new Set(presencas.map(p => p.userId)));
      }
    } catch { /* silently ignore */ }
  }, [sessionId, sessionInfo?.chamberId]);

  const fetchSessionInfo = useCallback(async () => {
    if (!sessionId) return;
    try {
      const r = await fetch(`${API}/sessions/${sessionId}`);
      if (r.ok) setSessionInfo(await r.json());
    } catch { /* silently ignore */ }
  }, [sessionId]);

  useEffect(() => { fetchQuorum(); }, [fetchQuorum]);

  // Resync all data on every socket (re)connection
  useEffect(() => {
    if (!socket) return;
    const onConnect = () => {
      fetchQuorum();
      fetchSessionInfo();
    };
    socket.on('connect', onConnect);
    return () => { socket.off('connect', onConnect); };
  }, [socket, fetchQuorum, fetchSessionInfo]);

  // Refresh sessionInfo every 30s (YouTube URL/thumbnail changes)
  useEffect(() => {
    if (!sessionId) return;
    const id = setInterval(fetchSessionInfo, 30_000);
    return () => clearInterval(id);
  }, [sessionId, fetchSessionInfo]);

  // Refresh quorum every 30s as safety net
  useEffect(() => {
    if (!sessionId) return;
    const id = setInterval(fetchQuorum, 30_000);
    return () => clearInterval(id);
  }, [sessionId, fetchQuorum]);

  // Atualiza quórum em tempo real — atualização instantânea via userId + fetch de segurança
  useEffect(() => {
    if (!socket) return;
    const onQuorumUpdated = (data: { userId?: string; action?: 'added' | 'removed' }) => {
      if (data.userId && data.action) {
        setPresentes(prev => {
          const next = new Set(prev);
          if (data.action === 'added') next.add(data.userId!);
          else next.delete(data.userId!);
          return next;
        });
      }
      fetchQuorum();
    };
    socket.on('quorum:updated', onQuorumUpdated);
    return () => { socket.off('quorum:updated', onQuorumUpdated); };
  }, [socket, fetchQuorum]);

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

  // Session elapsed timer — counts up from startedAt
  useEffect(() => {
    if (!sessionInfo?.startedAt) { setSessionTimer(0); return; }
    const startMs = new Date(sessionInfo.startedAt).getTime();
    const tick = () => setSessionTimer(Math.floor((Date.now() - startMs) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sessionInfo?.startedAt]);

  const mm = String(Math.floor(timer / 60)).padStart(2, '0');
  const ss = String(timer % 60).padStart(2, '0');
  const smm = String(Math.floor(sessionTimer / 60)).padStart(2, '0');
  const sss = String(sessionTimer % 60).padStart(2, '0');
  const total = counts.sim + counts.nao + counts.abstencao;
  const isApproved = activeItem?.status === 'aprovado';
  const isRejected = activeItem?.status === 'rejeitado';

  if (!mounted) return null;

  // Priority: expediente > voting > quorum
  if (expedienteAtivo) {
    return (
      <TelaoExpediente
        expediente={expedienteAtivo}
        aparte={aparteAtivo}
        connected={connected}
        chamberInfo={chamberInfo}
      />
    );
  }

  // Quorum screen: sem votação ativa E sem resultado sendo exibido
  const showVoting = activeItem && (activeItem.status === 'em_votacao' || resultVisible);
  if (!showVoting) {
    return (
      <TelaoQuorum
        vereadores={vereadores}
        presentes={presentes}
        connected={connected}
        mm={smm}
        ss={sss}
        sessionInfo={sessionInfo}
        chamberInfo={chamberInfo}
      />
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden"
         style={{ background: '#0B0D10', color: '#E9EDF2', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Banner pra ativar som (autoplay bloqueado pelo browser) */}
      {anySoundNeedsActivation && (
        <button
          onClick={activateSound}
          className="flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm"
          style={{
            position: 'fixed', top: 16, right: 16, zIndex: 50,
            background: '#F59E0B', color: '#0B0D10', border: 'none',
            cursor: 'pointer', animation: 'pulse-dot 2s ease-in-out infinite',
          }}
        >
          <Volume2 size={16} />
          Clique para ativar o som
        </button>
      )}

      {/* Topbar */}
      <div className="flex items-center gap-5 px-10 flex-shrink-0"
           style={{ minHeight: 80, borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111418' }}>
        <Brasao size={44} color="oklch(0.52 0.16 255)" chamberInfo={chamberInfo} />
        <div>
          <div className="text-[11px] font-mono-jet tracking-widest" style={{ color: '#5B636D', letterSpacing: '0.1em' }}>
            {chamberInfo ? `${chamberInfo.name.toUpperCase()} · ${chamberInfo.state.toUpperCase()}` : 'CÂMARA MUNICIPAL'}
          </div>
          <div className="font-tight font-semibold text-[15px] mt-0.5" style={{ letterSpacing: '-0.02em' }}>
            {sessionInfo ? fullSessionTitle(sessionInfo.number, sessionInfo.type, chamberInfo) : 'Sessão em andamento'}
          </div>
          {sessionInfo && (
            <div className="text-[11px] font-mono-jet mt-0.5 flex items-center gap-2" style={{ color: '#5B636D' }}>
              <span>
                {new Date(sessionInfo.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
              {sessionInfo.startedAt && (
                <>
                  <span style={{ color: '#3B4451' }}>·</span>
                  <span>Iniciada às {new Date(sessionInfo.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-6">
          <StatTop label="QUÓRUM" value={`${presentes.size}/${vereadores.length || '?'}`} />
          <div className="w-px h-9" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <StatTop label="VOTARAM" value={`${total}`} />
          <div className="w-px h-9" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div>
            <div className="text-[10px] font-mono-jet tracking-widest" style={{ color: '#5B636D', letterSpacing: '0.1em' }}>TEMPO</div>
            <div className="font-mono-jet font-medium text-2xl mt-0.5" style={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {mm}:{ss}
            </div>
          </div>
          <ConnectionBadge connected={connected} />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden" style={{ gap: 1, background: 'rgba(255,255,255,0.04)' }}>
        <div className="flex flex-col gap-8 p-12 relative overflow-hidden" style={{ flex: '1.15', background: '#0B0D10' }}>
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: 'radial-gradient(700px 400px at 20% 80%, rgba(82,130,255,0.08), transparent 60%)' }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              {activeItem ? (
                <>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono-jet font-semibold px-3 py-1.5 rounded-full"
                        style={{ background: 'rgba(82,130,255,0.15)', color: 'oklch(0.52 0.16 255)' }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot inline-block" style={{ background: 'oklch(0.52 0.16 255)' }} />
                    EM VOTAÇÃO
                  </span>
                  <span className="text-sm font-mono-jet" style={{ color: '#5B636D' }}>
                    {activeItem.number} · {activeItem.type.toUpperCase()}
                  </span>
                </>
              ) : (
                <span className="text-[11px] font-mono-jet font-semibold px-3 py-1.5 rounded-full"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                  AGUARDANDO ABERTURA
                </span>
              )}
            </div>
            <div className="text-[13px] font-mono-jet mb-2" style={{ color: '#5B636D', letterSpacing: '0.08em' }}>EM VOTAÇÃO</div>
            <h1 className="font-tight font-semibold leading-tight mb-4"
                style={{ fontSize: 44, letterSpacing: '-0.03em', lineHeight: 1.1, maxWidth: 760 }}>
              {activeItem?.title}
            </h1>
            {activeItem?.description && (
              <p style={{ fontSize: 16, color: '#9AA3AE', lineHeight: 1.5, maxWidth: 640 }}>{activeItem.description}</p>
            )}
            {activeItem && (
              <div className="flex items-center gap-2 mt-4 text-sm" style={{ color: '#9AA3AE' }}>
                <span className="font-mono-jet text-xs tracking-wider" style={{ color: '#5B636D', letterSpacing: '0.08em' }}>AUTORIA</span>
                <span className="font-medium" style={{ color: '#E9EDF2' }}>{activeItem.authorName}</span>
              </div>
            )}
          </div>
          <StreamCard sessionInfo={sessionInfo} />
        </div>
        <div className="flex flex-col gap-5 p-12" style={{ flex: 1, background: '#07090B' }}>
          <div className="text-[12px] font-mono-jet tracking-widest" style={{ color: '#5B636D', letterSpacing: '0.1em' }}>
            RESULTADO {isApproved || isRejected ? 'FINAL' : 'PARCIAL'}
          </div>
          <BigCount label="SIM" count={counts.sim} color="oklch(0.70 0.16 150)" />
          <BigCount label="NÃO" count={counts.nao} color="oklch(0.68 0.20 25)" />
          <BigCount label="ABSTENÇÃO" count={counts.abstencao} color="oklch(0.70 0.02 250)" />
          {(isApproved || isRejected) && (
            <div className="p-5 rounded-2xl"
                 style={{ background: isApproved ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                           border: `2px solid ${isApproved ? 'oklch(0.70 0.16 150)' : 'oklch(0.68 0.20 25)'}` }}>
              <div className="text-[12px] font-mono-jet tracking-wider mb-1" style={{ color: '#5B636D', letterSpacing: '0.1em' }}>RESULTADO</div>
              <div className="font-tight font-bold"
                   style={{ fontSize: 40, letterSpacing: '-0.03em', lineHeight: 1.05,
                            color: isApproved ? 'oklch(0.70 0.16 150)' : 'oklch(0.68 0.20 25)' }}>
                {isApproved ? 'APROVADO' : 'REPROVADO'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom ticker — todos os vereadores presentes */}
      <VotoTicker vereadores={vereadores} presentes={presentes} votesMap={votesMap} />
    </div>
  );
}

/* ── Tela Expediente ─────────────────────────────────────── */
function TelaoExpediente({ expediente, aparte, connected, chamberInfo }: {
  expediente: ExpedienteAtivo; aparte: AparteAtivo | null; connected: boolean;
  chamberInfo?: ChamberInfo | null;
}) {
  const { vereador, tipo, tempoRestante, duracao, paused } = expediente;
  const m = Math.floor(tempoRestante / 60);
  const s = tempoRestante % 60;
  const pct = Math.max(0, tempoRestante / duracao);
  const urgente = pct <= 0.2 && !paused;
  const timerColor = paused ? '#f59e0b' : urgente ? '#ef4444' : pct <= 0.5 ? '#f59e0b' : '#22c55e';
  const timerGlow = paused ? '#f59e0b80' : urgente ? '#ef444460' : pct <= 0.5 ? '#f59e0b50' : '#22c55e40';

  const arcW = 440;

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden"
         style={{ background: '#080A0E', color: '#E9EDF2', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Topbar */}
      <div className="flex items-center gap-5 px-10 flex-shrink-0"
           style={{ height: 68, borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0E1117' }}>
        <Brasao size={36} color="oklch(0.52 0.16 255)" chamberInfo={chamberInfo} />
        <div>
          <div className="text-[10px] font-mono-jet tracking-widest" style={{ color: '#4B5563', letterSpacing: '0.1em' }}>
            {chamberInfo ? `${chamberInfo.name.toUpperCase()} · ${chamberInfo.state.toUpperCase()}` : 'CÂMARA MUNICIPAL'}
          </div>
          <div className="font-semibold text-sm mt-0.5 flex items-center gap-2" style={{ letterSpacing: '-0.01em' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: 'oklch(0.52 0.16 255)' }} />
            {tipo === 'grande' ? 'Grande Expediente' : 'Pequeno Expediente'}
          </div>
        </div>
        <div className="ml-auto"><ConnectionBadge connected={connected} /></div>
      </div>

      {/* Main body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — speaker photo (hero) */}
        <div className="relative overflow-hidden" style={{ flex: '1.15' }}>
          {/* Photo */}
          {vereador.avatarUrl ? (
            <img src={`${MEDIA}${vereador.avatarUrl}`} alt={vereador.name}
                 className="absolute inset-0 w-full h-full object-cover object-top" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center"
                 style={{ background: 'linear-gradient(160deg, #1a1f2e 0%, #0d1117 100%)' }}>
              <AvatarFallback name={vereador.name} initials={vereador.initials} size={280} />
            </div>
          )}

          {/* Gradient overlay — bottom fade for name readability */}
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 40%, transparent 70%)' }} />

          {/* Top-left type badge */}
          <div className="absolute top-8 left-8 flex items-center gap-2 px-4 py-2 rounded-full"
               style={{ background: 'oklch(0.52 0.16 255 / 0.18)', border: '1px solid oklch(0.52 0.16 255 / 0.35)', backdropFilter: 'blur(8px)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: 'oklch(0.70 0.16 255)' }} />
            <span className="text-xs font-mono-jet font-semibold tracking-widest"
                  style={{ color: 'oklch(0.80 0.14 255)', letterSpacing: '0.1em' }}>
              {tipo === 'grande' ? 'GRANDE EXPEDIENTE' : 'PEQUENO EXPEDIENTE'}
            </span>
          </div>

          {/* Bottom name block */}
          <div className="absolute bottom-0 left-0 right-0 px-10 pb-10">
            {vereador.title && (
              <p className="text-sm font-mono-jet mb-1" style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em' }}>
                {vereador.title.toUpperCase()}
              </p>
            )}
            <h2 className="font-tight font-black leading-none" style={{ fontSize: 58, letterSpacing: '-0.03em', color: '#FFFFFF' }}>
              {vereador.name}
            </h2>
            {vereador.party && (
              <p className="mt-2 font-mono-jet font-semibold text-base" style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em' }}>
                {vereador.party}
              </p>
            )}
          </div>

          {/* Aparte overlay */}
          {aparte && (
            <div className="absolute bottom-8 left-8 right-8 rounded-2xl p-5 flex items-center gap-4"
                 style={{ background: 'rgba(0,20,10,0.92)', border: '1px solid #14532d', backdropFilter: 'blur(12px)' }}>
              <div className="flex-1">
                <span className="text-[10px] font-mono-jet font-semibold px-2 py-0.5 rounded-full inline-block mb-1"
                      style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', letterSpacing: '0.08em' }}>APARTE</span>
                <p className="text-white font-semibold">{aparte.vereador.name}</p>
              </div>
              <div className="font-mono-jet font-bold text-4xl" style={{ color: '#34d399', fontVariantNumeric: 'tabular-nums' }}>
                {String(Math.floor(aparte.tempoRestante / 60)).padStart(2, '0')}:{String(aparte.tempoRestante % 60).padStart(2, '0')}
              </div>
            </div>
          )}
        </div>

        {/* Right — timer */}
        <div className="flex flex-col items-center justify-center relative overflow-hidden"
             style={{ flex: 1, background: '#07090C', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `radial-gradient(600px 400px at 50% 45%, ${timerGlow}, transparent 70%)`,
            transition: 'background 0.5s',
          }} />

          {/* Status label */}
          <div className="relative mb-6 text-[11px] font-mono-jet tracking-widest"
               style={{ color: paused ? '#f59e0b' : '#ffffff', letterSpacing: '0.14em' }}>
            {paused ? '⏸ PAUSADO · APARTE EM ANDAMENTO' : 'TEMPO RESTANTE'}
          </div>

          {/* Timer number */}
          <div className="relative font-mono-jet font-black"
               style={{
                 fontSize: 148,
                 fontVariantNumeric: 'tabular-nums',
                 lineHeight: 0.9,
                 letterSpacing: '-0.05em',
                 color: timerColor,
                 transition: 'color 0.5s',
                 textShadow: `0 0 80px ${timerGlow}, 0 0 20px ${timerGlow}`,
               }}>
            {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
          </div>

          {/* Status sub-label */}
          <div style={{ height: 28, display: 'flex', alignItems: 'center', marginTop: 12 }}>
            {urgente && (
              <div className="text-sm font-mono-jet font-bold animate-pulse"
                   style={{ color: '#ef4444', letterSpacing: '0.16em' }}>● ENCERRANDO</div>
            )}
          </div>

          {/* Progress bar — straight line below timer */}
          <div className="relative mt-6" style={{ width: arcW, height: 10 }}>
            <svg width={arcW} height={10}>
              {/* Track */}
              <line x1="0" y1="5" x2={arcW} y2="5"
                    stroke="rgba(255,255,255,0.08)" strokeWidth="6" strokeLinecap="round" />
              {/* Filled */}
              <line x1="0" y1="5" x2={arcW} y2="5"
                    stroke={timerColor} strokeWidth="6" strokeLinecap="round"
                    pathLength="100"
                    strokeDasharray={`${pct * 100} 100`}
                    style={{ transition: 'stroke-dasharray 0.9s linear, stroke 0.5s',
                             filter: `drop-shadow(0 0 6px ${timerColor})` }} />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Tela Quórum ──────────────────────────────────────────── */
function TelaoQuorum({ vereadores, presentes, connected, mm, ss, sessionInfo, chamberInfo }: {
  vereadores: VereadorPresente[]; presentes: Set<string>;
  connected: boolean; mm: string; ss: string;
  sessionInfo?: SessionInfo | null; chamberInfo?: ChamberInfo | null;
}) {
  const presentCount = vereadores.filter(v => presentes.has(v.id)).length;
  const total = vereadores.length;
  const pct = total > 0 ? Math.round((presentCount / total) * 100) : 0;
  const quorumOk = pct >= 50;

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden"
         style={{ background: '#0B0D10', color: '#E9EDF2', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Topbar */}
      <div className="flex items-center gap-5 px-10 flex-shrink-0"
           style={{ minHeight: 110, borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111418' }}>
        <Brasao size={80} color="oklch(0.52 0.16 255)" chamberInfo={chamberInfo} />
        <div>
          <div className="font-mono-jet font-semibold tracking-widest" style={{ fontSize: 14, color: '#7A8494', letterSpacing: '0.12em' }}>
            {chamberInfo ? `${chamberInfo.name.toUpperCase()} · ${chamberInfo.state.toUpperCase()}` : 'CÂMARA MUNICIPAL'}
          </div>
          <div className="font-tight font-bold mt-1" style={{ fontSize: 22, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
            {sessionInfo ? fullSessionTitle(sessionInfo.number, sessionInfo.type, chamberInfo) : 'Verificação de Quórum'}
          </div>
          {sessionInfo && (
            <div className="font-mono-jet mt-1 flex items-center gap-2" style={{ fontSize: 13, color: '#7A8494' }}>
              <span>
                {new Date(sessionInfo.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
              {sessionInfo.startedAt && (
                <>
                  <span style={{ color: '#3B4451' }}>·</span>
                  <span>Iniciada às {new Date(sessionInfo.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-6">
          <StatTop label="PRESENTES" value={`${presentCount}/${total}`} />
          <div className="w-px h-9" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div>
            <div className="text-[10px] font-mono-jet" style={{ color: '#5B636D', letterSpacing: '0.1em' }}>QUÓRUM</div>
            <div className="font-tight font-semibold text-2xl mt-0.5"
                 style={{ color: quorumOk ? 'oklch(0.70 0.16 150)' : 'oklch(0.68 0.20 25)', letterSpacing: '-0.02em' }}>
              {pct}%
            </div>
          </div>
          <div className="w-px h-9" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div>
            <div className="text-[10px] font-mono-jet" style={{ color: '#5B636D', letterSpacing: '0.1em' }}>TEMPO</div>
            <div className="font-mono-jet font-medium text-2xl mt-0.5" style={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {mm}:{ss}
            </div>
          </div>
          <ConnectionBadge connected={connected} />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-10">
        {vereadores.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="font-mono-jet text-lg" style={{ color: '#5B636D' }}>Aguardando vereadores...</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {vereadores.map(v => {
              const presente = presentes.has(v.id);
              const avatarSrc = v.avatarUrl
                ? (v.avatarUrl.startsWith('http') ? v.avatarUrl : `${MEDIA}${v.avatarUrl}`)
                : null;
              return (
                <div key={v.id} className="rounded-2xl flex flex-col items-center"
                     style={{ padding: '24px 18px 18px',
                              background: presente ? '#0a1f12' : '#14171D',
                              border: `1px solid ${presente ? 'rgba(34,197,94,0.30)' : 'rgba(255,255,255,0.07)'}`,
                              boxShadow: presente ? '0 0 0 1px rgba(34,197,94,0.08), 0 6px 24px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
                              gap: 12,
                              transition: 'background 0.6s ease, border-color 0.6s ease, box-shadow 0.6s ease' }}>
                  {/* Avatar */}
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={v.name}
                         style={{ width: 92, height: 92, borderRadius: '50%', objectFit: 'cover',
                                  border: presente ? '3px solid rgba(34,197,94,0.65)' : '3px solid rgba(255,255,255,0.12)',
                                  transition: 'border-color 0.6s ease',
                                  filter: presente ? 'none' : 'grayscale(70%) brightness(0.7)' }} />
                  ) : (
                    <div style={{ width: 92, height: 92, borderRadius: '50%',
                                  background: presente ? 'rgba(34,197,94,0.14)' : '#1E2330',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 28, fontWeight: 800,
                                  color: presente ? '#4ade80' : '#4B5563',
                                  border: presente ? '3px solid rgba(34,197,94,0.45)' : '3px solid rgba(255,255,255,0.09)',
                                  transition: 'all 0.6s ease' }}>
                      {v.initials || v.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  {/* Nome + partido */}
                  <div className="text-center w-full" style={{ gap: 3 }}>
                    <p className="font-semibold leading-snug truncate"
                       style={{ fontSize: 14, color: presente ? '#E9EDF2' : '#7A8494',
                                transition: 'color 0.6s ease' }}>
                      {v.name.split(' ').slice(0, 2).join(' ')}
                    </p>
                    {v.party && (
                      <p className="font-mono-jet mt-1 truncate"
                         style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                                  color: presente ? '#4ade80' : '#404858',
                                  transition: 'color 0.6s ease' }}>
                        {v.party}
                      </p>
                    )}
                  </div>
                  {/* Badge status */}
                  <span className="font-mono-jet font-bold px-3 py-1 rounded-full"
                        style={{ fontSize: 10, letterSpacing: '0.10em',
                                 background: presente ? 'rgba(34,197,94,0.16)' : 'rgba(255,255,255,0.05)',
                                 color: presente ? '#4ade80' : '#5B636D',
                                 border: `1px solid ${presente ? 'rgba(34,197,94,0.32)' : 'rgba(255,255,255,0.09)'}`,
                                 transition: 'all 0.6s ease' }}>
                    {presente ? '● PRESENTE' : 'AUSENTE'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer barra de progresso */}
      <div className="flex-shrink-0 px-10 pb-6">
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full transition-all"
               style={{ width: `${pct}%`, background: quorumOk ? 'oklch(0.70 0.16 150)' : 'oklch(0.68 0.20 25)',
                         transition: 'width 1s ease, background 0.5s' }} />
        </div>
        <p className="text-xs font-mono-jet mt-2 text-center"
           style={{ color: quorumOk ? 'oklch(0.70 0.16 150)' : 'oklch(0.68 0.20 25)', letterSpacing: '0.06em' }}>
          {quorumOk ? `QUÓRUM ATINGIDO · ${presentCount} de ${total} vereadores presentes` : `QUÓRUM INSUFICIENTE · ${presentCount} de ${total} · necessário > 50%`}
        </p>
      </div>
    </div>
  );
}

/* ── Card de transmissão ─────────────────────────────────── */
function StreamCard({ sessionInfo }: { sessionInfo?: SessionInfo | null }) {
  const youtubeUrl = sessionInfo?.youtubeUrl;
  const rawThumb = sessionInfo?.youtubeThumbnailUrl;
  const thumbnailUrl = (rawThumb
    ? (rawThumb.startsWith('http') ? rawThumb : `${MEDIA}${rawThumb}`)
    : null)
    || (youtubeUrl ? (() => {
        try {
          const u = new URL(youtubeUrl);
          let id: string | null = null;
          if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1).split('?')[0];
          else if (u.hostname.includes('youtube.com')) {
            id = u.pathname.startsWith('/live/')
              ? u.pathname.split('/live/')[1].split('?')[0]
              : u.searchParams.get('v');
          }
          return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : null;
        } catch { return null; }
      })()
    : null);

  const displayUrl = youtubeUrl
    ? youtubeUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\?.*/, '')
    : null;

  if (!youtubeUrl) {
    return (
      <div className="mt-auto rounded-xl p-4 flex items-center gap-3"
           style={{ background: '#15191F', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-28 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
             style={{ background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 8px, transparent 8px 16px)' }}>
          <Video size={22} style={{ color: '#5B636D' }} />
        </div>
        <div>
          <div className="text-[10px] font-mono-jet tracking-widest mb-1"
               style={{ color: '#5B636D', letterSpacing: '0.1em' }}>TRANSMISSÃO</div>
          <div className="text-sm" style={{ color: '#5B636D' }}>Não configurada</div>
        </div>
      </div>
    );
  }

  return (
    <a href={youtubeUrl} target="_blank" rel="noreferrer"
       className="mt-auto rounded-xl p-4 flex items-center gap-3 no-underline group"
       style={{ background: '#15191F', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', textDecoration: 'none' }}>
      {/* Thumbnail */}
      <div className="rounded-lg overflow-hidden flex-shrink-0"
           style={{ width: 112, height: 63, background: '#0D1117', position: 'relative' }}>
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="thumbnail"
               style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
               style={{ background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 8px, transparent 8px 16px)' }}>
            <Video size={22} style={{ color: '#5B636D' }} />
          </div>
        )}
        {/* play overlay */}
        <div className="absolute inset-0 flex items-center justify-center"
             style={{ background: 'rgba(0,0,0,0.35)' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center"
               style={{ background: 'rgba(220,38,38,0.9)' }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
              <path d="M2 1.5 L9 5 L2 8.5 Z" />
            </svg>
          </div>
        </div>
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-mono-jet tracking-widest mb-1"
             style={{ color: '#5B636D', letterSpacing: '0.1em' }}>TRANSMISSÃO AO VIVO · TV CÂMARA</div>
        <div className="text-sm font-medium truncate" style={{ color: '#9AA3AE' }}>{displayUrl}</div>
      </div>
      {/* Live badge */}
      <div className="ml-auto flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full"
           style={{ border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)' }}>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: '#dc2626' }} />
        <span className="text-[10px] font-mono-jet font-bold" style={{ color: '#dc2626', letterSpacing: '0.08em' }}>LIVE</span>
      </div>
    </a>
  );
}

/* ── Ticker de votos ─────────────────────────────────────── */
function VotoTicker({
  vereadores, presentes, votesMap,
}: {
  vereadores: VereadorPresente[];
  presentes: Set<string>;
  votesMap: Record<string, string>;
}) {
  const avatarColors = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#EC4899'];
  const presentList = vereadores.filter(v => presentes.has(v.id));

  if (presentList.length === 0) return (
    <div className="flex-shrink-0 flex items-center justify-center"
         style={{ height: 80, borderTop: '1px solid rgba(255,255,255,0.06)', background: '#111418' }}>
      <span className="font-mono-jet text-xs" style={{ color: '#5B636D', letterSpacing: '0.08em' }}>
        AGUARDANDO VEREADORES...
      </span>
    </div>
  );

  return (
    <div className="flex flex-shrink-0 overflow-hidden"
         style={{ height: 80, borderTop: '1px solid rgba(255,255,255,0.06)', background: '#111418' }}>
      {presentList.map((v, i) => {
        const choice = votesMap[v.id];
        const voted = !!choice;
        const isSecreta = choice === 'secreta';
        const color = choice === 'sim' ? '#22c55e'
                    : choice === 'nao' ? '#ef4444'
                    : choice === 'abstencao' ? '#6b7280'
                    : null;
        const avatarBg = avatarColors[v.name.charCodeAt(0) % avatarColors.length];
        const avatarSrc = v.avatarUrl
          ? (v.avatarUrl.startsWith('http') ? v.avatarUrl : `${MEDIA}${v.avatarUrl}`)
          : null;
        const voteLabel = isSecreta ? '●●●'
                        : choice === 'sim' ? 'SIM'
                        : choice === 'nao' ? 'NÃO'
                        : choice === 'abstencao' ? 'ABST'
                        : null;
        return (
          <div key={v.id}
               style={{
                 flex: 1, height: '100%', padding: '0 12px',
                 display: 'flex', alignItems: 'center', gap: 8,
                 borderRight: i < presentList.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                 background: color ? `${color}10` : 'transparent',
                 position: 'relative',
               }}>
            {/* linha colorida no topo ao votar */}
            {voted && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                            background: isSecreta ? 'oklch(0.52 0.16 255)' : color! }} />
            )}
            {/* avatar */}
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: avatarBg, fontSize: 12, fontWeight: 700, color: '#fff',
            }}>
              {avatarSrc
                ? <img src={avatarSrc} alt={v.name}
                       style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : (v.initials || v.name.slice(0, 2).toUpperCase())}
            </div>
            {/* nome + partido */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            color: '#F1F5F9' }}>
                {v.name.split(' ').slice(0, 2).join(' ')}
              </div>
              {v.party && (
                <div style={{ fontSize: 10, color: '#5B636D',
                              fontFamily: 'ui-monospace, monospace', marginTop: 1 }}>
                  {v.party}
                </div>
              )}
            </div>
            {/* voto (direita) */}
            {voteLabel && (
              <div style={{
                fontSize: 10, fontWeight: 700,
                fontFamily: 'ui-monospace, monospace',
                letterSpacing: '0.06em', flexShrink: 0,
                color: isSecreta ? 'oklch(0.52 0.16 255)' : color!,
              }}>
                {voteLabel}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Componentes auxiliares ──────────────────────────────── */
function AvatarFallback({ name, initials, size }: { name: string; initials: string | null; size: number }) {
  const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white"
         style={{ width: size, height: size, background: color, fontSize: size * 0.3,
                  border: '3px solid oklch(0.52 0.16 255 / 0.4)' }}>
      {initials || name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono-jet font-semibold"
         style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'animate-pulse-dot' : ''}`}
            style={{ background: connected ? 'oklch(0.50 0.15 155)' : '#5B636D' }} />
      {connected ? 'AO VIVO' : 'OFFLINE'}
    </div>
  );
}

function StatTop({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-mono-jet tracking-widest" style={{ color: '#5B636D', letterSpacing: '0.1em' }}>{label}</div>
      <div className="font-tight font-semibold text-2xl mt-0.5" style={{ letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function BigCount({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden"
         style={{ background: '#15191F', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(90deg, ${color}08, transparent 50%)` }} />
      <div className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: `${color}18`, color }}>
        <span className="text-2xl font-bold">{label === 'SIM' ? '✓' : label === 'NÃO' ? '✗' : '—'}</span>
      </div>
      <div className="flex-1">
        <div className="text-sm font-mono-jet font-semibold tracking-wider" style={{ color: '#9AA3AE', letterSpacing: '0.1em' }}>{label}</div>
      </div>
      <div className="font-tight font-semibold relative" style={{ fontSize: 72, color, letterSpacing: '-0.04em', lineHeight: 0.9, fontVariantNumeric: 'tabular-nums' }}>
        {count}
      </div>
    </div>
  );
}

function Brasao({ size = 40, color = 'currentColor', chamberInfo }: { size?: number; color?: string; chamberInfo?: ChamberInfo | null }) {
  if (chamberInfo?.logoUrl) {
    const src = chamberInfo.logoUrl.startsWith('http') ? chamberInfo.logoUrl : `${MEDIA}${chamberInfo.logoUrl}`;
    return <img src={src} alt={chamberInfo.name} style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="40" cy="40" r="38" stroke={color} strokeWidth="1.5" />
      <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="0.9" strokeDasharray="2 3" opacity="0.5" />
      <path d="M40 18 L44.5 32 L59 32 L47.2 40.5 L51.8 54.5 L40 46 L28.2 54.5 L32.8 40.5 L21 32 L35.5 32 Z" fill={color} opacity="0.92" />
      <path d="M14 56 L66 56" stroke={color} strokeWidth="1.2" opacity="0.6" />
      <text x="40" y="68" textAnchor="middle" fontSize="8" fontFamily="Inter Tight, sans-serif" fontWeight="700" fill={color} letterSpacing="2">VA</text>
    </svg>
  );
}
