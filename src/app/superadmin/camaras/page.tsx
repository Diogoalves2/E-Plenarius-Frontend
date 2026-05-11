'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { Plus, Building2, MapPin, X, Copy, Check, Loader2, Eye, EyeOff, ImagePlus, Trash2, KeyRound, Pencil, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';

interface Chamber {
  id: string;
  name: string;
  city: string;
  state: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  legislaturaInicio?: number | null;
  legislaturaFim?: number | null;
  bienioInicio?: number | null;
  bienioFim?: number | null;
  anoBienio?: number | null;
}

interface Credentials {
  chamber: Chamber;
  presidenteEmail: string;
  presidentePassword: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';
const BLUE = '#1447E6';

export default function CamarasPage() {
  return <Suspense><CamarasPageInner /></Suspense>;
}

function CamarasPageInner() {
  const [chambers, setChambers] = useState<Chamber[]>([]);
  const [loadingChambers, setLoadingChambers] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Chamber | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  const fetchChambers = useCallback(async () => {
    try {
      const { data } = await api.get('/chambers');
      setChambers(data);
    } finally {
      setLoadingChambers(false);
    }
  }, []);

  useEffect(() => { fetchChambers(); }, [fetchChambers]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowModal(true);
      router.replace('/superadmin/camaras');
    }
  }, [searchParams, router]);

  function handleCreated(creds: Credentials) {
    setShowModal(false);
    setCredentials(creds);
    fetchChambers();
  }

  async function resetCredentials(chamber: Chamber) {
    if (!confirm(`Redefinir a senha do presidente de "${chamber.name}"? A senha atual deixará de funcionar.`)) return;
    setResetting(chamber.id);
    try {
      const { data } = await api.patch(`/chambers/${chamber.id}/reset-credentials`);
      setCredentials({ chamber, presidenteEmail: data.presidenteEmail, presidentePassword: data.presidentePassword });
    } finally {
      setResetting(null);
    }
  }

  return (
    <div style={{ background: '#F5F6F8', minHeight: '100%', padding: '32px 36px 64px' }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0D1117', letterSpacing: '-0.03em', margin: 0, fontFamily: '"Inter Tight","Inter",sans-serif' }}>
            Câmaras Municipais
          </h2>
          <p style={{ fontSize: 13, color: '#8A94A2', marginTop: 3, letterSpacing: '-0.01em' }}>
            {chambers.length} câmara{chambers.length !== 1 ? 's' : ''} cadastrada{chambers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 font-semibold text-sm text-white transition-opacity hover:opacity-90"
          style={{ background: '#1447E6', borderRadius: 8 }}>
          <Plus size={16} />
          Nova Câmara
        </button>
      </div>

      {loadingChambers ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin" style={{ color: '#8A94A2' }} />
        </div>
      ) : chambers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 size={40} style={{ color: '#D1D5DB' }} />
          <p className="mt-4 font-semibold" style={{ color: '#0B1220' }}>Nenhuma câmara cadastrada</p>
          <p className="text-sm mt-1" style={{ color: '#8A94A2' }}>Clique em "Nova Câmara" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {chambers.map((c) => (
            <div key={c.id} className="bg-white p-5"
                 style={{ border: '1px solid #E4E7ED', borderRadius: 10 }}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center justify-center flex-shrink-0 overflow-hidden"
                     style={{ width: 48, height: 48, borderRadius: 8, background: '#F0F4FF', border: '1px solid #DBEAFE' }}>
                  {c.logoUrl
                    ? <img src={`${API_BASE}${c.logoUrl}`} alt={c.name} className="w-full h-full object-contain p-1" />
                    : <Building2 size={20} style={{ color: '#1447E6' }} />}
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 600,
                  padding: '3px 9px', borderRadius: 6,
                  background: c.isActive ? '#ECFDF5' : '#F5F6F8',
                  color: c.isActive ? '#059669' : '#8A94A2',
                  border: `1px solid ${c.isActive ? '#A7F3D0' : '#E4E7ED'}`,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.isActive ? '#059669' : '#CBD5E1', flexShrink: 0 }} />
                  {c.isActive ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              <h3 className="font-semibold text-sm leading-snug mb-1" style={{ color: '#0D1117', letterSpacing: '-0.01em' }}>{c.name}</h3>
              <div className="flex items-center gap-1 text-xs" style={{ color: '#8A94A2' }}>
                <MapPin size={11} />
                {c.city} — {c.state}
              </div>
              <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: '1px solid #F0F2F5' }}>
                <span className="font-mono-jet text-xs truncate" style={{ color: '#B0B8C4' }}>{c.slug}</span>
                <div className="flex items-center gap-1.5">
                  <Link href={`/superadmin/camaras/${c.id}/vereadores`}
                        className="flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg transition-colors"
                        style={{ flex: 1, padding: '7px 0', color: '#8A94A2', background: '#F5F6F8' }}
                        onMouseEnter={(e: any) => { e.currentTarget.style.background = 'rgba(20,71,230,0.08)'; e.currentTarget.style.color = '#1447E6'; }}
                        onMouseLeave={(e: any) => { e.currentTarget.style.background = '#F5F6F8'; e.currentTarget.style.color = '#8A94A2'; }}>
                    <Users size={13} /> Vereadores
                  </Link>
                  <button onClick={() => setEditTarget(c)}
                          className="flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg transition-colors"
                          style={{ flex: '0 0 auto', padding: '7px 12px', color: '#8A94A2', background: '#F5F6F8' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(20,71,230,0.08)'; e.currentTarget.style.color = '#1447E6'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#F5F6F8'; e.currentTarget.style.color = '#8A94A2'; }}>
                    <Pencil size={13} /> Editar
                  </button>
                  <button onClick={() => resetCredentials(c)} disabled={resetting === c.id}
                          className="flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg transition-colors"
                          style={{ flex: 1.4, padding: '7px 0', color: '#8A94A2', background: '#F5F6F8', whiteSpace: 'nowrap' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(234,179,8,0.08)'; e.currentTarget.style.color = '#b45309'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#F5F6F8'; e.currentTarget.style.color = '#8A94A2'; }}>
                    {resetting === c.id ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                    {resetting === c.id ? 'Resetando…' : 'Resetar Senha'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <NewChamberModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
      {editTarget && <EditChamberModal chamber={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); fetchChambers(); }} />}
      {credentials && <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />}
    </div>
  );
}

/* ── New Chamber Modal ─────────────────────────────────────── */

function NewChamberModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Credentials) => void }) {
  const [form, setForm] = useState({ name: '', city: '', state: '', presidenteName: '', presidenteEmail: '', presidentePassword: '', presidenteParty: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function removeLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let logoUrl: string | undefined;
      if (logoFile) {
        const fd = new FormData();
        fd.append('file', logoFile);
        const { data: up } = await api.post('/upload/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        logoUrl = up.url;
      }
      const payload = { ...form, logoUrl };
      if (!payload.presidentePassword) delete (payload as any).presidentePassword;
      if (!payload.presidenteParty) delete (payload as any).presidenteParty;
      const { data } = await api.post('/chambers/setup', payload);
      onCreated(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar câmara');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(11,18,32,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col"
           style={{ border: '1px solid rgba(15,23,42,0.08)', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0"
             style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
          <h2 className="font-tight font-semibold text-lg" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>
            Nova Câmara
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
            <X size={18} style={{ color: '#8A94A2' }} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4 overflow-y-auto flex-1">

          {/* Logo */}
          <div>
            <p className="text-xs font-semibold font-mono-jet mb-2" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>
              LOGOMARCA <span className="font-normal">(opcional)</span>
            </p>
            {logoPreview ? (
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
                     style={{ border: '1px solid rgba(15,23,42,0.12)', background: '#F6F7F9' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoPreview} alt="preview" className="w-full h-full object-contain p-1" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#0B1220' }}>{logoFile?.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#8A94A2' }}>{logoFile ? (logoFile.size / 1024).toFixed(0) + ' KB' : ''}</p>
                </div>
                <button type="button" onClick={removeLogo} className="p-2 rounded-lg hover:bg-red-50 transition-colors" style={{ color: '#8A94A2' }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm transition-all"
                      style={{ border: '2px dashed rgba(15,23,42,0.12)', color: '#8A94A2' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#1447E6'; e.currentTarget.style.color = '#1447E6'; e.currentTarget.style.background = 'rgba(20,71,230,0.04)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(15,23,42,0.12)'; e.currentTarget.style.color = '#8A94A2'; e.currentTarget.style.background = 'transparent'; }}>
                <ImagePlus size={16} />
                Clique para enviar a logomarca
                <span className="text-xs opacity-70">(JPG, PNG, SVG · 2 MB)</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" onChange={handleLogoChange} className="hidden" />
          </div>

          <Field label="NOME DA CÂMARA" required>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Câmara Municipal de Vila Aurora" required />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="CIDADE" required>
              <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Vila Aurora" required />
            </Field>
            <Field label="ESTADO" required>
              <Input value={form.state} onChange={e => set('state', e.target.value.toUpperCase())} placeholder="MG" maxLength={2} required />
            </Field>
          </div>

          {/* Presidente */}
          <div className="pt-1" style={{ borderTop: '1px solid rgba(15,23,42,0.06)' }}>
            <p className="text-xs font-mono-jet font-semibold mb-3" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>PRESIDENTE</p>
            <div className="flex flex-col gap-3">
              <Field label="NOME COMPLETO" required>
                <Input value={form.presidenteName} onChange={e => set('presidenteName', e.target.value)} placeholder="João da Silva" required />
              </Field>
              <Field label="E-MAIL DE ACESSO" required>
                <Input type="email" value={form.presidenteEmail} onChange={e => set('presidenteEmail', e.target.value)} placeholder="joao@vilaaurora.leg.br" required />
              </Field>
              <Field label="PARTIDO" hint="(opcional)">
                <Input value={form.presidenteParty} onChange={e => set('presidenteParty', e.target.value.toUpperCase())} placeholder="MDB, PT, PSD…" />
              </Field>
              <Field label="SENHA" hint="Deixe em branco para gerar automaticamente">
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={form.presidentePassword}
                    onChange={e => set('presidentePassword', e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    minLength={form.presidentePassword ? 8 : undefined}
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#8A94A2' }}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </Field>
            </div>
          </div>

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
              {loading ? 'Criando…' : 'Criar Câmara'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Edit Chamber Modal ────────────────────────────────────── */

function EditChamberModal({ chamber, onClose, onSaved }: { chamber: Chamber; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: chamber.name, city: chamber.city, state: chamber.state });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(chamber.logoUrl ? `${API_BASE}${chamber.logoUrl}` : null);
  const [presId, setPresId] = useState<string | null>(null);
  const [presForm, setPresForm] = useState({ name: '', email: '', party: '' });
  const [legForm, setLegForm] = useState({ legislaturaInicio: '', legislaturaFim: '', bienioInicio: '', bienioFim: '', anoBienio: '' });
  const [presFile, setPresFile] = useState<File | null>(null);
  const [presPreview, setPresPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const logoRef = useRef<HTMLInputElement>(null);
  const presRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get(`/users/chamber/${chamber.id}`).then(({ data }) => {
      const p = (data as any[]).find(u => u.role === 'presidente');
      if (p) {
        setPresId(p.id);
        setPresForm({ name: p.name, email: p.email, party: p.party ?? '' });
        if (p.avatarUrl) setPresPreview(`${API_BASE}${p.avatarUrl}`);
      }
    });
    setLegForm({
      legislaturaInicio: String(chamber.legislaturaInicio ?? ''),
      legislaturaFim: String(chamber.legislaturaFim ?? ''),
      bienioInicio: String(chamber.bienioInicio ?? ''),
      bienioFim: String(chamber.bienioFim ?? ''),
      anoBienio: String(chamber.anoBienio ?? ''),
    });
  }, [chamber.id]);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }
  function setPres(k: string, v: string) { setPresForm(f => ({ ...f, [k]: v })); }
  function setLeg(k: string, v: string) { setLegForm(f => ({ ...f, [k]: v })); }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setLogoFile(file); setLogoPreview(URL.createObjectURL(file));
  }
  function handlePresChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setPresFile(file); setPresPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let logoUrl: string | undefined;
      if (logoFile) {
        const fd = new FormData();
        fd.append('file', logoFile);
        const { data: up } = await api.post('/upload/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        logoUrl = up.url;
      }
      const legPatch: any = {};
      if (legForm.legislaturaInicio) legPatch.legislaturaInicio = Number(legForm.legislaturaInicio);
      if (legForm.legislaturaFim) legPatch.legislaturaFim = Number(legForm.legislaturaFim);
      if (legForm.bienioInicio) legPatch.bienioInicio = Number(legForm.bienioInicio);
      if (legForm.bienioFim) legPatch.bienioFim = Number(legForm.bienioFim);
      if (legForm.anoBienio) legPatch.anoBienio = Number(legForm.anoBienio);
      await api.patch(`/chambers/${chamber.id}`, { ...form, ...(logoUrl ? { logoUrl } : {}), ...legPatch });

      if (presId) {
        const presPatch: any = { name: presForm.name, email: presForm.email, party: presForm.party || undefined };
        if (presFile) {
          const fd2 = new FormData();
          fd2.append('file', presFile);
          const { data: av } = await api.post('/upload/avatar', fd2, { headers: { 'Content-Type': 'multipart/form-data' } });
          presPatch.avatarUrl = av.url;
        }
        await api.patch(`/users/${presId}`, presPatch);
      }

      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(11,18,32,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col" style={{ border: '1px solid rgba(15,23,42,0.08)', maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
          <h2 className="font-tight font-semibold text-lg" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>Editar Câmara</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors"><X size={18} style={{ color: '#8A94A2' }} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
          {/* Logo */}
          <div>
            <p className="text-xs font-semibold font-mono-jet mb-2" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>LOGOMARCA</p>
            <ImageUploadField preview={logoPreview} file={logoFile} inputRef={logoRef}
              onChange={handleLogoChange} onRemove={() => { setLogoFile(null); setLogoPreview(null); if (logoRef.current) logoRef.current.value = ''; }}
              placeholder="Clique para enviar a logomarca" />
          </div>

          <Field label="NOME DA CÂMARA" required>
            <Input value={form.name} onChange={e => set('name', e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CIDADE" required><Input value={form.city} onChange={e => set('city', e.target.value)} required /></Field>
            <Field label="ESTADO" required><Input value={form.state} onChange={e => set('state', e.target.value.toUpperCase())} maxLength={2} required /></Field>
          </div>

          {/* Presidente */}
          <div className="pt-1 flex flex-col gap-3" style={{ borderTop: '1px solid rgba(15,23,42,0.06)' }}>
            <p className="text-xs font-mono-jet font-semibold" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>PRESIDENTE</p>
            <div>
              <p className="text-xs font-semibold font-mono-jet mb-2" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>FOTO</p>
              <ImageUploadField preview={presPreview} file={presFile} inputRef={presRef}
                onChange={handlePresChange} onRemove={() => { setPresFile(null); setPresPreview(null); if (presRef.current) presRef.current.value = ''; }}
                placeholder="Clique para enviar a foto" avatar />
            </div>
            <Field label="NOME COMPLETO">
              <Input value={presForm.name} onChange={e => setPres('name', e.target.value)} placeholder="Nome do presidente" />
            </Field>
            <Field label="E-MAIL DE ACESSO">
              <Input type="email" value={presForm.email} onChange={e => setPres('email', e.target.value)} placeholder="email@camara.leg.br" />
            </Field>
            <Field label="PARTIDO" hint="(opcional)">
              <Input value={presForm.party} onChange={e => setPres('party', e.target.value.toUpperCase())} placeholder="MDB, PT, PSD…" />
            </Field>
          </div>

          {/* Legislatura & Biênio */}
          <div className="pt-1 flex flex-col gap-3" style={{ borderTop: '1px solid rgba(15,23,42,0.06)' }}>
            <p className="text-xs font-mono-jet font-semibold" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>LEGISLATURA & BIÊNIO</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="LEGISLATURA INÍCIO">
                <Input type="number" value={legForm.legislaturaInicio} onChange={e => setLeg('legislaturaInicio', e.target.value)} placeholder="2025" />
              </Field>
              <Field label="LEGISLATURA FIM">
                <Input type="number" value={legForm.legislaturaFim} onChange={e => setLeg('legislaturaFim', e.target.value)} placeholder="2028" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="BIÊNIO INÍCIO">
                <Input type="number" value={legForm.bienioInicio} onChange={e => setLeg('bienioInicio', e.target.value)} placeholder="2025" />
              </Field>
              <Field label="BIÊNIO FIM">
                <Input type="number" value={legForm.bienioFim} onChange={e => setLeg('bienioFim', e.target.value)} placeholder="2026" />
              </Field>
            </div>
            <Field label="ANO DO BIÊNIO">
              <select value={legForm.anoBienio} onChange={e => setLeg('anoBienio', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none"
                      style={{ background: 'white', border: '1px solid rgba(15,23,42,0.12)', color: legForm.anoBienio ? '#0B1220' : '#8A94A2' }}>
                <option value="">Não configurado</option>
                <option value="1">1º Ano do Biênio</option>
                <option value="2">2º Ano do Biênio</option>
              </select>
            </Field>
          </div>

          {error && <div className="px-3.5 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563' }}>Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: '#1447E6', opacity: loading ? 0.7 : 1 }}>
              {loading && <Loader2 size={14} className="animate-spin" />}{loading ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Credentials Modal ─────────────────────────────────────── */

function CredentialsModal({ credentials, onClose }: { credentials: Credentials; onClose: () => void }) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  function copy(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(11,18,32,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
           style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
        <div className="px-6 pt-6 pb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(16,185,129,0.1)' }}>
            <Check size={20} style={{ color: '#059669' }} />
          </div>
          <h2 className="font-tight font-semibold text-lg" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>
            Câmara criada com sucesso!
          </h2>
          <p className="text-sm mt-1" style={{ color: '#4B5563' }}>
            Compartilhe as credenciais abaixo com o presidente da câmara.
          </p>
        </div>

        <div className="px-6 pb-3 flex flex-col gap-3">
          <div className="rounded-xl p-4" style={{ background: '#F6F7F9', border: '1px solid rgba(15,23,42,0.08)' }}>
            <p className="font-mono-jet text-xs font-semibold mb-1.5" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>CÂMARA</p>
            <p className="font-semibold text-sm" style={{ color: '#0B1220' }}>{credentials.chamber.name}</p>
            <p className="text-xs mt-0.5" style={{ color: '#8A94A2' }}>{credentials.chamber.city} — {credentials.chamber.state}</p>
          </div>

          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#F6F7F9', border: '1px solid rgba(15,23,42,0.08)' }}>
            <p className="font-mono-jet text-xs font-semibold" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>CREDENCIAIS DO PRESIDENTE</p>
            <CopyRow label="E-MAIL" value={credentials.presidenteEmail} copied={copiedEmail} onCopy={() => copy(credentials.presidenteEmail, setCopiedEmail)} />
            <div>
              <p className="font-mono-jet text-xs mb-1" style={{ color: '#8A94A2', letterSpacing: '0.05em' }}>SENHA</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono-jet text-sm px-3 py-2 rounded-lg"
                      style={{ background: 'white', border: '1px solid rgba(15,23,42,0.08)', color: '#0B1220', letterSpacing: '0.05em' }}>
                  {showPwd ? credentials.presidentePassword : '••••••••••'}
                </code>
                <button onClick={() => setShowPwd(v => !v)} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#8A94A2' }}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button onClick={() => copy(credentials.presidentePassword, setCopiedPwd)} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: copiedPwd ? '#059669' : '#8A94A2' }}>
                  {copiedPwd ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-base leading-none mt-0.5">⚠️</span>
            <p className="text-xs leading-relaxed" style={{ color: '#8A94A2' }}>
              Esta senha não poderá ser visualizada novamente. Copie e compartilhe agora com o presidente.
            </p>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button onClick={onClose}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: '#1447E6' }}>
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Shared helpers ────────────────────────────────────────── */

const iStyle: React.CSSProperties = { background: 'white', border: '1px solid #E4E7ED', color: '#0D1117', transition: 'border-color 0.15s' };

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3.5 py-2.5 rounded-lg text-sm outline-none ${className}`}
      style={iStyle}
      onFocus={e => (e.target.style.borderColor = '#1447E6')}
      onBlur={e => (e.target.style.borderColor = '#E4E7ED')}
    />
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

function ImageUploadField({
  preview, file, inputRef, onChange, onRemove, placeholder, avatar,
}: {
  preview: string | null;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  placeholder: string;
  avatar?: boolean;
}) {
  return preview ? (
    <div className="flex items-center gap-3">
      <div className={`flex-shrink-0 overflow-hidden flex items-center justify-center ${avatar ? 'w-14 h-14 rounded-full' : 'w-14 h-14 rounded-xl'}`}
           style={{ border: '1px solid rgba(15,23,42,0.12)', background: '#F6F7F9' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="preview" className={`w-full h-full object-cover ${avatar ? '' : 'object-contain p-1'}`} />
      </div>
      <div className="flex-1 min-w-0">
        {file && <p className="text-sm font-semibold truncate" style={{ color: '#0B1220' }}>{file.name}</p>}
        {file && <p className="text-xs mt-0.5" style={{ color: '#8A94A2' }}>{(file.size / 1024).toFixed(0)} KB</p>}
        {!file && <p className="text-xs" style={{ color: '#8A94A2' }}>Foto atual</p>}
      </div>
      <button type="button" onClick={onRemove} className="p-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0" style={{ color: '#8A94A2' }}>
        <Trash2 size={15} />
      </button>
    </div>
  ) : (
    <>
      <button type="button" onClick={() => inputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm transition-all"
              style={{ border: '2px dashed rgba(15,23,42,0.12)', color: '#8A94A2' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#1447E6'; e.currentTarget.style.color = '#1447E6'; e.currentTarget.style.background = 'rgba(20,71,230,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(15,23,42,0.12)'; e.currentTarget.style.color = '#8A94A2'; e.currentTarget.style.background = 'transparent'; }}>
        <ImagePlus size={16} />
        {placeholder}
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" onChange={onChange} className="hidden" />
    </>
  );
}

function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div>
      <p className="font-mono-jet text-xs mb-1" style={{ color: '#8A94A2', letterSpacing: '0.05em' }}>{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 font-mono-jet text-sm px-3 py-2 rounded-lg truncate"
              style={{ background: 'white', border: '1px solid rgba(15,23,42,0.08)', color: '#0B1220' }}>
          {value}
        </code>
        <button onClick={onCopy} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: copied ? '#059669' : '#8A94A2' }}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
}
