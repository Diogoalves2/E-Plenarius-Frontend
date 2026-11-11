'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, Plus, Play, Square, X, Loader2, CalendarDays, FileText, AudioLines } from 'lucide-react';
import api from '@/lib/api';
import { fullSessionTitle, ChamberBienio } from '@/lib/sessionTitle';
import { canConductSession } from '@/lib/auth';
import { useDialog } from '@/components/ui/Dialog';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ?? 'http://localhost:3001';


interface Session {
  id: string;
  number: number;
  type: 'ordinaria' | 'extraordinaria' | 'solene' | 'especial';
  date: string;
  scheduledAt: string | null;
  status: 'agendada' | 'em_andamento' | 'encerrada';
  startedAt: string | null;
  endedAt: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  ordinaria: 'Ordinária',
  extraordinaria: 'Extraordinária',
  solene: 'Solene',
  especial: 'Especial',
};

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  agendada:    { label: 'Agendada',     bg: 'rgba(234,179,8,0.1)',   color: '#b45309' },
  em_andamento:{ label: 'Em andamento', bg: 'rgba(16,185,129,0.1)', color: '#059669' },
  encerrada:   { label: 'Encerrada',    bg: 'rgba(15,23,42,0.06)',  color: '#8A94A2' },
};

export default function SessoesPage() {
  const { user } = useAuth();
  const dialog = useDialog();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [chamber, setChamber] = useState<ChamberBienio | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user?.chamberId) return;
    try {
      const [sessRes, chamberRes] = await Promise.all([
        api.get(`/sessions/chamber/${user.chamberId}`),
        api.get(`/chambers/${user.chamberId}`),
      ]);
      setSessions(sessRes.data);
      setChamber(chamberRes.data);
    } finally {
      setLoading(false);
    }
  }, [user?.chamberId]);

  useEffect(() => { fetch(); }, [fetch]);

  async function startSession(id: string) {
    setActionLoading(id + ':start');
    try { await api.patch(`/sessions/${id}/start`); await fetch(); }
    finally { setActionLoading(null); }
  }

  async function endSession(id: string) {
    if (!(await dialog.confirm({ title: 'Encerrar esta sessão?', message: 'A ata é gerada com o que foi registrado até agora. Esta ação não pode ser desfeita.', tone: 'danger', confirmLabel: 'Encerrar sessão' }))) return;
    setActionLoading(id + ':end');
    try { await api.patch(`/sessions/${id}/end`); await fetch(); }
    finally { setActionLoading(null); }
  }

  const canCreate = user?.role === 'presidente';
  const canConduct = canConductSession(user?.role);
  const hasRunning = sessions.some(s => s.status === 'em_andamento');

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-tight font-semibold text-2xl" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>Sessões</h2>
          <p className="text-sm mt-1" style={{ color: '#8A94A2' }}>{sessions.length} sessão(ões) cadastrada(s)</p>
        </div>
        {canCreate && (
          <div className="flex flex-col items-end gap-1">
            <button onClick={() => !hasRunning && setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity"
                    style={{ background: '#1447E6', opacity: hasRunning ? 0.45 : 1, cursor: hasRunning ? 'not-allowed' : 'pointer' }}>
              <Plus size={16} /> Nova Sessão
            </button>
            {hasRunning && (
              <p className="text-xs" style={{ color: '#b45309' }}>Encerre a sessão em andamento primeiro</p>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <Spinner />
      ) : sessions.length === 0 ? (
        <Empty icon={<Clock size={36} style={{ color: '#D1D5DB' }} />} text="Nenhuma sessão cadastrada." />
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map(s => {
            const st = STATUS_STYLE[s.status];
            const isRunning = actionLoading?.startsWith(s.id);
            return (
              <div key={s.id} className="bg-white rounded-xl px-5 py-4 flex items-center gap-4"
                   style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(82,130,255,0.08)' }}>
                  <CalendarDays size={18} style={{ color: '#1447E6' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: '#0B1220' }}>
                    {fullSessionTitle(s.number, s.type, chamber)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#8A94A2' }}>
                    {new Date(s.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    {s.scheduledAt && ' · ' + new Date(s.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold font-mono-jet flex-shrink-0"
                      style={{ background: st.bg, color: st.color }}>
                  {s.status === 'em_andamento' && (
                    <span className="relative flex w-1.5 h-1.5">
                      <span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: st.color }} />
                      <span className="relative w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />
                    </span>
                  )}
                  {st.label}
                </span>
                {canConduct && s.status === 'agendada' && (
                  <button onClick={() => startSession(s.id)} disabled={!!isRunning}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                          style={{ background: '#059669', opacity: isRunning ? 0.7 : 1 }}>
                    {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    Iniciar
                  </button>
                )}
                {canConduct && s.status === 'em_andamento' && (
                  <button onClick={() => endSession(s.id)} disabled={!!isRunning}
                          className="group flex items-center gap-2 pl-2.5 pr-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors bg-white hover:bg-red-50 disabled:opacity-60"
                          style={{ border: '1px solid rgba(220,38,38,0.22)', color: '#B91C1C' }}>
                    {isRunning
                      ? <Loader2 size={13} className="animate-spin" />
                      : <span className="flex items-center justify-center w-[18px] h-[18px] rounded-full transition-colors bg-red-50 group-hover:bg-red-100">
                          <Square size={7} fill="currentColor" strokeWidth={0} />
                        </span>}
                    Encerrar sessão
                  </button>
                )}
                {s.status === 'encerrada' && (
                  <a href={`/ata/${s.id}`} target="_blank" rel="noreferrer"
                     className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                     style={{ background: 'rgba(15,23,42,0.06)', color: '#4B5563' }}>
                    <FileText size={12} /> Gerar Ata
                  </a>
                )}
                {s.status === 'encerrada' && (
                  <a href={`/dashboard/degravacao/${s.id}`}
                     className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                     style={{ background: 'rgba(20,71,230,0.08)', color: '#1447E6' }}>
                    <AudioLines size={12} /> Degravação
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <NewSessionModal chamberId={user!.chamberId!} chamber={chamber} onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); fetch(); }} />
      )}
    </div>
  );
}

function NewSessionModal({ chamberId, chamber, onClose, onCreated }: { chamberId: string; chamber?: ChamberBienio | null; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ number: '', type: 'ordinaria', scheduledAt: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const date = form.scheduledAt.substring(0, 10);
      await api.post('/sessions', { chamberId, number: Number(form.number), type: form.type, date, scheduledAt: new Date(form.scheduledAt).toISOString() });
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar sessão');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Nova Sessão" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Preview do título completo */}
        {form.number && (
          <div className="px-3.5 py-2.5 rounded-lg text-sm font-semibold"
               style={{ background: 'rgba(82,130,255,0.06)', border: '1px solid rgba(82,130,255,0.2)', color: '#1447E6' }}>
            {fullSessionTitle(Number(form.number), form.type, chamber)}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="NÚMERO" required>
            <Input type="number" min="1" value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} placeholder="47" required />
          </Field>
          <Field label="TIPO" required>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none" style={iStyle}>
              <option value="ordinaria">Ordinária</option>
              <option value="extraordinaria">Extraordinária</option>
              <option value="solene">Solene</option>
              <option value="especial">Especial</option>
            </select>
          </Field>
        </div>
        <Field label="DATA E HORA DA SESSÃO" required>
          <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} required />
        </Field>

        <p className="text-xs leading-relaxed" style={{ color: '#8A94A2' }}>
          Projetos e requerimentos da pauta são cadastrados em <b style={{ color: '#4B5563' }}>Ordem do dia</b>, depois de criar a sessão.
        </p>

        {error && <ErrorBox msg={error} />}
        <ModalActions onClose={onClose} loading={loading} label="Criar Sessão" />
      </form>
    </Modal>
  );
}

/* shared */
const iStyle: React.CSSProperties = { background: 'white', border: '1px solid rgba(15,23,42,0.12)', color: '#0B1220', transition: 'border-color 0.15s' };
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full px-3.5 py-2.5 rounded-lg text-sm outline-none ${props.className ?? ''}`} style={iStyle}
    onFocus={e => (e.target.style.borderColor = '#1447E6')} onBlur={e => (e.target.style.borderColor = 'rgba(15,23,42,0.12)')} />;
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold font-mono-jet" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>{label}{required && <span style={{ color: '#dc2626' }}> *</span>}</label>{children}</div>;
}
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(11,18,32,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'} bg-white rounded-2xl shadow-xl flex flex-col`} style={{ border: '1px solid rgba(15,23,42,0.08)', maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
          <h2 className="font-tight font-semibold text-lg" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors"><X size={18} style={{ color: '#8A94A2' }} /></button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
function ModalActions({ onClose, loading, label }: { onClose: () => void; loading: boolean; label: string }) {
  return (
    <div className="flex gap-3 pt-1">
      <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563' }}>Cancelar</button>
      <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: '#1447E6', opacity: loading ? 0.7 : 1 }}>
        {loading && <Loader2 size={14} className="animate-spin" />}{loading ? 'Salvando…' : label}
      </button>
    </div>
  );
}
function ErrorBox({ msg }: { msg: string }) {
  return <div className="px-3.5 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>{msg}</div>;
}
function Spinner() {
  return <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin" style={{ color: '#8A94A2' }} /></div>;
}
function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex flex-col items-center justify-center py-20 text-center">{icon}<p className="mt-4 text-sm" style={{ color: '#8A94A2' }}>{text}</p></div>;
}
