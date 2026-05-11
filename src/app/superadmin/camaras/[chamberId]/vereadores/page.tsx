'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Pencil, X, Loader2, UserCheck, UserX,
  ImagePlus, Trash2, Eye, EyeOff,
} from 'lucide-react';
import api from '@/lib/api';

interface Vereador {
  id: string; name: string; email: string; role: string;
  title: string | null; party: string | null; initials: string;
  avatarUrl: string | null; isActive: boolean; lastLoginAt: string | null;
}
interface Chamber { id: string; name: string; city: string; state: string; }

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';
const ROLES = [
  { value: 'vereador', label: 'Vereador(a)' },
  { value: 'secretaria', label: 'Secretaria' },
  { value: 'presidente', label: 'Presidente' },
];

export default function VereadoresPage() {
  const { chamberId } = useParams<{ chamberId: string }>();
  const router = useRouter();
  const [chamber, setChamber] = useState<Chamber | null>(null);
  const [vereadores, setVereadores] = useState<Vereador[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Vereador | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, vRes] = await Promise.all([
        api.get(`/chambers/${chamberId}`),
        api.get(`/users/chamber/${chamberId}`),
      ]);
      setChamber(cRes.data);
      setVereadores(vRes.data);
    } finally { setLoading(false); }
  }, [chamberId]);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(v: Vereador) {
    setToggling(v.id);
    try {
      await api.patch(`/users/${v.id}`, { isActive: !v.isActive });
      setVereadores(prev => prev.map(u => u.id === v.id ? { ...u, isActive: !v.isActive } : u));
    } finally { setToggling(null); }
  }

  const active = vereadores.filter(v => v.isActive);
  const inactive = vereadores.filter(v => !v.isActive);

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#8A94A2' }}>
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h2 className="font-tight font-semibold text-2xl" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>
            Vereadores — {chamber?.name ?? '…'}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: '#8A94A2' }}>
            {active.length} ativos · {inactive.length} inativos
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-white"
                style={{ background: '#1447E6' }}>
          <Plus size={16} /> Novo Membro
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin" style={{ color: '#8A94A2' }} /></div>
      ) : (
        <div className="flex flex-col gap-2">
          {vereadores.map(v => (
            <div key={v.id} className="bg-white rounded-xl px-5 py-4 flex items-center gap-4 transition-opacity"
                 style={{ border: '1px solid rgba(15,23,42,0.08)', opacity: v.isActive ? 1 : 0.55 }}>
              <Avatar v={v} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: '#0B1220' }}>{v.name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#8A94A2' }}>
                  {v.email}
                  {v.party ? ` · ${v.party}` : ''}
                  {v.title ? ` · ${v.title}` : ''}
                </p>
              </div>
              <span className="text-[10px] font-mono-jet font-semibold px-2 py-0.5 rounded"
                    style={{ background: '#F0F4FF', color: '#1447E6' }}>
                {ROLES.find(r => r.value === v.role)?.label ?? v.role}
              </span>
              <span className="text-[10px] font-mono-jet font-semibold px-2 py-0.5 rounded"
                    style={{ background: v.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(15,23,42,0.06)', color: v.isActive ? '#059669' : '#8A94A2' }}>
                {v.isActive ? 'ATIVO' : 'INATIVO'}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => setEditTarget(v)} title="Editar"
                        className="p-1.5 rounded-lg transition-colors" style={{ color: '#8A94A2' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(20,71,230,0.08)'; e.currentTarget.style.color = '#1447E6'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8A94A2'; }}>
                  <Pencil size={13} />
                </button>
                <button onClick={() => toggleActive(v)} disabled={toggling === v.id}
                        title={v.isActive ? 'Desativar' : 'Ativar'}
                        className="p-1.5 rounded-lg transition-colors" style={{ color: '#8A94A2' }}
                        onMouseEnter={e => { e.currentTarget.style.background = v.isActive ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)'; e.currentTarget.style.color = v.isActive ? '#dc2626' : '#059669'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8A94A2'; }}>
                  {toggling === v.id ? <Loader2 size={13} className="animate-spin" /> : v.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                </button>
              </div>
            </div>
          ))}
          {vereadores.length === 0 && (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="font-semibold" style={{ color: '#0B1220' }}>Nenhum membro cadastrado</p>
              <p className="text-sm mt-1" style={{ color: '#8A94A2' }}>Clique em "Novo Membro" para adicionar.</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <VereadorModal
          chamberId={chamberId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
      {editTarget && (
        <VereadorModal
          chamberId={chamberId}
          vereador={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); load(); }}
        />
      )}
    </div>
  );
}

function Avatar({ v }: { v: Vereador }) {
  if (v.avatarUrl) return (
    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${API_BASE}${v.avatarUrl}`} alt={v.name} className="w-full h-full object-cover" />
    </div>
  );
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
         style={{ background: '#1447E6' }}>
      {v.initials}
    </div>
  );
}

function VereadorModal({
  chamberId, vereador, onClose, onSaved,
}: {
  chamberId: string;
  vereador?: Vereador;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!vereador;
  const [form, setForm] = useState({
    name: vereador?.name ?? '',
    email: vereador?.email ?? '',
    role: vereador?.role ?? 'vereador',
    title: vereador?.title ?? '',
    party: vereador?.party ?? '',
    password: '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    vereador?.avatarUrl ? `${API_BASE}${vereador.avatarUrl}` : null,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      let avatarUrl: string | undefined;
      if (avatarFile) {
        const fd = new FormData(); fd.append('file', avatarFile);
        const { data: up } = await api.post('/upload/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        avatarUrl = up.url;
      }
      if (isEdit) {
        const patch: any = { name: form.name, email: form.email, role: form.role, title: form.title || undefined, party: form.party || undefined };
        if (avatarUrl) patch.avatarUrl = avatarUrl;
        await api.patch(`/users/${vereador!.id}`, patch);
      } else {
        const payload: any = {
          chamberId,
          name: form.name,
          email: form.email,
          role: form.role,
          title: form.title || undefined,
          party: form.party || undefined,
          password: form.password,
        };
        if (avatarUrl) payload.avatarUrl = avatarUrl;
        await api.post('/users', payload);
      }
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao salvar');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(11,18,32,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col"
           style={{ border: '1px solid rgba(15,23,42,0.08)', maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0"
             style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
          <h2 className="font-tight font-semibold text-lg" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>
            {isEdit ? 'Editar Membro' : 'Novo Membro'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
            <X size={18} style={{ color: '#8A94A2' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4 overflow-y-auto flex-1">
          {/* Avatar */}
          <div>
            <p className="text-xs font-semibold font-mono-jet mb-2" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>
              FOTO <span className="font-normal">(opcional)</span>
            </p>
            {avatarPreview ? (
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0"
                     style={{ border: '1px solid rgba(15,23,42,0.12)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarPreview} alt="preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  {avatarFile && <p className="text-sm font-semibold truncate" style={{ color: '#0B1220' }}>{avatarFile.name}</p>}
                  {!avatarFile && <p className="text-xs" style={{ color: '#8A94A2' }}>Foto atual</p>}
                </div>
                <button type="button" onClick={() => { setAvatarFile(null); setAvatarPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                        className="p-2 rounded-lg hover:bg-red-50" style={{ color: '#8A94A2' }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm transition-all"
                      style={{ border: '2px dashed rgba(15,23,42,0.12)', color: '#8A94A2' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#1447E6'; e.currentTarget.style.color = '#1447E6'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(15,23,42,0.12)'; e.currentTarget.style.color = '#8A94A2'; }}>
                <ImagePlus size={16} /> Clique para enviar foto
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />
          </div>

          <Field label="NOME COMPLETO" required>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nome do membro" required />
          </Field>
          <Field label="E-MAIL" required>
            <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@camara.leg.br" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="FUNÇÃO" required>
              <select value={form.role} onChange={e => set('role', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none"
                      style={{ background: 'white', border: '1px solid rgba(15,23,42,0.12)', color: '#0B1220' }}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="PARTIDO">
              <Input value={form.party} onChange={e => set('party', e.target.value.toUpperCase())} placeholder="MDB, PT…" />
            </Field>
          </div>
          <Field label="TÍTULO" hint="(opcional)">
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ex: Vereador, Dr., Cel." />
          </Field>
          {!isEdit && (
            <Field label="SENHA" required>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  minLength={8}
                  required
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#8A94A2' }}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>
          )}

          {error && (
            <div className="px-3.5 py-3 rounded-lg text-sm"
                 style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                    style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563' }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
                    style={{ background: '#1447E6', opacity: loading ? 0.7 : 1 }}>
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const iStyle: React.CSSProperties = { background: 'white', border: '1px solid rgba(15,23,42,0.12)', color: '#0B1220', transition: 'border-color 0.15s' };
function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className={`w-full px-3.5 py-2.5 rounded-lg text-sm outline-none ${className}`} style={iStyle}
           onFocus={e => (e.target.style.borderColor = '#1447E6')}
           onBlur={e => (e.target.style.borderColor = 'rgba(15,23,42,0.12)')} />
  );
}
function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold font-mono-jet" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
        {hint && <span className="font-normal ml-1.5 normal-case" style={{ letterSpacing: '0' }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}
