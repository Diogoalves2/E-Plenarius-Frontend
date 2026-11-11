'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useVoting } from '@/hooks/useVoting';
import { useVotingSounds } from '@/hooks/useVotingSounds';
import { useExpedienteSounds } from '@/hooks/useExpedienteSounds';
import { useExpediente, ExpedienteAtivo, AparteAtivo } from '@/hooks/useExpediente';
import { Volume2, Maximize2, Minimize2, WifiOff, CheckCircle2, XCircle } from 'lucide-react';
import { fullSessionTitle } from '@/lib/sessionTitle';
import { SecretTally } from '@/components/voting/SecretTally';
import { DEFAULT_PHASES, MAJORITY_LABEL, type SessionPhase } from '@/lib/legislativo';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const MEDIA = API.replace(/\/api\/?$/, '');

/** Quanto tempo o resultado fica na tela depois de encerrada a votação. */
const RESULT_MS = 20_000;

/**
 * Tudo no telão é medido em "u": 1/1920 da largura (limitado pela altura de 1080).
 * Assim a mesma tela fica proporcional em TV Full HD, 4K ou projetor.
 */
const u = (n: number) => `calc(${n} * var(--u))`;

const C = {
  bg: '#07090D', surface: '#10141B', surface2: '#151A23', border: 'rgba(255,255,255,0.07)',
  text: '#F1F5F9', muted: '#8B95A5', dim: '#5B6472', accent: '#4F7BFF',
  green: '#22C55E', red: '#EF4444', amber: '#F59E0B', gray: '#94A3B8',
};

interface VereadorPresente {
  id: string; name: string; initials: string; avatarUrl: string | null; party: string | null; role: string; title?: string | null;
}
interface SessionInfo {
  id: string; number: number; type: string; date: string; chamberId: string; status?: string;
  phase?: string | null; startedAt?: string | null;
}
interface ChamberInfo {
  id: string; name: string; city: string; state: string; logoUrl?: string | null;
  bienioInicio?: number | null; bienioFim?: number | null; anoBienio?: number | null;
  sessionPhases?: SessionPhase[] | null; totalSeats?: number | null; defaultQuorum?: number | null;
}

const TYPE_LABEL: Record<string, string> = { ordinaria: 'Ordinária', extraordinaria: 'Extraordinária', solene: 'Solene', especial: 'Especial' };

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

/** Cronômetro crescente: "01:23:45"; passando de 24 h, "2d 01:23:45" (nunca "33203:14"). */
function fmtElapsed(total: number) {
  const sec = Math.floor(total);
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const hms = [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
  return d > 0 ? `${d}d ${hms}` : hms;
}

const mediaUrl = (p: string | null | undefined) => (p ? (p.startsWith('http') ? p : `${MEDIA}${p}`) : null);
const shortName = (n: string) => n.split(' ').slice(0, 2).join(' ');

export default function TelaoPage() {
  const [mounted, setMounted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [chamberInfo, setChamberInfo] = useState<ChamberInfo | null>(null);
  const [nextSession, setNextSession] = useState<SessionInfo | null>(null);
  const [vereadores, setVereadores] = useState<VereadorPresente[]>([]);
  const [presentes, setPresentes] = useState<Set<string>>(new Set());
  const now = useNow();

  useEffect(() => { setMounted(true); }, []);

  // ?camara=<id>: telão fixo da câmara — mostra nome/brasão mesmo sem sessão e entra
  // sozinho na sessão em andamento. ?sessionId=<id> continua abrindo uma sessão específica.
  const [camaraId, setCamaraId] = useState<string | null>(null);
  const [fixedSession, setFixedSession] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const camara = params.get('camara');
    const sid = params.get('sessionId');
    if (camara) {
      setCamaraId(camara);
      fetch(`${API}/chambers/${camara}`).then(r => r.ok ? r.json() : null).then(c => c && setChamberInfo(c)).catch(() => {});
    }
    if (sid) { setSessionId(sid); setFixedSession(true); }
    else if (!camara) {
      const saved = localStorage.getItem('telao_session');
      if (saved) setSessionId(saved);
    }
  }, []);

  // Modo câmara: segue a sessão em andamento (e volta à tela de espera quando ela termina)
  useEffect(() => {
    if (!camaraId || fixedSession) return;
    const check = () => fetch(`${API}/sessions/active/${camaraId}`)
      .then(r => r.ok ? r.text() : '')
      .then(t => {
        const s = t ? JSON.parse(t) : null;
        setSessionId(prev => (s?.id ?? null) === prev ? prev : (s?.id ?? null));
        if (!s) setSessionInfo(null);
      })
      .catch(() => {});
    check();
    const id = setInterval(check, 15_000);
    return () => clearInterval(id);
  }, [camaraId, fixedSession]);

  // Tela de espera: próxima sessão agendada
  useEffect(() => {
    if (!camaraId || sessionId) return;
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    fetch(`${API}/sessions/chamber/${camaraId}`).then(r => r.ok ? r.json() : [])
      .then((list: SessionInfo[]) => setNextSession(
        list.filter(s => s.status === 'agendada' && s.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null,
      )).catch(() => {});
  }, [camaraId, sessionId]);

  const fetchSessionInfo = useCallback(async () => {
    if (!sessionId) return;
    try {
      const r = await fetch(`${API}/sessions/${sessionId}`);
      if (r.ok) setSessionInfo(await r.json());
    } catch { /* tenta de novo no próximo ciclo */ }
  }, [sessionId]);

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

  // Fase do roteiro (presidente avança no painel → evento session:phase)
  const [phase, setPhase] = useState<string | null>(null);
  useEffect(() => { setPhase(sessionInfo?.phase ?? null); }, [sessionInfo?.phase]);
  useEffect(() => {
    if (!socket) return;
    const onPhase = (d: { phase: string | null; ended?: boolean }) => {
      setPhase(d.phase);
      if (d.ended) fetchSessionInfo();
    };
    socket.on('session:phase', onPhase);
    return () => { socket.off('session:phase', onPhase); };
  }, [socket, fetchSessionInfo]);
  const phaseLabel = phase
    ? ((chamberInfo?.sessionPhases?.length ? chamberInfo.sessionPhases : DEFAULT_PHASES).find(p => p.key === phase)?.label ?? null)
    : null;

  const { activeItem, counts, countsHidden, totalVotes, voteLog } = useVoting(sessionId, socket);
  const { expedienteAtivo, aparteAtivo } = useExpediente(sessionId);
  const { needsActivation: soundNeedsActivation, activate: activateSound } = useVotingSounds(socket);
  const { needsActivation: expedienteSoundNeedsActivation } = useExpedienteSounds(socket);
  const soundNeeded = soundNeedsActivation || expedienteSoundNeedsActivation;

  // Resultado fica na tela por RESULT_MS depois de encerrada a votação
  const [resultVisible, setResultVisible] = useState(false);
  useEffect(() => {
    if (!socket) return;
    let t: ReturnType<typeof setTimeout>;
    const onClosed = () => { setResultVisible(true); clearTimeout(t); t = setTimeout(() => setResultVisible(false), RESULT_MS); };
    const onOpened = () => { clearTimeout(t); setResultVisible(false); };
    socket.on('voting:closed', onClosed);
    socket.on('voting:opened', onOpened);
    return () => { clearTimeout(t); socket.off('voting:closed', onClosed); socket.off('voting:opened', onOpened); };
  }, [socket]);

  const votesMap = useMemo(() => {
    const m: Record<string, string> = {};
    voteLog.forEach(v => { m[v.userId] = v.choice; });
    return m;
  }, [voteLog]);

  // Membros da Casa + quem confirmou presença
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
            .filter(m => ['vereador', 'presidente', 'vice_presidente'].includes(m.role) && (m as any).isActive !== false)
            .sort((a, b) => {
              // Mesa Diretora primeiro: presidente, vice, 1º e 2º secretários; depois os demais
              const rank = (m: VereadorPresente) => m.role === 'presidente' ? 0 : m.role === 'vice_presidente' ? 1
                : /^1º Secret/i.test(m.title ?? '') ? 2 : /^2º Secret/i.test(m.title ?? '') ? 3 : 4;
              return rank(a) - rank(b) || a.name.localeCompare(b.name, 'pt-BR');
            }),
        );
      }
      if (presRes.ok) {
        const presencas: { userId: string }[] = await presRes.json();
        setPresentes(new Set(presencas.map(p => p.userId)));
      }
    } catch { /* tenta de novo no próximo ciclo */ }
  }, [sessionId, sessionInfo?.chamberId]);

  useEffect(() => { fetchQuorum(); }, [fetchQuorum]);

  useEffect(() => {
    if (!socket) return;
    const onConnect = () => { fetchQuorum(); fetchSessionInfo(); };
    socket.on('connect', onConnect);
    return () => { socket.off('connect', onConnect); };
  }, [socket, fetchQuorum, fetchSessionInfo]);

  useEffect(() => {
    if (!sessionId) return;
    const id = setInterval(() => { fetchSessionInfo(); fetchQuorum(); }, 30_000);
    return () => clearInterval(id);
  }, [sessionId, fetchSessionInfo, fetchQuorum]);

  useEffect(() => {
    if (!socket) return;
    const onQuorumUpdated = (data: { userId?: string; action?: 'added' | 'removed' }) => {
      if (data.userId && data.action) {
        setPresentes(prev => {
          const next = new Set(prev);
          if (data.action === 'added') next.add(data.userId!); else next.delete(data.userId!);
          return next;
        });
      }
      fetchQuorum();
    };
    socket.on('quorum:updated', onQuorumUpdated);
    return () => { socket.off('quorum:updated', onQuorumUpdated); };
  }, [socket, fetchQuorum]);

  // Conexão perdida por mais de 8 s: aviso grande (os dados podem estar desatualizados)
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (!sessionId || connected) { setOffline(false); return; }
    const t = setTimeout(() => setOffline(true), 8000);
    return () => clearTimeout(t);
  }, [connected, sessionId]);

  if (!mounted) return null;

  const live = !!sessionId && (!sessionInfo || sessionInfo.status === undefined || sessionInfo.status === 'em_andamento');
  const presentCount = vereadores.filter(v => presentes.has(v.id)).length;
  const seats = chamberInfo?.totalSeats ?? (vereadores.length || 0);
  const quorum = chamberInfo?.defaultQuorum ?? (seats ? Math.floor(seats / 2) + 1 : 0);
  const elapsed = sessionInfo?.startedAt ? Math.max(0, (now.getTime() - new Date(sessionInfo.startedAt).getTime()) / 1000) : 0;

  const header = (
    <Header chamber={chamberInfo} session={sessionInfo} phaseLabel={phaseLabel} now={now}
            presentCount={presentCount} seats={seats} quorum={quorum} elapsed={elapsed} connected={connected} />
  );

  let screen: React.ReactNode;
  if (!live) {
    screen = <Standby chamber={chamberInfo} now={now} next={nextSession} ended={!!sessionId && sessionInfo?.status === 'encerrada'} />;
  } else if (expedienteAtivo) {
    screen = <ExpedienteScreen header={header} expediente={expedienteAtivo} aparte={aparteAtivo} />;
  } else if (activeItem && (activeItem.status === 'em_votacao' || resultVisible)) {
    screen = (
      <VotingScreen header={header} item={activeItem} counts={counts} countsHidden={!!countsHidden} total={totalVotes}
                    now={now} vereadores={vereadores} presentes={presentes} votesMap={votesMap} presentCount={presentCount} />
    );
  } else {
    screen = <QuorumScreen header={header} vereadores={vereadores} presentes={presentes} quorum={quorum} seats={seats} />;
  }

  return (
    <Kiosk soundNeeded={soundNeeded} onActivateSound={activateSound} offline={offline}>
      {screen}
    </Kiosk>
  );
}

/* ── Quiosque: tela cheia, cursor some, tela não apaga, aviso de conexão ───── */
function Kiosk({ children, soundNeeded, onActivateSound, offline }: {
  children: React.ReactNode; soundNeeded: boolean; onActivateSound: () => void; offline: boolean;
}) {
  const [idle, setIdle] = useState(false);
  const [fs, setFs] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wake = () => { setIdle(false); clearTimeout(t); t = setTimeout(() => setIdle(true), 3000); };
    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('pointerdown', wake);
    return () => { clearTimeout(t); window.removeEventListener('mousemove', wake); window.removeEventListener('pointerdown', wake); };
  }, []);

  // A TV/computador não entra em descanso enquanto o telão estiver aberto
  useEffect(() => {
    let lock: any = null;
    const request = async () => {
      try { lock = await (navigator as any).wakeLock?.request('screen'); } catch { /* navegador sem suporte */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') request(); };
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); lock?.release?.().catch?.(() => {}); };
  }, []);

  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});

  return (
    <div className="w-screen h-screen overflow-hidden relative"
         style={{ ['--u' as any]: 'min(calc(100vw / 1920), calc(100vh / 1080))', background: C.bg, color: C.text,
                  fontFamily: 'Inter, system-ui, sans-serif', cursor: idle ? 'none' : 'default' }}>
      {children}

      <div className="fixed flex items-center gap-2 transition-opacity duration-300"
           style={{ right: u(28), bottom: u(28), zIndex: 60, opacity: idle && !soundNeeded ? 0 : 1, pointerEvents: idle && !soundNeeded ? 'none' : 'auto' }}>
        {soundNeeded && (
          <button onClick={onActivateSound} className="flex items-center gap-2 rounded-full font-semibold"
                  style={{ padding: `${u(12)} ${u(20)}`, fontSize: u(18), background: C.amber, color: '#0B0D10' }}>
            <Volume2 style={{ width: u(20), height: u(20) }} /> Clique para ativar o som
          </button>
        )}
        <button onClick={toggleFs} title={fs ? 'Sair da tela cheia' : 'Tela cheia'} className="flex items-center gap-2 rounded-full font-semibold"
                style={{ padding: `${u(12)} ${u(20)}`, fontSize: u(18), background: 'rgba(255,255,255,0.1)', color: C.text, border: `1px solid ${C.border}` }}>
          {fs ? <Minimize2 style={{ width: u(20), height: u(20) }} /> : <Maximize2 style={{ width: u(20), height: u(20) }} />}
          {fs ? 'Sair da tela cheia' : 'Tela cheia'}
        </button>
      </div>

      {offline && (
        <div className="fixed left-0 right-0 flex items-center justify-center gap-3 font-semibold"
             style={{ bottom: 0, zIndex: 70, padding: u(18), fontSize: u(24), background: 'rgba(245,158,11,0.96)', color: '#1A1203' }}>
          <WifiOff style={{ width: u(28), height: u(28) }} /> Conexão perdida — tentando reconectar. As informações podem estar desatualizadas.
        </div>
      )}
    </div>
  );
}

/* ── Cabeçalho comum ────────────────────────────────────────────────────── */
function Header({ chamber, session, phaseLabel, now, presentCount, seats, quorum, elapsed, connected }: {
  chamber: ChamberInfo | null; session: SessionInfo | null; phaseLabel: string | null; now: Date;
  presentCount: number; seats: number; quorum: number; elapsed: number; connected: boolean;
}) {
  const ok = presentCount >= quorum && quorum > 0;
  return (
    <header className="flex items-center flex-shrink-0"
            style={{ gap: u(28), padding: `${u(22)} ${u(44)}`, background: C.surface, borderBottom: `1px solid ${C.border}` }}>
      <Brasao chamber={chamber} size={84} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold uppercase" style={{ fontSize: u(18), letterSpacing: '0.14em', color: C.muted }}>
          {chamber ? `${chamber.name} · ${chamber.city}/${chamber.state}` : ' '}
        </div>
        <div className="truncate font-bold" style={{ fontSize: u(36), letterSpacing: '-0.02em', lineHeight: 1.15, marginTop: u(2) }}>
          {session ? fullSessionTitle(session.number, session.type, chamber) : ' '}
        </div>
        <div className="flex items-center" style={{ gap: u(14), marginTop: u(6), fontSize: u(19), color: C.muted }}>
          {session && <span>{new Date(session.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>}
          {session?.startedAt && <><span style={{ color: C.dim }}>·</span><span>Iniciada às {new Date(session.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></>}
          {phaseLabel && (
            <span className="font-semibold rounded-full" style={{ padding: `${u(5)} ${u(16)}`, background: 'rgba(79,123,255,0.18)', color: '#AFC3FF', border: '1px solid rgba(79,123,255,0.35)' }}>
              {phaseLabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-stretch flex-shrink-0" style={{ gap: u(34) }}>
        <HeaderStat label="Presentes" value={`${presentCount}/${seats || '–'}`} />
        <HeaderStat label="Quórum" value={quorum ? (ok ? 'Atingido' : `Faltam ${quorum - presentCount}`) : '–'} color={quorum ? (ok ? C.green : C.amber) : undefined} />
        <HeaderStat label="Tempo de sessão" value={elapsed ? fmtElapsed(elapsed) : '–'} />
        <div className="flex flex-col items-end justify-center" style={{ paddingLeft: u(34), borderLeft: `1px solid ${C.border}` }}>
          <div className="font-bold" style={{ fontSize: u(54), lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="flex items-center font-semibold uppercase" style={{ gap: u(8), marginTop: u(6), fontSize: u(15), letterSpacing: '0.12em', color: connected ? C.green : C.dim }}>
            <span className="rounded-full" style={{ width: u(10), height: u(10), background: connected ? C.green : C.dim, boxShadow: connected ? `0 0 ${u(10)} ${C.green}` : 'none' }} />
            {connected ? 'Ao vivo' : 'Offline'}
          </div>
        </div>
      </div>
    </header>
  );
}

function HeaderStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col justify-center">
      <div className="font-semibold uppercase" style={{ fontSize: u(15), letterSpacing: '0.14em', color: C.dim }}>{label}</div>
      <div className="font-bold" style={{ fontSize: u(36), lineHeight: 1.1, letterSpacing: '-0.02em', color: color ?? C.text, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

/* ── Presença: grade que ocupa a tela inteira ──────────────────────────── */
function gridFor(n: number) {
  if (n <= 0) return { cols: 1, rows: 1 };
  const cols = n <= 3 ? n : n <= 4 ? 4 : n <= 8 ? Math.ceil(n / 2) : n <= 10 ? 5 : n <= 12 ? 6 : n <= 15 ? 5 : n <= 18 ? 6 : 7;
  return { cols, rows: Math.ceil(n / cols) };
}

function QuorumScreen({ header, vereadores, presentes, quorum, seats }: {
  header: React.ReactNode; vereadores: VereadorPresente[]; presentes: Set<string>; quorum: number; seats: number;
}) {
  const presentCount = vereadores.filter(v => presentes.has(v.id)).length;
  const { cols, rows } = gridFor(vereadores.length);
  const photo = rows <= 1 ? 260 : rows === 2 ? 200 : rows === 3 ? 138 : 104;
  const ok = quorum > 0 && presentCount >= quorum;
  const pct = (n: number) => `${Math.min(100, (n / Math.max(seats, 1)) * 100)}%`;

  return (
    <div className="w-full h-full flex flex-col">
      {header}
      <main className="flex-1 min-h-0" style={{ padding: `${u(32)} ${u(44)} ${u(16)}` }}>
        {vereadores.length === 0 ? (
          <div className="h-full flex items-center justify-center" style={{ fontSize: u(28), color: C.dim }}>Carregando vereadores…</div>
        ) : (
          <div className="h-full" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: u(20) }}>
            {vereadores.map(v => {
              const on = presentes.has(v.id);
              return (
                <div key={v.id} className="flex flex-col items-center justify-center text-center min-h-0"
                     style={{ borderRadius: u(24), padding: u(18), gap: u(14),
                              background: on ? 'linear-gradient(180deg, rgba(34,197,94,0.12), rgba(34,197,94,0.03))' : C.surface,
                              border: `${u(2)} solid ${on ? 'rgba(34,197,94,0.45)' : C.border}`,
                              transition: 'all .6s ease' }}>
                  <div className="relative flex-shrink-0">
                    <Photo src={mediaUrl(v.avatarUrl)} name={v.name} initials={v.initials} size={photo} dim={!on}
                           ring={on ? C.green : 'rgba(255,255,255,0.12)'} />
                    {on && (
                      <span className="absolute rounded-full flex items-center justify-center"
                            style={{ right: u(4), bottom: u(4), width: u(photo * 0.24), height: u(photo * 0.24), background: C.green, border: `${u(4)} solid ${C.bg}` }}>
                        <CheckCircle2 style={{ width: '62%', height: '62%', color: '#04230F' }} />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 w-full">
                    <div className="font-bold truncate" style={{ fontSize: u(rows >= 3 ? 24 : 30), letterSpacing: '-0.01em', color: on ? C.text : C.muted }}>
                      {shortName(v.name)}
                    </div>
                    <div className="truncate" style={{ fontSize: u(rows >= 3 ? 16 : 19), marginTop: u(4), color: on ? '#86EFAC' : C.dim }}>
                      {[v.party, v.role === 'presidente' ? 'Presidente' : v.role === 'vice_presidente' ? 'Vice-presidente' : v.title].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <span className="font-bold uppercase rounded-full" style={{ fontSize: u(15), letterSpacing: '0.12em', padding: `${u(5)} ${u(14)}`,
                        background: on ? 'rgba(34,197,94,0.16)' : 'rgba(255,255,255,0.05)', color: on ? '#4ADE80' : C.dim }}>
                    {on ? 'Presente' : 'Ausente'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <footer className="flex-shrink-0" style={{ padding: `${u(10)} ${u(44)} ${u(28)}` }}>
        <div className="flex items-baseline justify-between" style={{ marginBottom: u(10) }}>
          <span className="font-bold uppercase" style={{ fontSize: u(22), letterSpacing: '0.1em', color: ok ? C.green : C.amber }}>
            {ok ? 'Quórum atingido' : quorum ? `Quórum insuficiente — faltam ${quorum - presentCount}` : 'Verificação de quórum'}
          </span>
          <span style={{ fontSize: u(20), color: C.muted }}>{presentCount} de {seats} vereadores · mínimo {quorum}</span>
        </div>
        <div className="relative rounded-full" style={{ height: u(14), background: 'rgba(255,255,255,0.07)' }}>
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(presentCount), background: ok ? C.green : C.amber, transition: 'width 1s ease, background .5s' }} />
          <div className="absolute" style={{ left: pct(quorum), top: u(-6), bottom: u(-6), width: u(3), background: C.text, borderRadius: u(2) }} />
        </div>
      </footer>
    </div>
  );
}

/* ── Votação ────────────────────────────────────────────────────────────── */
function VotingScreen({ header, item, counts, countsHidden, total, now, vereadores, presentes, votesMap, presentCount }: {
  header: React.ReactNode; item: any; counts: { sim: number; nao: number; abstencao: number }; countsHidden: boolean;
  total: number; now: Date; vereadores: VereadorPresente[]; presentes: Set<string>; votesMap: Record<string, string>; presentCount: number;
}) {
  const closed = item.status === 'aprovado' || item.status === 'rejeitado';
  const approved = item.status === 'aprovado';
  const opened = item.votingOpenedAt ? new Date(item.votingOpenedAt).getTime() : now.getTime();
  const end = closed && item.votingClosedAt ? new Date(item.votingClosedAt).getTime() : now.getTime();
  const secs = Math.max(0, Math.floor((end - opened) / 1000));
  const timer = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  const base = Math.max(presentCount, total, 1);

  return (
    <div className="w-full h-full flex flex-col">
      {header}
      <main className="flex-1 min-h-0 flex" style={{ gap: u(28), padding: `${u(32)} ${u(44)}` }}>
        {/* Matéria */}
        <section className="flex flex-col min-w-0" style={{ flex: 1.15 }}>
          <div className="flex items-center flex-wrap" style={{ gap: u(14), marginBottom: u(22) }}>
            {closed ? (
              <span className="font-bold uppercase rounded-full" style={{ fontSize: u(18), letterSpacing: '0.12em', padding: `${u(8)} ${u(18)}`, background: 'rgba(255,255,255,0.08)', color: C.muted }}>
                Votação encerrada
              </span>
            ) : (
              <span className="flex items-center font-bold uppercase rounded-full" style={{ gap: u(10), fontSize: u(18), letterSpacing: '0.12em', padding: `${u(8)} ${u(18)}`, background: 'rgba(79,123,255,0.18)', color: '#AFC3FF' }}>
                <span className="rounded-full animate-pulse" style={{ width: u(12), height: u(12), background: C.accent }} /> Em votação
              </span>
            )}
            <span className="font-semibold" style={{ fontSize: u(22), color: C.muted }}>{item.number} · {item.type}</span>
          </div>
          <h1 className="font-bold" style={{ fontSize: u(58), lineHeight: 1.08, letterSpacing: '-0.03em', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.title}
          </h1>
          {item.description && (
            <p style={{ fontSize: u(24), lineHeight: 1.45, color: C.muted, marginTop: u(18), display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {item.description}
            </p>
          )}
          <div className="grid mt-auto" style={{ gridTemplateColumns: 'repeat(3, auto)', justifyContent: 'start', gap: `${u(10)} ${u(48)}`, paddingTop: u(24) }}>
            <Meta label="Autoria" value={item.authorName || '—'} />
            <Meta label="Quórum de aprovação" value={MAJORITY_LABEL[item.majority as keyof typeof MAJORITY_LABEL] ?? 'Maioria simples'} />
            <Meta label="Votação" value={item.votingType === 'secreta' ? 'Secreta' : 'Aberta (nominal)'} />
          </div>
        </section>

        {/* Placar */}
        <section className="flex flex-col min-h-0" style={{ flex: 1, borderRadius: u(28), padding: closed ? `${u(24)} ${u(34)}` : u(34), background: C.surface, border: `1px solid ${C.border}`, gap: u(closed ? 12 : 22) }}>
          <div className="flex items-baseline justify-between">
            <span className="font-bold uppercase" style={{ fontSize: u(18), letterSpacing: '0.14em', color: C.dim }}>{closed ? 'Resultado final' : 'Placar parcial'}</span>
            <span className="font-bold" style={{ fontSize: u(40), fontVariantNumeric: 'tabular-nums', color: C.muted }}>{timer}</span>
          </div>

          {countsHidden && !closed ? (
            <div className="flex-1 flex flex-col justify-center" style={{ gap: u(20) }}>
              <SecretTally total={total} dark large />
              <p style={{ fontSize: u(20), color: C.muted }}>Votação secreta: o placar aparece quando a votação for encerrada.</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col justify-center" style={{ gap: u(closed ? 14 : 26) }}>
              <ScoreRow label="Sim" value={counts.sim} base={base} color={C.green} compact={closed} />
              <ScoreRow label="Não" value={counts.nao} base={base} color={C.red} compact={closed} />
              <ScoreRow label="Abstenção" value={counts.abstencao} base={base} color={C.gray} compact={closed} />
            </div>
          )}

          <div style={{ paddingTop: u(closed ? 12 : 18), borderTop: `1px solid ${C.border}` }}>
            <div className="flex justify-between" style={{ fontSize: u(20), color: C.muted, marginBottom: u(10) }}>
              <span>Votaram</span><b style={{ color: C.text }}>{total} de {presentCount} presentes</b>
            </div>
            <div className="rounded-full" style={{ height: u(10), background: 'rgba(255,255,255,0.07)' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (total / Math.max(presentCount, 1)) * 100)}%`, background: C.accent, transition: 'width .6s ease' }} />
            </div>
          </div>
        </section>
      </main>

      {closed && (
        <div className="flex items-center justify-center flex-shrink-0" style={{ gap: u(26), padding: `${u(22)} ${u(44)}`,
             background: approved ? 'linear-gradient(90deg, rgba(34,197,94,0.22), rgba(34,197,94,0.08))' : 'linear-gradient(90deg, rgba(239,68,68,0.24), rgba(239,68,68,0.08))',
             borderTop: `${u(3)} solid ${approved ? C.green : C.red}` }}>
          {approved ? <CheckCircle2 style={{ width: u(72), height: u(72), color: C.green }} /> : <XCircle style={{ width: u(72), height: u(72), color: C.red }} />}
          <div>
            <div className="font-black uppercase" style={{ fontSize: u(76), lineHeight: 1, letterSpacing: '-0.02em', color: approved ? '#4ADE80' : '#F87171' }}>
              {approved ? 'Aprovado' : 'Rejeitado'}
            </div>
            {item.resultExplanation && <div style={{ fontSize: u(22), color: C.muted, marginTop: u(8) }}>{item.resultExplanation}</div>}
          </div>
        </div>
      )}

      <VoteStrip vereadores={vereadores} presentes={presentes} votesMap={votesMap} />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <>
      <div style={{ gridRow: 1 }} className="font-semibold uppercase"><span style={{ fontSize: u(15), letterSpacing: '0.14em', color: C.dim }}>{label}</span></div>
      <div style={{ gridRow: 2, fontSize: u(24), fontWeight: 600 }}>{value}</div>
    </>
  );
}

function ScoreRow({ label, value, base, color, compact }: { label: string; value: number; base: number; color: string; compact?: boolean }) {
  return (
    <div>
      <div className="flex items-end justify-between" style={{ marginBottom: u(compact ? 6 : 10) }}>
        <span className="font-bold uppercase" style={{ fontSize: u(compact ? 22 : 26), letterSpacing: '0.08em', color: C.muted }}>{label}</span>
        <span className="font-black" style={{ fontSize: u(compact ? 64 : 96), lineHeight: 0.85, letterSpacing: '-0.04em', color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
      <div className="rounded-full" style={{ height: u(compact ? 12 : 16), background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full" style={{ width: `${(value / base) * 100}%`, background: color, transition: 'width .6s ease' }} />
      </div>
    </div>
  );
}

/** Faixa inferior: cada vereador presente e o voto dele (secreta mostra só que votou). */
function VoteStrip({ vereadores, presentes, votesMap }: { vereadores: VereadorPresente[]; presentes: Set<string>; votesMap: Record<string, string> }) {
  const list = vereadores.filter(v => presentes.has(v.id));
  if (!list.length) return null;
  const color = (c?: string) => c === 'sim' ? C.green : c === 'nao' ? C.red : c === 'abstencao' ? C.gray : c === 'secreta' ? C.accent : null;
  const label = (c?: string) => c === 'sim' ? 'SIM' : c === 'nao' ? 'NÃO' : c === 'abstencao' ? 'ABST.' : c === 'secreta' ? 'VOTOU' : 'AGUARDANDO';
  return (
    <div className="flex flex-shrink-0" style={{ height: u(132), background: C.surface, borderTop: `1px solid ${C.border}` }}>
      {list.map(v => {
        const c = votesMap[v.id];
        const col = color(c);
        return (
          <div key={v.id} className="flex-1 min-w-0 flex items-center relative" style={{ gap: u(12), padding: `0 ${u(12)}`, borderRight: `1px solid ${C.border}`, background: col ? `${col}14` : 'transparent', transition: 'background .4s' }}>
            {col && <span className="absolute left-0 right-0 top-0" style={{ height: u(5), background: col }} />}
            <Photo src={mediaUrl(v.avatarUrl)} name={v.name} initials={v.initials} size={list.length > 7 ? 54 : 64} ring={col ?? 'rgba(255,255,255,0.12)'} dim={!c} />
            <div className="min-w-0">
              <div className="font-semibold" style={{ fontSize: u(19), lineHeight: 1.15, color: C.text, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{shortName(v.name)}</div>
              <div className="font-black" style={{ fontSize: u(c ? 22 : 15), letterSpacing: '0.06em', marginTop: u(2), color: col ?? C.dim }}>{label(c)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Tempo de fala (expediente) ─────────────────────────────────────────── */
function ExpedienteScreen({ header, expediente, aparte }: { header: React.ReactNode; expediente: ExpedienteAtivo; aparte: AparteAtivo | null }) {
  const { vereador, tipo, tempoRestante, duracao, paused } = expediente;
  const pct = Math.max(0, tempoRestante / Math.max(duracao, 1));
  const urgente = pct <= 0.2 && !paused;
  const timerColor = paused ? C.amber : urgente ? C.red : pct <= 0.5 ? C.amber : C.green;
  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="w-full h-full flex flex-col">
      {header}
      <main className="flex-1 min-h-0 flex">
        <section className="relative overflow-hidden" style={{ flex: 1.1 }}>
          {vereador.avatarUrl
            ? <img src={mediaUrl(vereador.avatarUrl)!} alt={vereador.name} className="absolute inset-0 w-full h-full object-cover object-top" />
            : <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #1a1f2e, #0d1117)' }}>
                <Photo src={null} name={vereador.name} initials={vereador.initials} size={320} />
              </div>}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.3) 45%, transparent 72%)' }} />
          <span className="absolute font-bold uppercase rounded-full" style={{ top: u(32), left: u(36), fontSize: u(18), letterSpacing: '0.12em', padding: `${u(8)} ${u(18)}`, background: 'rgba(79,123,255,0.25)', color: '#C7D5FF', border: '1px solid rgba(79,123,255,0.45)', backdropFilter: 'blur(8px)' }}>
            {tipo === 'grande' ? 'Grande Expediente' : 'Pequeno Expediente'}
          </span>
          <div className="absolute left-0 right-0 bottom-0" style={{ padding: `0 ${u(44)} ${u(40)}` }}>
            {vereador.title && <div className="uppercase" style={{ fontSize: u(20), letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)' }}>{vereador.title}</div>}
            <h2 className="font-black" style={{ fontSize: u(72), lineHeight: 1, letterSpacing: '-0.03em' }}>{vereador.name}</h2>
            {vereador.party && <div className="font-semibold" style={{ fontSize: u(26), marginTop: u(8), color: 'rgba(255,255,255,0.6)' }}>{vereador.party}</div>}
          </div>
          {aparte && (
            <div className="absolute flex items-center rounded-3xl" style={{ left: u(36), right: u(36), bottom: u(36), gap: u(20), padding: u(24), background: 'rgba(0,24,12,0.94)', border: '1px solid #166534' }}>
              <div className="flex-1">
                <span className="font-bold uppercase rounded-full" style={{ fontSize: u(15), letterSpacing: '0.12em', padding: `${u(4)} ${u(12)}`, background: 'rgba(34,197,94,0.2)', color: '#4ADE80' }}>Aparte</span>
                <div className="font-bold" style={{ fontSize: u(34), marginTop: u(8) }}>{aparte.vereador.name}</div>
              </div>
              <div className="font-black" style={{ fontSize: u(64), color: '#4ADE80', fontVariantNumeric: 'tabular-nums' }}>{mmss(aparte.tempoRestante)}</div>
            </div>
          )}
        </section>
        <section className="flex flex-col items-center justify-center relative" style={{ flex: 1, background: '#06080B', borderLeft: `1px solid ${C.border}` }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(${u(700)} ${u(460)} at 50% 45%, ${timerColor}2E, transparent 70%)`, transition: 'background .5s' }} />
          <div className="relative font-bold uppercase" style={{ fontSize: u(22), letterSpacing: '0.16em', color: paused ? C.amber : C.muted }}>
            {paused ? 'Pausado · aparte em andamento' : 'Tempo restante'}
          </div>
          <div className="relative font-black" style={{ fontSize: u(240), lineHeight: 0.95, letterSpacing: '-0.05em', color: timerColor, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 ${u(80)} ${timerColor}55`, transition: 'color .5s', marginTop: u(16) }}>
            {mmss(tempoRestante)}
          </div>
          <div className="relative font-bold uppercase" style={{ height: u(34), fontSize: u(22), letterSpacing: '0.16em', color: C.red, marginTop: u(14) }}>
            {urgente ? '● Encerrando' : ''}
          </div>
          <div className="relative rounded-full" style={{ width: u(620), height: u(14), background: 'rgba(255,255,255,0.08)', marginTop: u(24) }}>
            <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: timerColor, transition: 'width .9s linear, background .5s' }} />
          </div>
        </section>
      </main>
    </div>
  );
}

/* ── Tela de espera (sem sessão em andamento) ───────────────────────────── */
function Standby({ chamber, now, next, ended }: { chamber: ChamberInfo | null; now: Date; next: SessionInfo | null; ended: boolean }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center relative overflow-hidden"
         style={{ background: `radial-gradient(${u(1400)} ${u(900)} at 50% 30%, rgba(79,123,255,0.16), transparent 70%), ${C.bg}` }}>
      <Brasao chamber={chamber} size={220} />
      <h1 className="font-bold" style={{ fontSize: u(64), letterSpacing: '-0.02em', marginTop: u(28) }}>{chamber?.name ?? ' '}</h1>
      <div style={{ fontSize: u(26), color: C.muted, marginTop: u(8) }}>
        {chamber ? `Poder Legislativo Municipal · ${chamber.city}/${chamber.state}` : ' '}
      </div>
      <div className="font-black" style={{ fontSize: u(180), lineHeight: 1, letterSpacing: '-0.04em', marginTop: u(56), fontVariantNumeric: 'tabular-nums' }}>
        {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div style={{ fontSize: u(30), color: C.muted, marginTop: u(10) }}>
        {(t => t.charAt(0).toUpperCase() + t.slice(1))(now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}
      </div>
      <div className="rounded-full font-semibold" style={{ marginTop: u(56), padding: `${u(14)} ${u(30)}`, fontSize: u(26), background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, color: C.text }}>
        {ended ? 'Sessão encerrada' : next
          ? `Próxima sessão: ${next.number}ª ${TYPE_LABEL[next.type] ?? next.type} · ${new Date(next.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`
          : 'Aguardando o início da sessão'}
      </div>
    </div>
  );
}

/* ── Peças ──────────────────────────────────────────────────────────────── */
function Photo({ src, name, initials, size, ring, dim }: { src: string | null; name: string; initials: string | null; size: number; ring?: string; dim?: boolean }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const style: React.CSSProperties = {
    width: u(size), height: u(size), borderRadius: '50%', flexShrink: 0, objectFit: 'cover',
    border: ring ? `${u(Math.max(3, size * 0.03))} solid ${ring}` : undefined,
    filter: dim ? 'grayscale(75%) brightness(0.65)' : undefined, transition: 'filter .6s ease, border-color .6s ease',
  };
  if (src && !broken) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={src} alt={name} onError={() => setBroken(true)} style={style} />;
  }
  return (
    <div className="flex items-center justify-center font-black" style={{ ...style, background: '#1E2532', color: '#CBD5E1', fontSize: u(size * 0.32) }}>
      {initials || name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function Brasao({ chamber, size }: { chamber: ChamberInfo | null; size: number }) {
  const src = mediaUrl(chamber?.logoUrl);
  if (src) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={src} alt={chamber!.name} style={{ width: u(size), height: u(size), objectFit: 'contain', flexShrink: 0 }} />;
  }
  return (
    <svg viewBox="0 0 80 80" fill="none" style={{ width: u(size), height: u(size), flexShrink: 0 }}>
      <circle cx="40" cy="40" r="38" stroke={C.accent} strokeWidth="1.5" />
      <path d="M40 18 L44.5 32 L59 32 L47.2 40.5 L51.8 54.5 L40 46 L28.2 54.5 L32.8 40.5 L21 32 L35.5 32 Z" fill={C.accent} opacity="0.92" />
    </svg>
  );
}
