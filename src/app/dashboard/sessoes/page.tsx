'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, Plus, Play, Square, X, Loader2, CalendarDays, Paperclip, Trash2, FileText } from 'lucide-react';
import api from '@/lib/api';
import { fullSessionTitle, ChamberBienio } from '@/lib/sessionTitle';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';

const TIPOS_PROJETO = [
  'Projeto de Emenda à Lei Orgânica',
  'Projeto de Lei Complementar',
  'Projeto de Lei',
  'Projeto de Decreto Legislativo',
  'Projeto de Resolução',
  'Indicação',
  'Requerimento',
  'Pedido de Informação',
  'Recurso',
  'Emenda',
  'Subemenda',
  'Substitutivo',
  'Ata',
] as const;

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
    if (!confirm('Encerrar esta sessão? Esta ação não pode ser desfeita.')) return;
    setActionLoading(id + ':end');
    try { await api.patch(`/sessions/${id}/end`); await fetch(); }
    finally { setActionLoading(null); }
  }

  const canCreate = user?.role === 'presidente';
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
                    style={{ background: 'oklch(0.52 0.16 255)', opacity: hasRunning ? 0.45 : 1, cursor: hasRunning ? 'not-allowed' : 'pointer' }}>
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
                  <CalendarDays size={18} style={{ color: 'oklch(0.52 0.16 255)' }} />
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
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold font-mono-jet flex-shrink-0"
                      style={{ background: st.bg, color: st.color }}>
                  {st.label}
                </span>
                {canCreate && s.status === 'agendada' && (
                  <button onClick={() => startSession(s.id)} disabled={!!isRunning}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                          style={{ background: '#059669', opacity: isRunning ? 0.7 : 1 }}>
                    {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    Iniciar
                  </button>
                )}
                {canCreate && s.status === 'em_andamento' && (
                  <button onClick={() => endSession(s.id)} disabled={!!isRunning}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                          style={{ background: '#dc2626', opacity: isRunning ? 0.7 : 1 }}>
                    {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />}
                    Encerrar
                  </button>
                )}
                {s.status === 'encerrada' && (
                  <a href={`/ata/${s.id}`} target="_blank" rel="noreferrer"
                     className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                     style={{ background: 'rgba(15,23,42,0.06)', color: '#4B5563' }}>
                    <FileText size={12} /> Gerar Ata
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

interface DraftItem {
  _key: string;
  type: string;
  number: string;
  title: string;
  authorName: string;
  votingType: 'aberta' | 'secreta';
  quorumMinimum: string;
  pdfUrl: string;
  pdfUploading: boolean;
}

function emptyDraft(): DraftItem {
  return { _key: Math.random().toString(36).slice(2), type: 'Projeto de Lei', number: '', title: '', authorName: '', votingType: 'aberta', quorumMinimum: '5', pdfUrl: '', pdfUploading: false };
}

interface VereadorOption { id: string; name: string; party?: string | null; role: string; }

function NewSessionModal({ chamberId, chamber, onClose, onCreated }: { chamberId: string; chamber?: ChamberBienio | null; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ number: '', type: 'ordinaria', scheduledAt: '' });
  const [items, setItems] = useState<DraftItem[]>([]);
  const [draft, setDraft] = useState<DraftItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [vereadores, setVereadores] = useState<VereadorOption[]>([]);
  const [authorOpen, setAuthorOpen] = useState(false);
  const pdfRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get(`/users/chamber/${chamberId}`).then(r => {
      setVereadores(r.data.filter((u: VereadorOption) => ['vereador', 'presidente'].includes(u.role)));
    }).catch(() => {});
  }, [chamberId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const date = form.scheduledAt.substring(0, 10);
      const payload: any = { chamberId, number: Number(form.number), type: form.type, date, scheduledAt: new Date(form.scheduledAt).toISOString() };
      const { data: session } = await api.post('/sessions', payload);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const itemPayload: any = { sessionId: session.id, chamberId, number: it.number, type: it.type, title: it.title, authorName: it.authorName, votingType: it.votingType, quorumMinimum: Number(it.quorumMinimum), orderIndex: i };
        if (it.pdfUrl) itemPayload.pdfUrl = it.pdfUrl;
        await api.post('/agenda', itemPayload);
      }
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar sessão');
    } finally {
      setLoading(false);
    }
  }

  async function handlePdfUpload(file: File) {
    if (!draft) return;
    setDraft(d => d ? { ...d, pdfUploading: true } : d);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/upload/pdf', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDraft(d => d ? { ...d, pdfUrl: data.url, pdfUploading: false } : d);
    } catch {
      setDraft(d => d ? { ...d, pdfUploading: false } : d);
    }
  }

  function saveDraft() {
    if (!draft) return;
    if (!draft.number || !draft.title || !draft.authorName) return;
    setItems(prev => [...prev, draft]);
    setDraft(null);
  }

  return (
    <Modal title="Nova Sessão" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Preview do título completo */}
        {form.number && (
          <div className="px-3.5 py-2.5 rounded-lg text-sm font-semibold"
               style={{ background: 'rgba(82,130,255,0.06)', border: '1px solid rgba(82,130,255,0.2)', color: 'oklch(0.52 0.16 255)' }}>
            {fullSessionTitle(Number(form.number), form.type, chamber)}
          </div>
        )}

        {/* Session fields */}
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

        {/* Agenda items */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold font-mono-jet" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>ORDEM DO DIA</span>
            {!draft && (
              <button type="button" onClick={() => setDraft(emptyDraft())}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{ background: 'rgba(82,130,255,0.08)', color: 'oklch(0.52 0.16 255)' }}>
                <Plus size={12} /> Adicionar Projeto
              </button>
            )}
          </div>

          {/* Added items list */}
          {items.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {items.map((it, i) => (
                <div key={it._key} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(15,23,42,0.03)', border: '1px solid rgba(15,23,42,0.08)' }}>
                  <span className="text-xs font-semibold font-mono-jet w-5 text-center" style={{ color: '#8A94A2' }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: '#0B1220' }}>{it.number} · {it.title}</p>
                    <p className="text-xs truncate" style={{ color: '#8A94A2' }}>{it.type} · {it.authorName}</p>
                  </div>
                  {it.pdfUrl && <Paperclip size={12} style={{ color: '#8A94A2', flexShrink: 0 }} />}
                  <button type="button" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}
                          className="p-1 rounded hover:bg-red-50 transition-colors" style={{ flexShrink: 0 }}>
                    <Trash2 size={12} style={{ color: '#dc2626' }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Draft form */}
          {draft && (
            <div className="flex flex-col gap-3 p-3 rounded-xl" style={{ background: 'rgba(82,130,255,0.04)', border: '1px solid rgba(82,130,255,0.15)' }}>
              <Field label="TIPO DE PROJETO" required>
                <select value={draft.type} onChange={e => setDraft(d => d ? { ...d, type: e.target.value } : d)}
                        className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none" style={iStyle}>
                  {TIPOS_PROJETO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="NÚMERO" required>
                  <Input value={draft.number} onChange={e => setDraft(d => d ? { ...d, number: e.target.value } : d)} placeholder="PL 023/2026" />
                </Field>
                <Field label="TIPO DE VOTAÇÃO" required>
                  <select value={draft.votingType} onChange={e => setDraft(d => d ? { ...d, votingType: e.target.value as 'aberta' | 'secreta' } : d)}
                          className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none" style={iStyle}>
                    <option value="aberta">Aberta</option>
                    <option value="secreta">Secreta</option>
                  </select>
                </Field>
              </div>
              <Field label="TÍTULO" required>
                <Input value={draft.title} onChange={e => setDraft(d => d ? { ...d, title: e.target.value } : d)} placeholder="Institui o Programa..." />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="AUTOR" required>
                  <div className="relative">
                    <Input
                      value={draft.authorName}
                      onChange={e => { setDraft(d => d ? { ...d, authorName: e.target.value } : d); setAuthorOpen(true); }}
                      onFocus={() => setAuthorOpen(true)}
                      onBlur={() => setTimeout(() => setAuthorOpen(false), 150)}
                      placeholder="Nome do autor ou Executivo Municipal"
                    />
                    {authorOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg overflow-hidden shadow-lg"
                           style={{ background: 'white', border: '1px solid rgba(15,23,42,0.12)', maxHeight: 200, overflowY: 'auto' }}>
                        {/* Sugestões fixas */}
                        {['Executivo Municipal', 'Mesa Diretora', 'Comissão Permanente'].filter(s =>
                          !draft.authorName || s.toLowerCase().includes(draft.authorName.toLowerCase())
                        ).map(s => (
                          <button key={s} type="button" onMouseDown={() => { setDraft(d => d ? { ...d, authorName: s } : d); setAuthorOpen(false); }}
                                  className="w-full text-left px-3.5 py-2 text-sm hover:bg-gray-50 border-b"
                                  style={{ borderColor: 'rgba(15,23,42,0.06)', color: '#4B5563' }}>
                            <span className="text-xs font-mono-jet font-semibold mr-2" style={{ color: '#8A94A2' }}>INSTITUIÇÃO</span>
                            {s}
                          </button>
                        ))}
                        {/* Vereadores da câmara */}
                        {vereadores.filter(v =>
                          !draft.authorName || v.name.toLowerCase().includes(draft.authorName.toLowerCase())
                        ).map(v => (
                          <button key={v.id} type="button" onMouseDown={() => { setDraft(d => d ? { ...d, authorName: v.name } : d); setAuthorOpen(false); }}
                                  className="w-full text-left px-3.5 py-2 text-sm hover:bg-gray-50"
                                  style={{ color: '#0B1220' }}>
                            <span className="font-semibold">{v.name}</span>
                            {v.party && <span className="ml-2 text-xs font-mono-jet" style={{ color: '#8A94A2' }}>{v.party}</span>}
                          </button>
                        ))}
                        {!draft.authorName && vereadores.length === 0 && (
                          <p className="px-3.5 py-2 text-xs" style={{ color: '#8A94A2' }}>Nenhum vereador cadastrado</p>
                        )}
                      </div>
                    )}
                  </div>
                </Field>
                <Field label="QUÓRUM MÍNIMO" required>
                  <Input type="number" min="1" value={draft.quorumMinimum} onChange={e => setDraft(d => d ? { ...d, quorumMinimum: e.target.value } : d)} placeholder="5" />
                </Field>
              </div>
              <Field label="PDF DO PROJETO">
                <input ref={pdfRef} type="file" accept="application/pdf" className="hidden" onChange={e => e.target.files?.[0] && handlePdfUpload(e.target.files[0])} />
                {draft.pdfUrl ? (
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm" style={iStyle}>
                    <Paperclip size={14} style={{ color: '#059669' }} />
                    <span className="flex-1 text-xs truncate" style={{ color: '#059669' }}>PDF anexado</span>
                    <button type="button" onClick={() => setDraft(d => d ? { ...d, pdfUrl: '' } : d)} className="p-0.5 rounded hover:bg-red-50"><X size={12} style={{ color: '#dc2626' }} /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => pdfRef.current?.click()} disabled={draft.pdfUploading}
                          className="flex items-center gap-2 w-full px-3.5 py-2.5 rounded-lg text-sm" style={{ ...iStyle, color: '#8A94A2' }}>
                    {draft.pdfUploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                    {draft.pdfUploading ? 'Enviando…' : 'Anexar PDF'}
                  </button>
                )}
              </Field>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setDraft(null)} className="flex-1 py-2 rounded-lg text-xs font-semibold" style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563' }}>Cancelar</button>
                <button type="button" onClick={saveDraft} disabled={!draft.number || !draft.title || !draft.authorName}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: 'oklch(0.52 0.16 255)', opacity: (!draft.number || !draft.title || !draft.authorName) ? 0.5 : 1 }}>
                  Adicionar
                </button>
              </div>
            </div>
          )}
        </div>

        {error && <ErrorBox msg={error} />}
        <ModalActions onClose={onClose} loading={loading} label={`Criar Sessão${items.length > 0 ? ` + ${items.length} projeto(s)` : ''}`} />
      </form>
    </Modal>
  );
}

/* shared */
const iStyle: React.CSSProperties = { background: 'white', border: '1px solid rgba(15,23,42,0.12)', color: '#0B1220', transition: 'border-color 0.15s' };
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full px-3.5 py-2.5 rounded-lg text-sm outline-none ${props.className ?? ''}`} style={iStyle}
    onFocus={e => (e.target.style.borderColor = 'oklch(0.52 0.16 255)')} onBlur={e => (e.target.style.borderColor = 'rgba(15,23,42,0.12)')} />;
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
      <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: 'oklch(0.52 0.16 255)', opacity: loading ? 0.7 : 1 }}>
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
