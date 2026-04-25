'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, Plus, X, Loader2, AlertCircle, Paperclip, Trash2, ExternalLink } from 'lucide-react';
import api from '@/lib/api';

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

interface AgendaItem {
  id: string;
  number: string;
  type: string;
  title: string;
  description: string | null;
  authorName: string;
  votingType: 'aberta' | 'secreta';
  quorumMinimum: number;
  orderIndex: number;
  status: 'pendente' | 'em_votacao' | 'aprovado' | 'rejeitado' | 'retirado';
  votesYes: number;
  votesNo: number;
  votesAbstain: number;
  pdfUrl: string | null;
}

interface ActiveSession { id: string; number: number; type: string; status: string; }

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  pendente:    { label: 'Pendente',    bg: 'rgba(15,23,42,0.06)',   color: '#8A94A2' },
  em_votacao:  { label: 'Em votação',  bg: 'rgba(82,130,255,0.1)',  color: 'oklch(0.52 0.16 255)' },
  aprovado:    { label: 'Aprovado',    bg: 'rgba(16,185,129,0.1)',  color: '#059669' },
  rejeitado:   { label: 'Reprovado',   bg: 'rgba(239,68,68,0.1)',   color: '#dc2626' },
  retirado:    { label: 'Retirado',    bg: 'rgba(234,179,8,0.1)',   color: '#b45309' },
};

export default function PautaPage() {
  const { user } = useAuth();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchSession = useCallback(async () => {
    if (!user?.chamberId) return;
    try {
      const { data } = await api.get(`/sessions/current/${user.chamberId}`);
      setSession(data);
      return data?.id as string | undefined;
    } catch { setSession(null); return null; }
  }, [user?.chamberId]);

  const fetchItems = useCallback(async (sessionId: string) => {
    const { data } = await api.get(`/agenda/session/${sessionId}`);
    setItems(data);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const sid = await fetchSession();
      if (sid) await fetchItems(sid);
      else setItems([]);
    } finally { setLoading(false); }
  }, [fetchSession, fetchItems]);

  useEffect(() => { reload(); }, [reload]);

  const canCreate = user?.role === 'presidente' && (session?.status === 'em_andamento' || session?.status === 'agendada');

  if (loading) return <div className="p-8"><Spinner /></div>;

  if (!session) return (
    <div className="p-8">
      <h2 className="font-tight font-semibold text-2xl mb-2" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>Ordem do Dia</h2>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle size={36} style={{ color: '#D1D5DB' }} />
        <p className="mt-4 font-semibold" style={{ color: '#0B1220' }}>Nenhuma sessão ativa</p>
        <p className="text-sm mt-1" style={{ color: '#8A94A2' }}>Crie ou inicie uma sessão na página Sessões para gerenciar a pauta.</p>
      </div>
    </div>
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-tight font-semibold text-2xl" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>Ordem do Dia</h2>
          <p className="text-sm mt-1" style={{ color: '#8A94A2' }}>
            {session.number}ª Sessão · {items.length} item(s) na pauta
          </p>
        </div>
        {canCreate && (
          <button onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-white hover:opacity-90 transition-opacity"
                  style={{ background: 'oklch(0.52 0.16 255)' }}>
            <Plus size={16} /> Adicionar Item
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <Empty icon={<FileText size={36} style={{ color: '#D1D5DB' }} />} text="Nenhum item na pauta." />
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '40px 130px 1fr 90px 110px', gap: 12, alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid rgba(15,23,42,0.06)', background: '#F6F7F9' }}>
            {['#', 'NÚMERO', 'TÍTULO / AUTOR', 'VOTAÇÃO', 'STATUS'].map(h => (
              <span key={h} className="font-mono-jet text-[10px] font-semibold" style={{ color: '#8A94A2', letterSpacing: '0.07em' }}>{h}</span>
            ))}
          </div>
          {items.map((item, i) => {
            const st = STATUS_STYLE[item.status];
            return (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '40px 130px 1fr 90px 110px', gap: 12, alignItems: 'center', padding: '14px 20px', borderBottom: i < items.length - 1 ? '1px solid rgba(15,23,42,0.05)' : 'none' }}>
                {/* Index */}
                <span className="font-mono-jet font-bold text-xs" style={{ color: '#8A94A2' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {/* Number + type */}
                <div className="min-w-0">
                  <p className="font-mono-jet text-xs font-semibold truncate" style={{ color: '#0B1220' }}>{item.number}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: '#8A94A2' }}>{item.type}</p>
                </div>
                {/* Title + author */}
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate leading-snug" style={{ color: '#0B1220' }}>{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs truncate" style={{ color: '#8A94A2' }}>{item.authorName}</p>
                    {item.pdfUrl && (
                      <a href={`${API_BASE}${item.pdfUrl}`} target="_blank" rel="noopener noreferrer"
                         className="flex items-center gap-1 text-xs font-semibold flex-shrink-0 transition-opacity hover:opacity-70"
                         style={{ color: 'oklch(0.52 0.16 255)' }}>
                        <Paperclip size={10} /> PDF
                      </a>
                    )}
                  </div>
                  {(item.status === 'aprovado' || item.status === 'rejeitado') && (
                    <div className="flex gap-3 mt-1 text-xs">
                      <span style={{ color: '#059669' }}>SIM {item.votesYes}</span>
                      <span style={{ color: '#dc2626' }}>NÃO {item.votesNo}</span>
                      <span style={{ color: '#8A94A2' }}>ABS {item.votesAbstain}</span>
                    </div>
                  )}
                </div>
                {/* Voting type */}
                <span className="text-xs font-mono-jet font-semibold px-2 py-0.5 rounded w-fit"
                      style={{ background: item.votingType === 'secreta' ? 'rgba(139,92,246,0.1)' : 'rgba(82,130,255,0.08)', color: item.votingType === 'secreta' ? '#6d28d9' : 'oklch(0.52 0.16 255)' }}>
                  {item.votingType === 'secreta' ? 'SECRETA' : 'ABERTA'}
                </span>
                {/* Status */}
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold font-mono-jet w-fit"
                      style={{ background: st.bg, color: st.color }}>{st.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {showModal && session && (
        <NewItemModal sessionId={session.id} chamberId={user!.chamberId!} orderIndex={items.length}
          onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); reload(); }} />
      )}
    </div>
  );
}

interface VereadorOption { id: string; name: string; party?: string | null; role: string; }

function NewItemModal({ sessionId, chamberId, orderIndex, onClose, onCreated }: {
  sessionId: string; chamberId: string; orderIndex: number; onClose: () => void; onCreated: () => void;
}) {
  const [form, setForm] = useState({
    number: '', type: 'Projeto de Lei', title: '', description: '',
    authorName: '', votingType: 'aberta', quorumMinimum: '5',
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
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

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let pdfUrl: string | undefined;
      if (pdfFile) {
        const fd = new FormData();
        fd.append('file', pdfFile);
        const { data: up } = await api.post('/upload/pdf', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        pdfUrl = up.url;
      }
      await api.post('/agenda', {
        sessionId, chamberId, orderIndex,
        number: form.number, type: form.type, title: form.title,
        description: form.description || undefined,
        authorName: form.authorName,
        votingType: form.votingType,
        quorumMinimum: Number(form.quorumMinimum),
        ...(pdfUrl ? { pdfUrl } : {}),
      });
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao adicionar item');
    } finally { setLoading(false); }
  }

  const fixedSuggestions = ['Executivo Municipal', 'Mesa Diretora', 'Comissão Permanente'];

  return (
    <Modal title="Novo Item de Pauta" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="TIPO DE MATÉRIA" required>
          <select value={form.type} onChange={e => set('type', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none" style={iStyle}>
            {TIPOS_PROJETO.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="NÚMERO" required>
          <Input value={form.number} onChange={e => set('number', e.target.value)} placeholder="PL 001/2026" required />
        </Field>
        <Field label="TÍTULO" required>
          <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Institui o programa..." required />
        </Field>
        <Field label="DESCRIÇÃO / EMENTA">
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
                    placeholder="Disposições e ementa do projeto..." rows={3}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none resize-none"
                    style={iStyle}
                    onFocus={e => (e.target.style.borderColor = 'oklch(0.52 0.16 255)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(15,23,42,0.12)')} />
        </Field>
        <Field label="PROPONENTE" required>
          <div className="relative">
            <Input
              value={form.authorName}
              onChange={e => { set('authorName', e.target.value); setAuthorOpen(true); }}
              onFocus={() => setAuthorOpen(true)}
              onBlur={() => setTimeout(() => setAuthorOpen(false), 150)}
              placeholder="Nome do vereador ou Executivo Municipal"
              required
            />
            {authorOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg overflow-hidden shadow-lg"
                   style={{ background: 'white', border: '1px solid rgba(15,23,42,0.12)', maxHeight: 200, overflowY: 'auto' }}>
                {fixedSuggestions
                  .filter(s => !form.authorName || s.toLowerCase().includes(form.authorName.toLowerCase()))
                  .map(s => (
                    <button key={s} type="button"
                            onMouseDown={() => { set('authorName', s); setAuthorOpen(false); }}
                            className="w-full text-left px-3.5 py-2 text-sm hover:bg-gray-50 border-b"
                            style={{ borderColor: 'rgba(15,23,42,0.06)', color: '#4B5563' }}>
                      <span className="text-xs font-mono-jet font-semibold mr-2" style={{ color: '#8A94A2' }}>INSTITUIÇÃO</span>
                      {s}
                    </button>
                  ))}
                {vereadores
                  .filter(v => !form.authorName || v.name.toLowerCase().includes(form.authorName.toLowerCase()))
                  .map(v => (
                    <button key={v.id} type="button"
                            onMouseDown={() => { set('authorName', v.name); setAuthorOpen(false); }}
                            className="w-full text-left px-3.5 py-2 text-sm hover:bg-gray-50"
                            style={{ color: '#0B1220' }}>
                      <span className="font-semibold">{v.name}</span>
                      {v.party && <span className="ml-2 text-xs font-mono-jet" style={{ color: '#8A94A2' }}>{v.party}</span>}
                    </button>
                  ))}
                {!form.authorName && vereadores.length === 0 && (
                  <p className="px-3.5 py-2 text-xs" style={{ color: '#8A94A2' }}>Nenhum vereador cadastrado</p>
                )}
              </div>
            )}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="TIPO DE VOTAÇÃO" required>
            <select value={form.votingType} onChange={e => set('votingType', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none" style={iStyle}>
              <option value="aberta">Aberta</option>
              <option value="secreta">Secreta</option>
            </select>
          </Field>
          <Field label="QUÓRUM MÍNIMO" required>
            <Input type="number" min="1" value={form.quorumMinimum} onChange={e => set('quorumMinimum', e.target.value)} required />
          </Field>
        </div>

        {/* PDF upload */}
        <Field label="DOCUMENTO PDF">
          {pdfFile ? (
            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg" style={{ border: '1px solid rgba(15,23,42,0.12)', background: 'white' }}>
              <Paperclip size={14} style={{ color: 'oklch(0.52 0.16 255)', flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#0B1220' }}>{pdfFile.name}</p>
                <p className="text-xs" style={{ color: '#8A94A2' }}>{(pdfFile.size / 1024).toFixed(0)} KB</p>
              </div>
              <button type="button" onClick={() => { setPdfFile(null); if (pdfRef.current) pdfRef.current.value = ''; }}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0" style={{ color: '#8A94A2' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => pdfRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm transition-all"
                    style={{ border: '2px dashed rgba(15,23,42,0.12)', color: '#8A94A2' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'oklch(0.52 0.16 255)'; e.currentTarget.style.color = 'oklch(0.52 0.16 255)'; e.currentTarget.style.background = 'rgba(82,130,255,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(15,23,42,0.12)'; e.currentTarget.style.color = '#8A94A2'; e.currentTarget.style.background = 'transparent'; }}>
              <Paperclip size={15} /> Anexar PDF do projeto (máx. 20 MB)
            </button>
          )}
          <input ref={pdfRef} type="file" accept="application/pdf" onChange={handlePdfChange} className="hidden" />
        </Field>

        {error && <ErrorBox msg={error} />}
        <ModalActions onClose={onClose} loading={loading} label="Adicionar" />
      </form>
    </Modal>
  );
}

/* shared */
const iStyle: React.CSSProperties = { background: 'white', border: '1px solid rgba(15,23,42,0.12)', color: '#0B1220', transition: 'border-color 0.15s' };
function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full px-3.5 py-2.5 rounded-lg text-sm outline-none ${className}`} style={iStyle}
    onFocus={e => (e.target.style.borderColor = 'oklch(0.52 0.16 255)')} onBlur={e => (e.target.style.borderColor = 'rgba(15,23,42,0.12)')} />;
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold font-mono-jet" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>{label}{required && <span style={{ color: '#dc2626' }}> *</span>}</label>{children}</div>;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(11,18,32,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col" style={{ border: '1px solid rgba(15,23,42,0.08)', maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
          <h2 className="font-tight font-semibold text-lg" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100"><X size={18} style={{ color: '#8A94A2' }} /></button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
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
function Spinner() { return <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin" style={{ color: '#8A94A2' }} /></div>; }
function Empty({ icon, text }: { icon: React.ReactNode; text: string }) { return <div className="flex flex-col items-center justify-center py-20 text-center">{icon}<p className="mt-4 text-sm" style={{ color: '#8A94A2' }}>{text}</p></div>; }
