'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/hooks/useSocket';
import { useVoting } from '@/hooks/useVoting';
import api from '@/lib/api';
import { CheckCircle2, Clock, Wifi, WifiOff, Loader2 } from 'lucide-react';

export default function VotarPage() {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [myChoice, setMyChoice] = useState<string | null>(null);
  const [voteHash, setVoteHash] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState('');

  const { socket, connected } = useSocket(sessionId);
  const { activeItem, counts, voteLog } = useVoting(sessionId, socket);

  useEffect(() => {
    if (!user?.chamberId) return;
    api.get(`/sessions/active/${user.chamberId}`)
      .then(r => { if (r.data?.id) setSessionId(r.data.id); })
      .catch(() => {});
  }, [user]);

  // Reseta estado de voto quando o item muda
  useEffect(() => {
    setHasVoted(false);
    setMyChoice(null);
    setVoteHash(null);
    setVoteError('');

    if (!activeItem || activeItem.status !== 'em_votacao') return;

    // Verifica se já votou neste item
    api.get(`/voting/item/${activeItem.id}/has-voted`)
      .then(r => { if (r.data === true) setHasVoted(true); })
      .catch(() => {});
  }, [activeItem?.id, activeItem?.status]);

  // Captura meu voto em tempo real no voteLog
  useEffect(() => {
    if (!user?.id || !activeItem) return;
    const mine = voteLog.find(v => v.userId === user.id);
    if (mine) {
      setHasVoted(true);
      setMyChoice(mine.choice);
    }
  }, [voteLog, user?.id, activeItem?.id]);

  const castVote = useCallback(async (choice: 'sim' | 'nao' | 'abstencao') => {
    if (!activeItem || voting || hasVoted) return;
    setVoting(true);
    setVoteError('');
    try {
      const res = await api.post('/voting/cast', { agendaItemId: activeItem.id, choice });
      const displayed = activeItem.votingType === 'secreta' ? 'secreta' : choice;
      setHasVoted(true);
      setMyChoice(displayed);
      setVoteHash(res.data.hash);
    } catch (e: any) {
      setVoteError(e.response?.data?.message ?? 'Erro ao registrar voto. Tente novamente.');
    } finally {
      setVoting(false);
    }
  }, [activeItem, voting, hasVoted]);

  const total = counts.sim + counts.nao + counts.abstencao;
  const isOpen = activeItem?.status === 'em_votacao';
  const isClosed = activeItem?.status === 'aprovado' || activeItem?.status === 'rejeitado';

  return (
    <div className="flex flex-col min-h-full" style={{ background: '#F6F7F9' }}>

      {/* Barra de status */}
      <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
           style={{ background: '#fff', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
        <div>
          <p className="text-[11px] font-mono-jet font-semibold"
             style={{ color: isOpen ? 'oklch(0.52 0.16 255)' : isClosed ? '#475569' : '#f59e0b', letterSpacing: '0.08em' }}>
            {isOpen ? '● EM VOTAÇÃO' : isClosed ? 'VOTAÇÃO ENCERRADA' : 'AGUARDANDO VOTAÇÃO'}
          </p>
          {activeItem && (
            <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate" style={{ maxWidth: 260 }}>
              {activeItem.number} · {activeItem.type}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono-jet"
             style={{ color: connected ? '#059669' : '#8A94A2' }}>
          {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span className="hidden sm:inline">{connected ? 'CONECTADO' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col items-center justify-center p-5 gap-5 max-w-lg mx-auto w-full">

        {/* Sem sessão */}
        {!sessionId && (
          <EmptyState
            icon={<Clock size={52} style={{ color: '#D1D5DB' }} />}
            title="Nenhuma sessão ativa"
            subtitle="Aguarde o início da sessão"
          />
        )}

        {/* Com sessão mas sem item ativo */}
        {sessionId && !activeItem && (
          <EmptyState
            icon={
              <div className="flex items-center justify-center rounded-full"
                   style={{ width: 64, height: 64, background: 'rgba(82,130,255,0.1)' }}>
                <div className="w-4 h-4 rounded-full animate-pulse"
                     style={{ background: 'oklch(0.52 0.16 255)' }} />
              </div>
            }
            title="Aguardando votação"
            subtitle="O presidente abrirá a votação em breve"
          />
        )}

        {activeItem && (
          <>
            {/* Card do projeto */}
            <div className="w-full rounded-2xl p-5"
                 style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-mono-jet font-semibold px-2.5 py-1 rounded-full"
                      style={{
                        background: isOpen ? 'rgba(82,130,255,0.1)' : 'rgba(100,116,139,0.1)',
                        color: isOpen ? 'oklch(0.52 0.16 255)' : '#475569',
                        letterSpacing: '0.06em',
                      }}>
                  {activeItem.votingType === 'secreta' ? '🔒 VOTO SECRETO' : '👁 VOTAÇÃO ABERTA'}
                </span>
              </div>
              <h1 className="font-tight font-bold text-gray-900 leading-tight"
                  style={{ fontSize: 20, letterSpacing: '-0.02em' }}>
                {activeItem.title}
              </h1>
              {activeItem.description && (
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">{activeItem.description}</p>
              )}
              {activeItem.authorName && (
                <p className="text-xs text-gray-400 mt-3">
                  Autoria: <span className="font-semibold text-gray-600">{activeItem.authorName}</span>
                </p>
              )}
            </div>

            {/* Botões de votação */}
            {isOpen && !hasVoted && (
              <div className="w-full flex flex-col gap-3">
                <p className="text-center text-[11px] font-mono-jet font-semibold"
                   style={{ color: '#8A94A2', letterSpacing: '0.1em' }}>
                  REGISTRE SEU VOTO
                </p>

                <button
                  onClick={() => castVote('sim')}
                  disabled={voting}
                  className="w-full flex items-center justify-center gap-3 rounded-2xl font-bold text-white transition-all active:scale-[0.97]"
                  style={{
                    padding: '22px 24px',
                    background: 'oklch(0.50 0.15 155)',
                    fontSize: 22,
                    letterSpacing: '-0.01em',
                    opacity: voting ? 0.7 : 1,
                    boxShadow: '0 4px 20px rgba(34,197,94,0.25)',
                  }}>
                  {voting ? <Loader2 size={22} className="animate-spin" /> : <span style={{ fontSize: 26 }}>✓</span>}
                  SIM
                </button>

                <button
                  onClick={() => castVote('nao')}
                  disabled={voting}
                  className="w-full flex items-center justify-center gap-3 rounded-2xl font-bold text-white transition-all active:scale-[0.97]"
                  style={{
                    padding: '22px 24px',
                    background: 'oklch(0.52 0.20 25)',
                    fontSize: 22,
                    letterSpacing: '-0.01em',
                    opacity: voting ? 0.7 : 1,
                    boxShadow: '0 4px 20px rgba(239,68,68,0.20)',
                  }}>
                  {voting ? <Loader2 size={22} className="animate-spin" /> : <span style={{ fontSize: 26 }}>✗</span>}
                  NÃO
                </button>

                <button
                  onClick={() => castVote('abstencao')}
                  disabled={voting}
                  className="w-full flex items-center justify-center gap-3 rounded-2xl font-bold transition-all active:scale-[0.97]"
                  style={{
                    padding: '22px 24px',
                    background: '#fff',
                    border: '2px solid rgba(15,23,42,0.14)',
                    color: '#4B5563',
                    fontSize: 22,
                    opacity: voting ? 0.7 : 1,
                  }}>
                  {voting ? <Loader2 size={22} className="animate-spin" /> : <span style={{ fontSize: 26 }}>—</span>}
                  ABSTENÇÃO
                </button>

                {voteError && (
                  <p className="text-sm text-center rounded-xl px-4 py-3"
                     style={{ background: '#FEF2F2', color: '#dc2626', border: '1px solid #FECACA' }}>
                    {voteError}
                  </p>
                )}
              </div>
            )}

            {/* Confirmação do voto */}
            {hasVoted && (
              <VoteConfirmation choice={myChoice} hash={voteHash} />
            )}

            {/* Contagem de votos */}
            {(isOpen || isClosed) && (
              <div className="w-full rounded-2xl p-4"
                   style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
                <p className="text-[10px] font-mono-jet font-semibold mb-3"
                   style={{ color: '#8A94A2', letterSpacing: '0.08em' }}>
                  {isClosed ? 'RESULTADO FINAL' : `VOTOS COMPUTADOS · ${total}`}
                </p>
                <div className="flex gap-3">
                  <CountPill label="SIM" count={counts.sim} color="oklch(0.50 0.15 155)" />
                  <CountPill label="NÃO" count={counts.nao} color="oklch(0.52 0.20 25)" />
                  <CountPill label="ABS" count={counts.abstencao} color="#8A94A2" />
                </div>
                {isClosed && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(15,23,42,0.06)' }}>
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold"
                          style={{
                            background: activeItem.status === 'aprovado' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                            color: activeItem.status === 'aprovado' ? '#059669' : '#dc2626',
                            fontSize: 16,
                          }}>
                      {activeItem.status === 'aprovado' ? '✓ APROVADO' : '✗ REPROVADO'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Componentes auxiliares ── */

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      {icon}
      <div>
        <p className="font-tight font-semibold text-gray-700" style={{ fontSize: 18 }}>{title}</p>
        <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

function VoteConfirmation({ choice, hash }: { choice: string | null; hash: string | null }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    sim:       { bg: 'rgba(16,185,129,0.1)',   color: '#059669',               label: '✓  SIM' },
    nao:       { bg: 'rgba(239,68,68,0.1)',    color: '#dc2626',               label: '✗  NÃO' },
    abstencao: { bg: 'rgba(100,116,139,0.1)',  color: '#475569',               label: '—  ABSTENÇÃO' },
    secreta:   { bg: 'rgba(82,130,255,0.1)',   color: 'oklch(0.52 0.16 255)',  label: '🔒  VOTO SECRETO' },
  };
  const c = (choice && cfg[choice]) ? cfg[choice] : cfg.abstencao;

  return (
    <div className="w-full rounded-2xl p-6 text-center"
         style={{ background: c.bg, border: `1px solid ${c.color}30` }}>
      <CheckCircle2 size={44} className="mx-auto mb-3" style={{ color: c.color }} />
      <p className="text-[11px] font-mono-jet font-semibold mb-2"
         style={{ color: '#8A94A2', letterSpacing: '0.1em' }}>VOTO REGISTRADO</p>
      <p className="font-bold" style={{ color: c.color, fontSize: 24, letterSpacing: '-0.01em' }}>
        {c.label}
      </p>
      {hash && (
        <p className="text-[11px] font-mono-jet mt-3" style={{ color: '#8A94A2' }}>
          hash: {hash}
        </p>
      )}
    </div>
  );
}

function CountPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex-1 rounded-xl p-3 text-center"
         style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
      <p className="font-bold" style={{ color, fontSize: 28, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{count}</p>
      <p className="text-[11px] font-mono-jet font-semibold mt-1" style={{ color }}>{label}</p>
    </div>
  );
}
