'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useExpediente } from '@/hooks/useExpediente';
import { useNotificacoes } from '@/hooks/useNotificacoes';
import api from '@/lib/api';
import {
  Mic, MicOff, Clock, Plus, Minus, Square, CheckCircle,
  UserCircle, Hand, StopCircle, UserPlus, X,
} from 'lucide-react';
import { clsx } from 'clsx';

interface ActiveSession { id: string; number: number; type: string; }

interface Inscricao {
  id: string;
  tipo: 'grande' | 'pequeno';
  status: 'aguardando' | 'em_andamento' | 'concluido' | 'cancelado';
  createdAt: string;
  user: {
    id: string; name: string; avatarUrl: string | null;
    party: string | null; initials: string | null; title: string | null;
  } | null;
  guestName?: string | null;
  guestCargo?: string | null;
  guestTempo?: number | null;
}

const TIPO_LABEL = { grande: 'Grande Expediente', pequeno: 'Pequeno Expediente' };
const TIPO_DURACAO = { grande: '10 min', pequeno: '5 min' };
const MEDIA = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');

function formatTempo(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function Avatar({ user, guestName, size = 40 }: { user: Inscricao['user'] | null; guestName?: string | null; size?: number }) {
  const isGuest = !user && !!guestName;
  const name = user?.name ?? guestName ?? '?';
  if (user?.avatarUrl) {
    const src = user.avatarUrl.startsWith('http') ? user.avatarUrl : `${MEDIA}${user.avatarUrl}`;
    return <img src={src} alt={name} className="rounded-full object-cover flex-shrink-0"
                style={{ width: size, height: size }} />;
  }
  const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
  const color = isGuest ? '#059669' : colors[name.charCodeAt(0) % colors.length];
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white"
         style={{ width: size, height: size, background: color, fontSize: size * 0.35 }}>
      {isGuest ? '🎙' : (user?.initials || name.slice(0, 2).toUpperCase())}
    </div>
  );
}

export default function ExpedientePage() {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [inscritos, setInscritos] = useState<Inscricao[]>([]);
  const [tabAtiva, setTabAtiva] = useState<'grande' | 'pequeno'>('grande');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmEncerrar, setConfirmEncerrar] = useState(false);
  const [showConvidadoForm, setShowConvidadoForm] = useState(false);
  const [convidadoNome, setConvidadoNome] = useState('');
  const [convidadoCargo, setConvidadoCargo] = useState('');
  const [convidadoTempo, setConvidadoTempo] = useState('5');
  const [convidadoTipo, setConvidadoTipo] = useState<'grande' | 'pequeno'>('grande');

  const { expedienteAtivo, aparteAtivo, solicitacoes, inscritosVersion } = useExpediente(activeSession?.id ?? null);

  useNotificacoes({ sessionId: activeSession?.id ?? null, userId: user?.id });

  const isPresidente = user?.role === 'presidente';
  const isVereador = user?.role === 'vereador';

  const fetchSession = useCallback(async () => {
    if (!user?.chamberId) return;
    try {
      const { data } = await api.get(`/sessions/active/${user.chamberId}`);
      setActiveSession(data);
    } catch { setActiveSession(null); }
  }, [user?.chamberId]);

  const fetchInscritos = useCallback(async () => {
    if (!activeSession?.id) return;
    try {
      const { data } = await api.get(`/expediente/sessions/${activeSession.id}/inscritos`);
      setInscritos(data);
    } catch { setInscritos([]); }
  }, [activeSession?.id]);

  useEffect(() => { fetchSession(); }, [fetchSession]);
  useEffect(() => { fetchInscritos(); }, [fetchInscritos]);
  useEffect(() => { if (!expedienteAtivo) fetchInscritos(); }, [expedienteAtivo, fetchInscritos]);
  useEffect(() => { if (inscritosVersion > 0) fetchInscritos(); }, [inscritosVersion]);

  async function act(fn: () => Promise<any>) {
    setErro('');
    setLoading(true);
    try { await fn(); await fetchInscritos(); }
    catch (e: any) { setErro(e.response?.data?.message ?? 'Erro ao executar ação'); }
    finally { setLoading(false); }
  }

  const inscrever = (tipo: 'grande' | 'pequeno') =>
    act(() => api.post(`/expediente/sessions/${activeSession!.id}/inscrever`, { tipo }));

  const cancelar = (tipo: 'grande' | 'pequeno') =>
    act(() => api.delete(`/expediente/sessions/${activeSession!.id}/cancelar/${tipo}`));

  const liberar = (inscricaoId: string) =>
    act(() => api.post(`/expediente/sessions/${activeSession!.id}/liberar/${inscricaoId}`));

  const ajustar = async (delta: 1 | -1) => {
    try { await api.post(`/expediente/sessions/${activeSession!.id}/ajustar`, { delta }); }
    catch (e: any) { setErro(e.response?.data?.message ?? 'Erro'); }
  };

  const encerrar = () =>
    act(() => api.post(`/expediente/sessions/${activeSession!.id}/encerrar`));

  const solicitarAparte = () =>
    act(() => api.post(`/expediente/sessions/${activeSession!.id}/aparte/solicitar`));

  const cancelarAparte = () =>
    act(() => api.delete(`/expediente/sessions/${activeSession!.id}/aparte/cancelar`));

  const aceitarAparte = (userId: string) =>
    act(() => api.post(`/expediente/sessions/${activeSession!.id}/aparte/aceitar/${userId}`));

  const encerrarAparte = () =>
    act(() => api.post(`/expediente/sessions/${activeSession!.id}/aparte/encerrar`));

  const adicionarConvidado = async () => {
    const tempo = parseInt(convidadoTempo) || 5;
    await act(() => api.post(`/expediente/sessions/${activeSession!.id}/convidado`, {
      tipo: convidadoTipo, nome: convidadoNome.trim(), cargo: convidadoCargo.trim(), tempo,
    }));
    setShowConvidadoForm(false);
    setConvidadoNome('');
    setConvidadoCargo('');
    setConvidadoTempo('5');
  };

  const removerConvidado = (inscricaoId: string) =>
    act(() => api.delete(`/expediente/sessions/${activeSession!.id}/convidado/${inscricaoId}`));

  const inscritosFiltrados = inscritos.filter(i => i.tipo === tabAtiva && i.status !== 'cancelado');
  const minhaInscricao = (tipo: 'grande' | 'pequeno') =>
    isVereador ? inscritos.find(i => i.user?.id === user?.id && i.tipo === tipo && i.status === 'aguardando') : undefined;

  const minhaSolicitacao = solicitacoes.find(s => s.userId === user?.id);

  if (!activeSession) {
    return (
      <div className="p-8 flex items-center justify-center" style={{ minHeight: 300 }}>
        <div className="text-center">
          <Mic size={32} style={{ color: '#C5CAD2', margin: '0 auto 12px' }} />
          <p className="font-semibold text-gray-700">Nenhuma sessão ativa</p>
          <p className="text-sm text-gray-400 mt-1">Inicie uma sessão para usar o expediente</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900" style={{ letterSpacing: '-0.02em' }}>Expediente</h1>
        <p className="text-sm text-gray-500 mt-0.5">{activeSession.number}ª Sessão · Inscrições para uso da tribuna</p>
      </div>

      {/* ── Expediente ativo ── */}
      {expedienteAtivo && (
        <div className="rounded-2xl p-5 mb-4 relative overflow-hidden"
             style={{ background: expedienteAtivo.paused ? '#1a1200' : 'oklch(0.20 0.05 255)',
                      border: `1px solid ${expedienteAtivo.paused ? '#78350f' : 'oklch(0.35 0.10 255)'}` }}>
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: `radial-gradient(600px at 80% 50%, ${expedienteAtivo.paused ? 'rgba(245,158,11,0.08)' : 'oklch(0.52 0.16 255 / 0.12)'}, transparent 60%)` }} />
          <div className="relative flex items-center gap-4">
            <Avatar user={expedienteAtivo.vereador as any} size={56} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-mono-jet font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'oklch(0.52 0.16 255 / 0.25)', color: 'oklch(0.75 0.14 255)', letterSpacing: '0.08em' }}>
                  {expedienteAtivo.tipo === 'grande' ? 'GRANDE EXPEDIENTE' : 'PEQUENO EXPEDIENTE'}
                </span>
                {expedienteAtivo.paused ? (
                  <span className="text-[10px] font-mono-jet font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>PAUSADO</span>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: '#1447E6' }} />
                )}
              </div>
              <p className="font-semibold text-white truncate">{expedienteAtivo.vereador.name}</p>
              {expedienteAtivo.vereador.party && (
                <p className="text-xs mt-0.5" style={{ color: 'oklch(0.65 0.08 255)' }}>{expedienteAtivo.vereador.party}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-mono-jet font-bold text-white"
                   style={{ fontSize: 40, fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.02em',
                            color: expedienteAtivo.paused ? '#f59e0b' : 'white' }}>
                {formatTempo(expedienteAtivo.tempoRestante)}
              </div>
              <div className="text-xs mt-1" style={{ color: 'oklch(0.65 0.08 255)' }}>restante</div>
            </div>
          </div>

          {/* Presidente: controles principais */}
          {isPresidente && !aparteAtivo && (
            <div className="relative mt-4 pt-4"
                 style={{ borderTop: '1px solid oklch(0.35 0.10 255)' }}>
              {confirmEncerrar ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white flex-1">Encerrar o expediente?</span>
                  <button onClick={() => { setConfirmEncerrar(false); encerrar(); }}
                          className="flex items-center gap-1.5 rounded-xl text-sm font-semibold"
                          style={{ padding: '10px 18px', background: 'rgba(239,68,68,0.8)', color: '#fff', minHeight: 44 }}>
                    <Square size={14} /> Confirmar
                  </button>
                  <button onClick={() => setConfirmEncerrar(false)}
                          className="rounded-xl text-sm font-medium"
                          style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.08)', color: 'oklch(0.75 0.14 255)', minHeight: 44 }}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => ajustar(-1)}
                          className="flex items-center gap-1.5 rounded-xl text-sm font-medium"
                          style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.08)', color: 'oklch(0.75 0.14 255)', minHeight: 44 }}>
                    <Minus size={15} /> 1 min
                  </button>
                  <button onClick={() => ajustar(1)}
                          className="flex items-center gap-1.5 rounded-xl text-sm font-medium"
                          style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.08)', color: 'oklch(0.75 0.14 255)', minHeight: 44 }}>
                    <Plus size={15} /> 1 min
                  </button>
                  <button onClick={() => setConfirmEncerrar(true)}
                          className="flex items-center gap-1.5 rounded-xl text-sm font-semibold ml-auto"
                          style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)', minHeight: 44 }}>
                    <Square size={15} /> Encerrar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Vereador: solicitar aparte */}
          {isVereador && expedienteAtivo.vereador.id !== user?.id && !aparteAtivo && (
            <div className="relative mt-3 pt-3" style={{ borderTop: '1px solid oklch(0.35 0.10 255)' }}>
              {minhaSolicitacao ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'oklch(0.75 0.14 255)' }}>Aparte solicitado — aguardando presidente</span>
                  <button onClick={cancelarAparte} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <button onClick={solicitarAparte} disabled={loading}
                        className="flex items-center gap-1.5 rounded-xl text-sm font-medium w-full justify-center"
                        style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.08)', color: 'oklch(0.75 0.14 255)', minHeight: 48 }}>
                  <Hand size={15} /> Solicitar Aparte
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Aparte ativo ── */}
      {aparteAtivo && (
        <div className="rounded-2xl p-4 mb-4 relative overflow-hidden"
             style={{ background: '#0a1a0a', border: '1px solid #14532d' }}>
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: 'radial-gradient(400px at 80% 50%, rgba(16,185,129,0.08), transparent 60%)' }} />
          <div className="relative flex items-center gap-3">
            <Avatar user={aparteAtivo.vereador as any} size={44} />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-mono-jet font-semibold px-2 py-0.5 rounded-full mb-1 inline-block"
                    style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', letterSpacing: '0.08em' }}>APARTE</span>
              <p className="font-semibold text-white text-sm truncate">{aparteAtivo.vereador.name}</p>
            </div>
            <div className="font-mono-jet font-bold text-2xl" style={{ color: '#34d399', fontVariantNumeric: 'tabular-nums' }}>
              {formatTempo(aparteAtivo.tempoRestante)}
            </div>
            {isPresidente && (
              <button onClick={encerrarAparte} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold ml-2"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
                <StopCircle size={12} /> Encerrar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Solicitações de aparte (presidente) ── */}
      {isPresidente && solicitacoes.length > 0 && !aparteAtivo && (
        <div className="rounded-xl p-4 mb-4" style={{ border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
          <p className="text-xs font-mono-jet font-semibold mb-3" style={{ color: '#92400e', letterSpacing: '0.06em' }}>
            SOLICITAÇÕES DE APARTE ({solicitacoes.length})
          </p>
          <div className="flex flex-col gap-2">
            {solicitacoes.map(s => (
              <div key={s.userId} className="flex items-center gap-3">
                <Avatar user={s.vereador as any} size={32} />
                <span className="text-sm font-medium text-gray-800 flex-1">{s.vereador.name}</span>
                <button onClick={() => aceitarAparte(s.userId)} disabled={loading}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold"
                        style={{ background: '#1447E6', color: '#fff' }}>
                  <CheckCircle size={11} /> Aceitar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Inscrição do vereador ── */}
      {isVereador && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {(['grande', 'pequeno'] as const).map(tipo => {
            const inscrito = !!minhaInscricao(tipo);
            return (
              <div key={tipo} className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={15} style={{ color: inscrito ? '#1447E6' : '#8A94A2' }} />
                  <span className="text-sm font-semibold text-gray-800">{TIPO_LABEL[tipo]}</span>
                  <span className="ml-auto text-xs text-gray-400 font-mono-jet">{TIPO_DURACAO[tipo]}</span>
                </div>
                {inscrito ? (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Inscrito · aguardando liberação</p>
                    <button onClick={() => cancelar(tipo)} disabled={loading}
                            className="w-full flex items-center justify-center gap-1.5 rounded-xl text-sm font-medium"
                            style={{ padding: '10px 12px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', minHeight: 44 }}>
                      <MicOff size={14} /> Cancelar inscrição
                    </button>
                  </div>
                ) : (
                  <button onClick={() => inscrever(tipo)} disabled={loading}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl text-sm font-semibold"
                          style={{ padding: '10px 12px', background: '#1447E6', color: '#fff', minHeight: 44 }}>
                    <Mic size={14} /> Inscrever-se
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Erro ── */}
      {erro && (
        <div className="mb-4 px-4 py-2.5 rounded-lg text-sm"
             style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
          {erro}
        </div>
      )}

      {/* ── Adicionar Convidado (presidente) ── */}
      {isPresidente && !expedienteAtivo && (
        <div className="mb-4">
          {!showConvidadoForm ? (
            <button onClick={() => { setConvidadoTipo(tabAtiva); setShowConvidadoForm(true); }}
                    className="flex items-center gap-2 rounded-xl text-sm font-semibold"
                    style={{ padding: '10px 16px', background: 'rgba(5,150,105,0.1)', color: '#059669',
                             border: '1px solid rgba(5,150,105,0.3)', minHeight: 44 }}>
              <UserPlus size={15} /> Adicionar Convidado
            </button>
          ) : (
            <div className="rounded-2xl p-5" style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.25)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-gray-900">🎙 Adicionar Convidado</p>
                  <p className="text-xs text-gray-500 mt-0.5">Pessoa convidada para usar a tribuna</p>
                </div>
                <button onClick={() => setShowConvidadoForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <X size={16} style={{ color: '#9CA3AF' }} />
                </button>
              </div>
              {/* Tipo selector */}
              <div className="flex gap-2 mb-3">
                {(['grande', 'pequeno'] as const).map(t => (
                  <button key={t} onClick={() => setConvidadoTipo(t)}
                          className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
                          style={{
                            background: convidadoTipo === t ? 'rgba(5,150,105,0.15)' : '#F9FAFB',
                            color: convidadoTipo === t ? '#059669' : '#6B7280',
                            border: `1px solid ${convidadoTipo === t ? 'rgba(5,150,105,0.4)' : 'rgba(15,23,42,0.08)'}`,
                            fontWeight: convidadoTipo === t ? 700 : 500,
                          }}>
                    {TIPO_LABEL[t]}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Nome</label>
                  <input value={convidadoNome} onChange={e => setConvidadoNome(e.target.value)}
                         placeholder="Nome completo"
                         className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none focus:ring-2"
                         style={{ borderColor: 'rgba(15,23,42,0.12)', background: '#fff',
                                  '--tw-ring-color': 'rgba(5,150,105,0.3)' } as any} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Cargo / Função</label>
                  <input value={convidadoCargo} onChange={e => setConvidadoCargo(e.target.value)}
                         placeholder="Ex: Secretário Municipal"
                         className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none focus:ring-2"
                         style={{ borderColor: 'rgba(15,23,42,0.12)', background: '#fff',
                                  '--tw-ring-color': 'rgba(5,150,105,0.3)' } as any} />
                </div>
              </div>
              <div className="flex items-end gap-3">
                <div style={{ width: 140 }}>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Tempo (minutos)</label>
                  <input value={convidadoTempo} onChange={e => setConvidadoTempo(e.target.value)}
                         type="number" min="1" max="120" placeholder="5"
                         className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none focus:ring-2"
                         style={{ borderColor: 'rgba(15,23,42,0.12)', background: '#fff',
                                  '--tw-ring-color': 'rgba(5,150,105,0.3)' } as any} />
                </div>
                <button onClick={adicionarConvidado} disabled={loading || !convidadoNome.trim() || !convidadoCargo.trim()}
                        className="flex items-center gap-1.5 rounded-xl text-sm font-semibold"
                        style={{ padding: '10px 20px', background: '#059669', color: '#fff',
                                 minHeight: 44, opacity: (!convidadoNome.trim() || !convidadoCargo.trim()) ? 0.5 : 1 }}>
                  <UserPlus size={14} /> Adicionar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Lista de inscritos ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
        <div className="flex" style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
          {(['grande', 'pequeno'] as const).map(tipo => {
            const count = inscritos.filter(i => i.tipo === tipo && i.status !== 'cancelado').length;
            return (
              <button key={tipo} onClick={() => setTabAtiva(tipo)}
                      className={clsx('flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2', {
                        'text-gray-900': tabAtiva === tipo,
                        'text-gray-400 hover:text-gray-600': tabAtiva !== tipo,
                      })}
                      style={{ borderBottom: tabAtiva === tipo ? '2px solid #1447E6' : '2px solid transparent' }}>
                {TIPO_LABEL[tipo]}
                <span className="text-[10px] font-mono-jet px-1.5 py-0.5 rounded"
                      style={{ background: tabAtiva === tipo ? 'oklch(0.52 0.16 255 / 0.1)' : '#F3F4F6',
                               color: tabAtiva === tipo ? '#1447E6' : '#9CA3AF' }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {inscritosFiltrados.length === 0 ? (
          <div className="py-12 text-center">
            <UserCircle size={32} style={{ color: '#C5CAD2', margin: '0 auto 10px' }} />
            <p className="text-sm text-gray-400">Nenhum vereador inscrito</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(15,23,42,0.05)' }}>
            {inscritosFiltrados.map((inscricao, idx) => {
              const isAtivo = expedienteAtivo?.inscricaoId === inscricao.id;
              const isConcluido = inscricao.status === 'concluido';
              const isGuest = !!inscricao.guestName;
              const displayName = inscricao.user?.name ?? inscricao.guestName ?? '—';
              const displayParty = inscricao.user?.party ?? inscricao.guestCargo ?? null;
              return (
                <div key={inscricao.id}
                     className={clsx('flex items-center gap-3 px-5 py-3.5', { 'opacity-50': isConcluido })}
                     style={{ background: isAtivo ? 'oklch(0.97 0.02 255)' : isGuest ? 'rgba(5,150,105,0.04)' : undefined }}>
                  <span className="text-xs font-mono-jet w-5 text-center flex-shrink-0" style={{ color: '#C5CAD2' }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <Avatar user={inscricao.user} guestName={inscricao.guestName} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                      {isGuest && (
                        <span className="text-[10px] font-mono-jet font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                              style={{ background: 'rgba(5,150,105,0.12)', color: '#059669', letterSpacing: '0.05em' }}>
                          CONVIDADO
                        </span>
                      )}
                    </div>
                    {displayParty && <p className="text-xs text-gray-400 truncate">{displayParty}</p>}
                    {isGuest && inscricao.guestTempo && (
                      <p className="text-xs font-medium" style={{ color: '#059669' }}>{inscricao.guestTempo} min</p>
                    )}
                  </div>
                  {isConcluido ? (
                    <span className="flex items-center gap-1 text-[11px] font-mono-jet px-2 py-0.5 rounded-full"
                          style={{ background: '#F0FDF4', color: '#16A34A' }}>
                      <CheckCircle size={11} /> Concluído
                    </span>
                  ) : isAtivo ? (
                    <span className="flex items-center gap-1.5 text-[11px] font-mono-jet px-2 py-0.5 rounded-full"
                          style={{ background: 'oklch(0.52 0.16 255 / 0.1)', color: '#1447E6' }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot inline-block" style={{ background: '#1447E6' }} />
                      Na tribuna
                    </span>
                  ) : null}
                  {isPresidente && inscricao.status === 'aguardando' && !expedienteAtivo && (
                    <div className="flex items-center gap-1.5">
                      {isGuest && (
                        <button onClick={() => removerConvidado(inscricao.id)} disabled={loading}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold"
                                style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                          <X size={11} />
                        </button>
                      )}
                      <button onClick={() => liberar(inscricao.id)} disabled={loading}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                              style={{ background: '#1447E6', color: '#fff' }}>
                        <Mic size={12} /> Liberar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
