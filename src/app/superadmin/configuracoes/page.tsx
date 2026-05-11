'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { User, Lock, Info, Loader2, Check, ImagePlus, Trash2, LayoutDashboard } from 'lucide-react';
import api from '@/lib/api';

const BLUE = '#1447E6';
const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';
const SYSTEM_LOGO_KEY = 'system_logo_url';

export default function ConfiguracoesPage() {
  const { user } = useAuth();

  return (
    <div style={{ background: '#F5F6F8', minHeight: '100%', padding: '32px 36px 64px' }}>
      <div className="mb-8">
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0D1117', letterSpacing: '-0.03em', margin: 0, fontFamily: '"Inter Tight","Inter",sans-serif' }}>
          Configurações
        </h2>
        <p style={{ fontSize: 13, color: '#8A94A2', marginTop: 3, letterSpacing: '-0.01em' }}>
          Gerencie sua conta e preferências do sistema
        </p>
      </div>

      <div className="flex flex-col gap-5" style={{ maxWidth: 640 }}>
        {/* System logo */}
        <Section icon={<LayoutDashboard size={16} />} title="Logo do Sistema">
          <SystemLogoSection />
        </Section>

        {/* Account info */}
        <Section icon={<User size={16} />} title="Minha Conta">
          <div className="flex flex-col gap-3">
            <InfoRow label="Nome" value={user?.name ?? '—'} />
            <InfoRow label="E-mail" value={user?.email ?? '—'} />
            <InfoRow label="Perfil" value="Superadministrador" badge />
          </div>
        </Section>

        {/* Change password */}
        <Section icon={<Lock size={16} />} title="Alterar Senha">
          <ChangePasswordForm />
        </Section>

        {/* System info */}
        <Section icon={<Info size={16} />} title="Sobre o Sistema">
          <div className="flex flex-col gap-3">
            <InfoRow label="Sistema" value="E-Plenarius" />
            <InfoRow label="Versão" value="0.1.0" />
            <InfoRow label="Stack" value="NestJS · Next.js · PostgreSQL" />
            <InfoRow label="Tecnologias" value="WebSocket · JWT · TypeORM" />
          </div>
        </Section>
      </div>
    </div>
  );
}

/* ── System Logo Section ───────────────────────────────────── */

function SystemLogoSection() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(SYSTEM_LOGO_KEY);
    if (saved) setLogoUrl(saved);
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSuccess(false);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/upload/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const fullUrl = `${API_BASE}${data.url}`;
      localStorage.setItem(SYSTEM_LOGO_KEY, fullUrl);
      setLogoUrl(fullUrl);
      setSuccess(true);
      window.dispatchEvent(new Event('system-logo-changed'));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao enviar imagem.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleRemove() {
    localStorage.removeItem(SYSTEM_LOGO_KEY);
    setLogoUrl(null);
    setSuccess(false);
    window.dispatchEvent(new Event('system-logo-changed'));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: '#8A94A2' }}>
        A logo aparece na barra lateral do painel superadmin e na tela de login. Recomendado: PNG ou SVG com fundo transparente.
      </p>

      {logoUrl ? (
        <div className="flex items-center gap-4 p-4 rounded-lg" style={{ background: '#F5F6F8', border: '1px solid #E4E7ED' }}>
          <div className="flex items-center justify-center flex-shrink-0 overflow-hidden"
               style={{ width: 56, height: 56, borderRadius: 8, background: '#fff', border: '1px solid #E4E7ED' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Logo atual" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: '#0D1117' }}>Logo atual</p>
            <p className="text-xs mt-0.5 truncate" style={{ color: '#8A94A2' }}>{logoUrl.split('/').pop()}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button type="button" onClick={() => fileRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-opacity hover:opacity-80"
                    style={{ background: BLUE, color: '#fff', borderRadius: 7 }}>
              Trocar
            </button>
            <button type="button" onClick={handleRemove}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    style={{ color: '#8A94A2' }}>
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-lg text-sm transition-all"
                style={{ border: '2px dashed #E4E7ED', color: '#8A94A2', background: 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.color = BLUE; e.currentTarget.style.background = 'rgba(20,71,230,0.03)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E4E7ED'; e.currentTarget.style.color = '#8A94A2'; e.currentTarget.style.background = 'transparent'; }}>
          {uploading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
          <span className="font-medium">{uploading ? 'Enviando…' : 'Clique para enviar a logo'}</span>
          <span className="text-xs opacity-70">PNG, JPG, SVG ou WebP · máx. 2 MB</span>
        </button>
      )}

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleFile} className="hidden" />

      {error && (
        <div className="px-3.5 py-3 rounded-lg text-sm"
             style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}
      {success && (
        <div className="px-3.5 py-3 rounded-lg text-sm flex items-center gap-2"
             style={{ background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }}>
          <Check size={14} /> Logo atualizada com sucesso!
        </div>
      )}
    </div>
  );
}

/* ── Change Password Form ──────────────────────────────────── */

function ChangePasswordForm() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (form.newPassword.length < 8) {
      setError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await api.patch('/users/me/password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setSuccess(true);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao alterar senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Field label="SENHA ATUAL" required>
        <input type="password" value={form.currentPassword} onChange={e => set('currentPassword', e.target.value)}
               placeholder="••••••••" required className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none"
               style={iStyle}
               onFocus={e => (e.target.style.borderColor = '#1447E6')}
               onBlur={e => (e.target.style.borderColor = '#E4E7ED')} />
      </Field>
      <Field label="NOVA SENHA" required>
        <input type="password" value={form.newPassword} onChange={e => set('newPassword', e.target.value)}
               placeholder="Mínimo 8 caracteres" required className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none"
               style={iStyle}
               onFocus={e => (e.target.style.borderColor = '#1447E6')}
               onBlur={e => (e.target.style.borderColor = '#E4E7ED')} />
      </Field>
      <Field label="CONFIRMAR NOVA SENHA" required>
        <input type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
               placeholder="Repita a nova senha" required className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none"
               style={iStyle}
               onFocus={e => (e.target.style.borderColor = '#1447E6')}
               onBlur={e => (e.target.style.borderColor = '#E4E7ED')} />
      </Field>

      {error && (
        <div className="px-3.5 py-3 rounded-lg text-sm"
             style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}
      {success && (
        <div className="px-3.5 py-3 rounded-lg text-sm flex items-center gap-2"
             style={{ background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }}>
          <Check size={14} /> Senha alterada com sucesso!
        </div>
      )}

      <div className="pt-1">
        <button type="submit" disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity"
                style={{ background: '#1447E6', opacity: loading ? 0.7 : 1 }}>
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? 'Salvando…' : 'Alterar Senha'}
        </button>
      </div>
    </form>
  );
}

/* ── Helpers ───────────────────────────────────────────────── */

const iStyle: React.CSSProperties = {
  background: 'white',
  border: '1px solid #E4E7ED',
  color: '#0D1117',
  transition: 'border-color 0.15s',
};

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white overflow-hidden" style={{ border: '1px solid #E4E7ED', borderRadius: 10 }}>
      <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid #F0F2F5' }}>
        <span style={{ color: '#1447E6' }}>{icon}</span>
        <h3 className="font-semibold text-sm" style={{ color: '#0B1220' }}>{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5"
         style={{ borderBottom: '1px solid rgba(15,23,42,0.04)' }}>
      <span className="text-xs font-mono-jet font-semibold flex-shrink-0" style={{ color: '#8A94A2', letterSpacing: '0.05em' }}>
        {label.toUpperCase()}
      </span>
      {badge ? (
        <span className="text-xs px-2 py-0.5 rounded font-mono-jet font-semibold"
              style={{ background: 'rgba(82,130,255,0.1)', color: '#1447E6' }}>
          {value.toUpperCase()}
        </span>
      ) : (
        <span className="text-sm text-right" style={{ color: '#0B1220' }}>{value}</span>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold font-mono-jet" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
      </label>
      {children}
    </div>
  );
}
