'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Plus, X, Loader2, Eye, EyeOff, ImagePlus, Trash2, Pencil, ChevronRight, Shield, Check } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';

interface Vereador {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: string;
  title: string | null;
  party: string | null;
  initials: string;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';

const CARGOS = [
  { title: 'Presidente',       role: 'presidente' },
  { title: 'Vice-presidente',  role: 'vereador'   },
  { title: '1º Secretário(a)', role: 'secretaria' },
  { title: '2º Secretário(a)', role: 'secretaria' },
  { title: 'Vereador',         role: 'vereador'   },
] as const;

function displayTitle(v: Vereador) {
  return v.title ?? (v.role === 'presidente' ? 'Presidente' : v.role === 'secretaria' ? 'Secretaria' : 'Vereador');
}

const AVATAR_PALETTE = [
  { a: '#E0E7FF', b: '#C7D2FE', fg: '#3730A3' },
  { a: '#FCE7F3', b: '#FBCFE8', fg: '#9D174D' },
  { a: '#FEF3C7', b: '#FDE68A', fg: '#78350F' },
  { a: '#DCFCE7', b: '#BBF7D0', fg: '#14532D' },
  { a: '#E0F2FE', b: '#BAE6FD', fg: '#075985' },
  { a: '#F3E8FF', b: '#E9D5FF', fg: '#581C87' },
  { a: '#FFE4E6', b: '#FECDD3', fg: '#881337' },
  { a: '#ECFCCB', b: '#D9F99D', fg: '#365314' },
  { a: '#E2E8F0', b: '#CBD5E1', fg: '#334155' },
];

function avatarColor(name: string) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function StripedAvatar({ size = 40, initials = '', name = '', avatarUrl = null as string | null }) {
  const c = avatarColor(name || initials);
  if (avatarUrl) {
    return (
      <div style={{ width: size, height: size, borderRadius: 999, overflow: 'hidden', flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${API_BASE}${avatarUrl}`} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      background: `repeating-linear-gradient(45deg, ${c.a} 0 4px, ${c.b} 4px 8px)`,
    }}>
      <div style={{
        fontFamily: 'Inter Tight, sans-serif', fontWeight: 700,
        fontSize: size * 0.34, color: c.fg, letterSpacing: -0.4,
        background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(3px)',
        padding: `${size * 0.04}px ${size * 0.1}px`, borderRadius: 4,
      }}>{initials}</div>
    </div>
  );
}

const COL = '1fr 90px 170px 120px 120px 20px';

function formatLastLogin(val: string | null): string {
  if (!val) return '—';
  const d = new Date(val);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
         d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function exportCsv(list: Vereador[]) {
  const header = 'Nome,E-mail,Partido,Cargo,Situação,Último acesso';
  const rows = list.map(v =>
    [v.name, v.email, v.party ?? '', displayTitle(v), v.isActive ? 'Ativo' : 'Inativo', formatLastLogin(v.lastLoginAt)].join(',')
  );
  const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'vereadores.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function VereadoresPage() {
  const { user } = useAuth();
  const [list, setList] = useState<Vereador[]>([]);
  const [filtered, setFiltered] = useState<Vereador[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<Vereador | null>(null);
  const [editTarget, setEditTarget] = useState<Vereador | null>(null);

  const fetchList = useCallback(async () => {
    if (!user?.chamberId) return;
    try {
      const { data } = await api.get(`/users/chamber/${user.chamberId}`);
      setList(data);
      setFiltered(data);
    } finally {
      setLoading(false);
    }
  }, [user?.chamberId]);

  useEffect(() => { fetchList(); }, [fetchList]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q ? list.filter(v =>
      v.name.toLowerCase().includes(q) ||
      (v.party ?? '').toLowerCase().includes(q) ||
      displayTitle(v).toLowerCase().includes(q)
    ) : list);
  }, [search, list]);

  const canCreate = user?.role === 'presidente';
  const presentes = list.filter(v => v.isActive).length;

  function handleSelect(v: Vereador) {
    setSelected(prev => prev?.id === v.id ? null : v);
  }

  return (
    <div className="p-8">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="font-mono-jet text-[10px] font-semibold mb-1" style={{ color: '#8A94A2', letterSpacing: '0.1em' }}>USUÁRIOS</p>
          <h2 className="font-tight font-semibold text-2xl" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>Vereadores</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportCsv(list)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{ border: '1px solid rgba(15,23,42,0.14)', color: '#4B5563', background: 'white' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F6F7F9'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar CSV
          </button>
          {canCreate && (
            <button onClick={() => setShowModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm text-white hover:opacity-90 transition-opacity"
                    style={{ background: 'oklch(0.52 0.16 255)' }}>
              <Plus size={15} /> Cadastrar vereador
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 360px' : '1fr', gap: 24, alignItems: 'start' }}>
        {/* ── Left: list ── */}
        <div>
          {/* Search + count */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative" style={{ maxWidth: 280 }}>
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" fill="none" stroke="#8A94A2" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, partido ou cargo..."
                     className="w-full pl-9 pr-3.5 py-2 rounded-lg text-sm outline-none"
                     style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#0B1220', background: 'white', minWidth: 260 }}
                     onFocus={e => e.target.style.borderColor = 'oklch(0.52 0.16 255)'}
                     onBlur={e => e.target.style.borderColor = 'rgba(15,23,42,0.12)'} />
            </div>
            <p className="text-sm flex-shrink-0" style={{ color: '#8A94A2' }}>
              {filtered.length} de {list.length} ·{' '}
              <span className="font-semibold" style={{ color: '#059669' }}>{presentes} presentes</span>
            </p>
          </div>

          {loading ? (
            <Spinner />
          ) : filtered.length === 0 ? (
            <Empty icon={<Users size={36} style={{ color: '#D1D5DB' }} />} text="Nenhum membro encontrado." />
          ) : (
            <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: COL, gap: 8, padding: '8px 20px', background: '#F6F7F9', borderBottom: '1px solid rgba(15,23,42,0.07)' }}>
                {['VEREADOR', 'PARTIDO', 'CARGO', 'PRESENÇA', 'ÚLT. ACESSO', ''].map(h => (
                  <span key={h} className="font-mono-jet text-[10px] font-semibold" style={{ color: '#8A94A2', letterSpacing: '0.07em' }}>{h}</span>
                ))}
              </div>
              {/* Rows */}
              {filtered.map((v, i) => {
                const isSelected = selected?.id === v.id;
                return (
                  <button key={v.id} onClick={() => handleSelect(v)}
                          className="w-full text-left transition-colors"
                          style={{
                            display: 'grid', gridTemplateColumns: COL, gap: 8,
                            alignItems: 'center', padding: '12px 20px',
                            borderBottom: i < filtered.length - 1 ? '1px solid rgba(15,23,42,0.05)' : 'none',
                            background: isSelected ? 'rgba(82,130,255,0.04)' : 'transparent',
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(15,23,42,0.02)'; }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? 'rgba(82,130,255,0.04)' : 'transparent'; }}>
                    {/* VEREADOR */}
                    <div className="flex items-center gap-3 min-w-0">
                      <StripedAvatar size={36} initials={v.initials} name={v.name} avatarUrl={v.avatarUrl} />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: '#0B1220' }}>{v.name}</p>
                        <p className="text-xs truncate mt-0.5" style={{ color: '#8A94A2' }}>{v.email}</p>
                      </div>
                    </div>
                    {/* PARTIDO */}
                    <div>
                      {v.party ? (
                        <span className="inline-block text-xs font-mono-jet font-semibold px-2 py-0.5 rounded"
                              style={{ border: '1px solid rgba(15,23,42,0.18)', color: '#4B5563', background: 'white' }}>
                          {v.party}
                        </span>
                      ) : <span style={{ color: '#C4CAD4' }}>—</span>}
                    </div>
                    {/* CARGO */}
                    <span className="text-sm truncate" style={{ color: '#374151' }}>{displayTitle(v)}</span>
                    {/* PRESENÇA */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: v.isActive ? '#10B981' : '#EF4444' }} />
                      <span className="text-xs font-semibold font-mono-jet"
                            style={{ color: v.isActive ? '#059669' : '#DC2626' }}>
                        {v.isActive ? 'PRESENTE' : 'AUSENTE'}
                      </span>
                    </div>
                    {/* ÚLT. ACESSO */}
                    <span className="text-xs font-mono-jet" style={{ color: '#8A94A2' }}>
                      {formatLastLogin(v.lastLoginAt)}
                    </span>
                    {/* Chevron */}
                    <ChevronRight size={14} style={{ color: '#8A94A2', transform: isSelected ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: detail drawer ── */}
        {selected && (
          <div className="bg-white rounded-xl" style={{ border: '1px solid rgba(15,23,42,0.08)', position: 'sticky', top: 24, overflow: 'hidden' }}>
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(15,23,42,0.07)' }}>
              <span className="font-mono-jet text-[10px] font-semibold" style={{ color: '#8A94A2', letterSpacing: '0.1em' }}>DETALHE</span>
              <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={14} style={{ color: '#8A94A2' }} />
              </button>
            </div>

            <div className="p-5">
              {/* Avatar + name */}
              <div className="flex items-center gap-3 mb-4">
                <StripedAvatar size={72} initials={selected.initials} name={selected.name} avatarUrl={selected.avatarUrl} />
                <div>
                  <p className="font-tight font-semibold text-base leading-snug" style={{ color: '#0B1220', letterSpacing: '-0.01em' }}>{selected.name}</p>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {selected.party && (
                      <span className="text-xs px-2 py-0.5 rounded font-mono-jet font-semibold"
                            style={{ border: '1px solid rgba(15,23,42,0.18)', color: '#4B5563', background: 'white' }}>
                        {selected.party}
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded font-mono-jet font-semibold"
                          style={{ background: 'rgba(82,130,255,0.08)', color: 'oklch(0.52 0.16 255)' }}>
                      {displayTitle(selected)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label: 'VOTOS EM 2026', value: '—' },
                  { label: 'PRESENÇA',      value: '—' },
                  { label: 'PROJETOS AUTOR', value: '—' },
                  { label: 'FALTAS',        value: '—' },
                ].map(s => (
                  <div key={s.label} className="rounded-lg px-3 py-2.5" style={{ background: '#F6F7F9', border: '1px solid rgba(15,23,42,0.06)' }}>
                    <p className="font-mono-jet text-[9px] font-semibold mb-0.5" style={{ color: '#8A94A2', letterSpacing: '0.07em' }}>{s.label}</p>
                    <p className="font-tight font-semibold text-lg" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Permissions */}
              <p className="font-mono-jet text-[10px] font-semibold mb-2.5" style={{ color: '#8A94A2', letterSpacing: '0.08em' }}>PERMISSÕES</p>
              <div className="flex flex-col gap-2 mb-5">
                {[
                  { label: 'Votar em sessões',        allowed: ['presidente', 'vereador'].includes(selected.role) },
                  { label: 'Cadastrar projetos',      allowed: selected.role === 'presidente' },
                  { label: 'Abrir/encerrar votações', allowed: selected.role === 'presidente' },
                  { label: 'Acessar auditoria',       allowed: true },
                ].map(p => (
                  <div key={p.label} className="flex items-center gap-2.5 text-sm" style={{ color: p.allowed ? '#0B1220' : '#8A94A2' }}>
                    <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                         style={{ background: p.allowed ? 'rgba(16,185,129,0.12)' : 'rgba(15,23,42,0.06)' }}>
                      {p.allowed && <Check size={10} style={{ color: '#059669' }} />}
                    </div>
                    <span>{p.label}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {canCreate && (selected.role !== 'presidente' || selected.id === user?.id) && (
                  <button onClick={() => setEditTarget(selected)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors"
                          style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F6F7F9'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <Pencil size={13} /> {selected.id === user?.id ? 'Editar meu perfil' : 'Editar'}
                  </button>
                )}
                <Link href="/dashboard/auditoria"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors"
                      style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F6F7F9'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <Shield size={13} /> Ver logs
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <NewVereadorModal chamberId={user!.chamberId!} onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); fetchList(); }} />
      )}
      {editTarget && (
        <EditVereadorModal vereador={editTarget} onClose={() => setEditTarget(null)} onSaved={() => {
          setEditTarget(null);
          fetchList().then(() => {
            setSelected(prev => prev?.id === editTarget.id ? { ...prev, ...editTarget } : prev);
          });
        }} />
      )}
    </div>
  );
}

/* ── New Member Modal ─────────────────────────────────────────── */

function NewVereadorModal({ chamberId, onClose, onCreated }: { chamberId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '', cargo: 'Vereador', party: '', initials: '' });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const avatarRef = useRef<HTMLInputElement>(null);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cargoEntry = CARGOS.find(c => c.title === form.cargo) ?? CARGOS[4];
      const payload: any = {
        chamberId, name: form.name, email: form.email, password: form.password,
        role: cargoEntry.role, title: form.cargo,
      };
      if (form.username.trim()) payload.username = form.username.trim().toLowerCase();
      if (form.party) payload.party = form.party;
      if (form.initials) payload.initials = form.initials;
      const { data: created } = await api.post('/users', payload);

      if (avatarFile) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        const { data: av } = await api.post('/upload/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        await api.patch(`/users/${created.id}`, { avatarUrl: av.url });
      }

      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao cadastrar membro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Novo Membro" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-semibold font-mono-jet mb-2" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>
            FOTO <span className="font-normal">(opcional)</span>
          </p>
          {avatarPreview ? (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(15,23,42,0.12)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarPreview} alt="preview" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#0B1220' }}>{avatarFile?.name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#8A94A2' }}>{avatarFile ? (avatarFile.size / 1024).toFixed(0) + ' KB' : ''}</p>
              </div>
              <button type="button" onClick={() => { setAvatarFile(null); setAvatarPreview(null); if (avatarRef.current) avatarRef.current.value = ''; }}
                      className="p-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0" style={{ color: '#8A94A2' }}>
                <Trash2 size={15} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => avatarRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm transition-all"
                    style={{ border: '2px dashed rgba(15,23,42,0.12)', color: '#8A94A2' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'oklch(0.52 0.16 255)'; e.currentTarget.style.color = 'oklch(0.52 0.16 255)'; e.currentTarget.style.background = 'rgba(82,130,255,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(15,23,42,0.12)'; e.currentTarget.style.color = '#8A94A2'; e.currentTarget.style.background = 'transparent'; }}>
              <ImagePlus size={16} /> Clique para enviar a foto
            </button>
          )}
          <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />
        </div>

        <Field label="NOME COMPLETO" required>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Beatriz Monteiro" required />
        </Field>
        <Field label="E-MAIL" required>
          <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="beatriz@camara.leg.br" required />
        </Field>
        <Field label="USUÁRIO (login)" required>
          <Input value={form.username} onChange={e => set('username', e.target.value.toLowerCase().replace(/\s/g, ''))}
                 placeholder="beatriz" minLength={3} required />
          <p className="text-xs mt-1" style={{ color: '#8A94A2' }}>Usado para entrar no sistema. Só letras, números e ponto.</p>
        </Field>
        <Field label="SENHA" required>
          <div className="relative">
            <Input type={showPwd ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)}
                   placeholder="Mínimo 8 caracteres" minLength={8} required className="pr-10" />
            <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#8A94A2' }}>
              {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </Field>
        <Field label="CARGO" required>
          <select value={form.cargo} onChange={e => set('cargo', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none" style={iStyle}>
            {CARGOS.map(c => <option key={c.title} value={c.title}>{c.title}</option>)}
          </select>
        </Field>
        <Field label="PARTIDO">
          <Input value={form.party} onChange={e => set('party', e.target.value)} placeholder="PSB" />
        </Field>
        <Field label="SIGLA">
          <Input value={form.initials} onChange={e => set('initials', e.target.value.toUpperCase())} placeholder="BM" maxLength={4} />
        </Field>
        {error && <ErrorBox msg={error} />}
        <ModalActions onClose={onClose} loading={loading} label="Cadastrar" />
      </form>
    </Modal>
  );
}

/* ── Edit Member Modal ────────────────────────────────────────── */

function EditVereadorModal({ vereador, onClose, onSaved }: { vereador: Vereador; onClose: () => void; onSaved: () => void }) {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    name: vereador.name,
    email: vereador.email,
    username: vereador.username ?? '',
    cargo: vereador.title ?? 'Vereador',
    party: vereador.party ?? '',
    initials: vereador.initials ?? '',
    isActive: vereador.isActive,
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    vereador.avatarUrl ? `${API_BASE}${vereador.avatarUrl}` : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const avatarRef = useRef<HTMLInputElement>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdError, setPwdError] = useState('');

  function set(k: string, v: string | boolean) { setForm(f => ({ ...f, [k]: v })); }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cargoEntry = CARGOS.find(c => c.title === form.cargo) ?? CARGOS[4];
      const patch: any = {
        name: form.name, email: form.email,
        username: form.username.trim().toLowerCase() || null,
        role: cargoEntry.role, title: form.cargo,
        party: form.party || null,
        initials: form.initials || undefined,
        isActive: form.isActive,
      };
      if (avatarFile) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        const { data: av } = await api.post('/upload/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        patch.avatarUrl = av.url;
      }
      await api.patch(`/users/${vereador.id}`, patch);
      if (vereador.id === user?.id) await refreshUser();
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Editar Membro" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-semibold font-mono-jet mb-2" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>FOTO</p>
          {avatarPreview ? (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(15,23,42,0.12)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarPreview} alt="preview" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                {avatarFile
                  ? <><p className="text-sm font-semibold truncate" style={{ color: '#0B1220' }}>{avatarFile.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#8A94A2' }}>{(avatarFile.size / 1024).toFixed(0)} KB</p></>
                  : <p className="text-xs" style={{ color: '#8A94A2' }}>Foto atual</p>}
              </div>
              <button type="button" onClick={() => { setAvatarFile(null); setAvatarPreview(null); if (avatarRef.current) avatarRef.current.value = ''; }}
                      className="p-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0" style={{ color: '#8A94A2' }}>
                <Trash2 size={15} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => avatarRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm transition-all"
                    style={{ border: '2px dashed rgba(15,23,42,0.12)', color: '#8A94A2' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'oklch(0.52 0.16 255)'; e.currentTarget.style.color = 'oklch(0.52 0.16 255)'; e.currentTarget.style.background = 'rgba(82,130,255,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(15,23,42,0.12)'; e.currentTarget.style.color = '#8A94A2'; e.currentTarget.style.background = 'transparent'; }}>
              <ImagePlus size={16} /> Clique para enviar a foto
            </button>
          )}
          <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />
        </div>

        <Field label="NOME COMPLETO" required>
          <Input value={form.name} onChange={e => set('name', e.target.value)} required />
        </Field>
        <Field label="E-MAIL" required>
          <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
        </Field>
        <Field label="USUÁRIO (login)">
          <Input value={form.username} onChange={e => set('username', e.target.value.toLowerCase().replace(/\s/g, ''))}
                 placeholder="pedro" />
          <p className="text-xs mt-1" style={{ color: '#8A94A2' }}>Deixe em branco para manter o atual.</p>
        </Field>
        <Field label="CARGO" required>
          <select value={form.cargo} onChange={e => set('cargo', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none" style={iStyle}>
            {CARGOS.map(c => <option key={c.title} value={c.title}>{c.title}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="PARTIDO">
            <Input value={form.party} onChange={e => set('party', e.target.value)} placeholder="PSB" />
          </Field>
          <Field label="SIGLA">
            <Input value={form.initials} onChange={e => set('initials', e.target.value.toUpperCase())} placeholder="BM" maxLength={4} />
          </Field>
        </div>

        <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: '#F6F7F9', border: '1px solid rgba(15,23,42,0.06)' }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#0B1220' }}>Membro ativo</p>
            <p className="text-xs mt-0.5" style={{ color: '#8A94A2' }}>Membros inativos não aparecem no quórum</p>
          </div>
          <button type="button" onClick={() => set('isActive', !form.isActive)}
                  className="w-11 h-6 rounded-full transition-colors flex-shrink-0 relative"
                  style={{ background: form.isActive ? 'oklch(0.52 0.16 255)' : 'rgba(15,23,42,0.15)' }}>
            <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                  style={{ left: form.isActive ? '22px' : '2px' }} />
          </button>
        </div>

        {error && <ErrorBox msg={error} />}
        <ModalActions onClose={onClose} loading={loading} label="Salvar" />
      </form>

      {/* Password reset section */}
      <div className="mt-2 px-6 pb-5">
        <div className="pt-4" style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }}>
          <p className="font-mono-jet text-[10px] font-semibold mb-3" style={{ color: '#8A94A2', letterSpacing: '0.08em' }}>REDEFINIR SENHA</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showNewPwd ? 'text' : 'password'}
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPwdSuccess(false); setPwdError(''); }}
                placeholder="Nova senha (mín. 6 caracteres)"
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg text-sm outline-none"
                style={iStyle}
                onFocus={e => (e.target.style.borderColor = 'oklch(0.52 0.16 255)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(15,23,42,0.12)')}
              />
              <button type="button" onClick={() => setShowNewPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#8A94A2' }}>
                {showNewPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button
              type="button"
              disabled={pwdLoading || newPassword.length < 6}
              onClick={async () => {
                setPwdLoading(true); setPwdError(''); setPwdSuccess(false);
                try {
                  await api.patch(`/users/${vereador.id}/reset-password`, { newPassword });
                  setPwdSuccess(true);
                  setNewPassword('');
                } catch (err: any) {
                  setPwdError(err.response?.data?.message || 'Erro ao redefinir');
                } finally {
                  setPwdLoading(false);
                }
              }}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-opacity flex-shrink-0"
              style={{ background: 'oklch(0.52 0.16 255)', color: '#fff', opacity: (pwdLoading || newPassword.length < 6) ? 0.5 : 1 }}>
              {pwdLoading ? <Loader2 size={13} className="animate-spin" /> : null}
              {pwdLoading ? 'Salvando…' : 'Definir'}
            </button>
          </div>
          {pwdSuccess && (
            <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: '#059669' }}>
              <Check size={12} /> Senha redefinida com sucesso.
            </p>
          )}
          {pwdError && <p className="text-xs mt-2" style={{ color: '#dc2626' }}>{pwdError}</p>}
        </div>

        <PinSection userId={vereador.id} />
      </div>
    </Modal>
  );
}

/* ── PIN section (mobile app) ───────────────────────────────────── */

function PinSection({ userId }: { userId: string }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN deve ter exatamente 4 dígitos.');
      return;
    }
    setLoading(true); setError(''); setSuccess(false);
    try {
      await api.patch(`/users/${userId}/pin`, { pin });
      setSuccess(true);
      setPin('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao definir PIN');
    } finally {
      setLoading(false);
    }
  }

  async function clearPin() {
    if (!confirm('Remover o PIN do app deste vereador? Ele não conseguirá logar no app mobile até ter um novo PIN definido.')) return;
    setLoading(true); setError(''); setSuccess(false);
    try {
      await api.patch(`/users/${userId}/pin`, { pin: null });
      setSuccess(true);
      setPin('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao remover PIN');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pt-4 mt-4" style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }}>
      <p className="font-mono-jet text-[10px] font-semibold mb-1" style={{ color: '#8A94A2', letterSpacing: '0.08em' }}>PIN DO APP MOBILE</p>
      <p className="text-xs mb-3" style={{ color: '#8A94A2' }}>
        Código de 4 dígitos para o vereador entrar no app do tablet. Anote e repasse ao vereador.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setSuccess(false); setError(''); }}
          placeholder="0000"
          className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none font-mono-jet tracking-[0.4em] text-center"
          style={iStyle}
          onFocus={e => (e.target.style.borderColor = '#1447E6')}
          onBlur={e => (e.target.style.borderColor = 'rgba(15,23,42,0.12)')}
        />
        <button
          type="button"
          disabled={loading || pin.length !== 4}
          onClick={save}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5 transition-opacity flex-shrink-0"
          style={{ background: '#1447E6', opacity: (loading || pin.length !== 4) ? 0.5 : 1 }}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : null}
          Definir
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={clearPin}
          className="px-3 py-2.5 rounded-lg text-xs font-semibold flex-shrink-0"
          style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#8A94A2' }}
          title="Remover PIN cadastrado">
          Limpar
        </button>
      </div>
      {success && (
        <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: '#059669' }}>
          <Check size={12} /> PIN salvo com sucesso.
        </p>
      )}
      {error && <p className="text-xs mt-2" style={{ color: '#dc2626' }}>{error}</p>}
    </div>
  );
}

/* ── Shared helpers ───────────────────────────────────────────── */
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
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col" style={{ border: '1px solid rgba(15,23,42,0.08)', maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
          <h2 className="font-tight font-semibold text-lg" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors"><X size={18} style={{ color: '#8A94A2' }} /></button>
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
function Spinner() {
  return <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin" style={{ color: '#8A94A2' }} /></div>;
}
function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex flex-col items-center justify-center py-20 text-center">{icon}<p className="mt-4 text-sm" style={{ color: '#8A94A2' }}>{text}</p></div>;
}
