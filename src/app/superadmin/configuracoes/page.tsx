'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { User, Lock, Info, Loader2, Check } from 'lucide-react';
import api from '@/lib/api';

export default function ConfiguracoesPage() {
  const { user } = useAuth();

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h2 className="font-tight font-semibold text-2xl" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>
          Configurações
        </h2>
        <p className="text-sm mt-1" style={{ color: '#8A94A2' }}>Gerencie sua conta e preferências do sistema</p>
      </div>

      <div className="flex flex-col gap-6">
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
               onFocus={e => (e.target.style.borderColor = 'oklch(0.52 0.16 255)')}
               onBlur={e => (e.target.style.borderColor = 'rgba(15,23,42,0.12)')} />
      </Field>
      <Field label="NOVA SENHA" required>
        <input type="password" value={form.newPassword} onChange={e => set('newPassword', e.target.value)}
               placeholder="Mínimo 8 caracteres" required className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none"
               style={iStyle}
               onFocus={e => (e.target.style.borderColor = 'oklch(0.52 0.16 255)')}
               onBlur={e => (e.target.style.borderColor = 'rgba(15,23,42,0.12)')} />
      </Field>
      <Field label="CONFIRMAR NOVA SENHA" required>
        <input type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
               placeholder="Repita a nova senha" required className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none"
               style={iStyle}
               onFocus={e => (e.target.style.borderColor = 'oklch(0.52 0.16 255)')}
               onBlur={e => (e.target.style.borderColor = 'rgba(15,23,42,0.12)')} />
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
                style={{ background: 'oklch(0.52 0.16 255)', opacity: loading ? 0.7 : 1 }}>
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
  border: '1px solid rgba(15,23,42,0.12)',
  color: '#0B1220',
  transition: 'border-color 0.15s',
};

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
      <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
        <span style={{ color: 'oklch(0.52 0.16 255)' }}>{icon}</span>
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
              style={{ background: 'rgba(82,130,255,0.1)', color: 'oklch(0.52 0.16 255)' }}>
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
