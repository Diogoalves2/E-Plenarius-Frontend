'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  User, ShieldCheck, Palette, Server, Loader2, Check, ImagePlus, Trash2, Eye, EyeOff,
  LogOut, CircleCheck, Circle, RefreshCw, KeyRound,
} from 'lucide-react';
import api from '@/lib/api';
import { MfaCard } from '@/components/auth/MfaCard';
import { useDialog } from '@/components/ui/Dialog';

const BLUE = '#1447E6';
const INK = '#0B1220';
const MUTED = '#64748B';
const SOFT = '#94A3B8';
const LINE = 'rgba(15,23,42,0.08)';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
const API_BASE = API_URL.replace(/\/api\/?$/, '');
const SYSTEM_LOGO_KEY = 'system_logo_url';
const COMMIT = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;

type Tab = 'conta' | 'seguranca' | 'marca' | 'sistema';
const TABS: { key: Tab; label: string; hint: string; icon: typeof User }[] = [
  { key: 'conta', label: 'Conta', hint: 'Seus dados de acesso', icon: User },
  { key: 'seguranca', label: 'Segurança', hint: '2FA, senha e dispositivos', icon: ShieldCheck },
  { key: 'marca', label: 'Marca', hint: 'Logo do sistema', icon: Palette },
  { key: 'sistema', label: 'Sistema', hint: 'Versão e status', icon: Server },
];

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<Tab>('conta');

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab') as Tab | null;
    if (t && TABS.some(x => x.key === t)) setTab(t);
  }, []);
  function go(t: Tab) {
    setTab(t);
    window.history.replaceState(null, '', `?tab=${t}`);
  }

  const current = TABS.find(t => t.key === tab)!;

  return (
    <div className="min-h-full px-6 py-8 lg:px-9" style={{ background: '#F5F6F8' }}>
      <div className="mb-7">
        <h2 className="font-tight font-bold text-[22px]" style={{ color: INK, letterSpacing: '-0.03em' }}>Configurações</h2>
        <p className="text-[13px] mt-1" style={{ color: SOFT }}>Sua conta de superadministrador e preferências do sistema</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Navegação */}
        <nav className="w-full lg:w-60 flex-shrink-0 lg:sticky lg:top-6 flex lg:flex-col gap-1 overflow-x-auto" aria-label="Seções">
          {TABS.map(t => {
            const on = t.key === tab;
            return (
              <button key={t.key} onClick={() => go(t.key)} aria-current={on ? 'page' : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors flex-shrink-0 ${on ? 'bg-white' : 'hover:bg-white/60'}`}
                      style={{ border: `1px solid ${on ? LINE : 'transparent'}` }}>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: on ? 'rgba(20,71,230,0.08)' : 'transparent', color: on ? BLUE : SOFT }}>
                  <t.icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold" style={{ color: on ? INK : MUTED }}>{t.label}</span>
                  <span className="hidden lg:block text-[11px] truncate" style={{ color: SOFT }}>{t.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0 w-full max-w-[720px]">
          <div className="mb-4">
            <h3 className="font-tight font-semibold text-[17px]" style={{ color: INK, letterSpacing: '-0.02em' }}>{current.label}</h3>
            <p className="text-[12px] mt-0.5" style={{ color: SOFT }}>{current.hint}</p>
          </div>
          {tab === 'conta' && <AccountPanel />}
          {tab === 'seguranca' && <SecurityPanel />}
          {tab === 'marca' && <BrandPanel />}
          {tab === 'sistema' && <SystemPanel />}
        </div>
      </div>
    </div>
  );
}

/* ── Conta ─────────────────────────────────────────────────────────────── */
function AccountPanel() {
  const { user } = useAuth();
  const [me, setMe] = useState<{ username?: string | null; lastLoginAt?: string | null; createdAt?: string } | null>(null);
  useEffect(() => { api.get('/users/me').then(r => setMe(r.data)).catch(() => {}); }, []);
  const initials = (user?.name ?? '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

  return (
    <Card>
      <div className="flex items-center gap-4 p-5" style={{ borderBottom: `1px solid ${LINE}` }}>
        <span className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #1447E6, #0B1D5E)' }}>{initials}</span>
        <div className="min-w-0">
          <p className="font-tight font-semibold text-[16px] truncate" style={{ color: INK }}>{user?.name ?? '—'}</p>
          <p className="text-[13px] truncate" style={{ color: MUTED }}>{user?.email}</p>
          <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(20,71,230,0.07)', color: BLUE }}>
            <ShieldCheck size={11} /> Superadministrador
          </span>
        </div>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-3">
        <Info label="Usuário" value={me?.username || '—'} />
        <Info label="Último acesso" value={me?.lastLoginAt ? new Date(me.lastLoginAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'} />
        <Info label="Conta criada em" value={me?.createdAt ? new Date(me.createdAt).toLocaleDateString('pt-BR') : '—'} />
      </dl>
    </Card>
  );
}

/* ── Segurança ─────────────────────────────────────────────────────────── */
function SecurityPanel() {
  const dialog = useDialog();
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);

  async function logoutEverywhere() {
    if (!(await dialog.confirm({
      title: 'Sair de todos os dispositivos?',
      message: 'Todos os logins desta conta são encerrados, inclusive este. Use se perdeu um computador ou suspeita de acesso indevido.',
      tone: 'danger', confirmLabel: 'Sair de todos',
    }))) return;
    setBusy(true);
    try { await api.post('/auth/logout', {}); } catch { /* segue para sair daqui também */ }
    await logout();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="[&>div]:!mb-0"><MfaCard /></div>

      <Card title="Alterar senha" icon={<KeyRound size={15} />}>
        <div className="p-5"><ChangePasswordForm /></div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm font-semibold" style={{ color: INK }}>Sair de todos os dispositivos</p>
            <p className="text-[12px] mt-0.5" style={{ color: MUTED }}>Encerra os logins desta conta em todos os navegadores, inclusive este.</p>
          </div>
          <button onClick={logoutEverywhere} disabled={busy}
                  className="flex items-center gap-2 h-9 px-3.5 rounded-lg text-[13px] font-semibold transition-colors border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} Sair de todos
          </button>
        </div>
      </Card>
    </div>
  );
}

function ChangePasswordForm() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const longEnough = form.newPassword.length >= 8;
  const matches = !!form.newPassword && form.newPassword === form.confirmPassword;
  const different = !!form.newPassword && form.newPassword !== form.currentPassword;
  const ready = !!form.currentPassword && longEnough && matches && different;

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); setSuccess(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setError(''); setLoading(true);
    try {
      await api.patch('/users/me/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setSuccess(true);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao alterar senha.');
    } finally { setLoading(false); }
  }

  const type = show ? 'text' : 'password';
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <Field label="Senha atual">
        <PwInput type={type} value={form.currentPassword} onChange={v => set('currentPassword', v)} autoComplete="current-password" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Field label="Nova senha">
          <PwInput type={type} value={form.newPassword} onChange={v => set('newPassword', v)} autoComplete="new-password" />
        </Field>
        <Field label="Confirmar nova senha">
          <PwInput type={type} value={form.confirmPassword} onChange={v => set('confirmPassword', v)} autoComplete="new-password" />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
        <Req ok={longEnough} text="Pelo menos 8 caracteres" />
        <Req ok={matches} text="As duas senhas coincidem" />
        <Req ok={different} text="Diferente da atual" />
        <button type="button" onClick={() => setShow(s => !s)} className="ml-auto flex items-center gap-1.5 font-semibold" style={{ color: MUTED }}>
          {show ? <EyeOff size={13} /> : <Eye size={13} />} {show ? 'Ocultar' : 'Mostrar'} senhas
        </button>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="ok"><Check size={14} /> Senha alterada com sucesso.</Notice>}

      <div>
        <button type="submit" disabled={loading || !ready}
                className="flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold text-white transition-colors bg-[#1447E6] hover:bg-[#103CC4] disabled:opacity-50 disabled:cursor-not-allowed">
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? 'Salvando…' : 'Alterar senha'}
        </button>
      </div>
    </form>
  );
}

/* ── Marca ─────────────────────────────────────────────────────────────── */
function BrandPanel() {
  const dialog = useDialog();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/upload/system-logo`).then(r => r.json())
      .then(({ url }) => setLogoUrl(url ? `${API_BASE}${url}` : null))
      .catch(() => {}).finally(() => setLoaded(true));
  }, []);

  function publish(full: string | null) {
    try { full ? localStorage.setItem(SYSTEM_LOGO_KEY, full) : localStorage.removeItem(SYSTEM_LOGO_KEY); } catch { /* sem armazenamento */ }
    window.dispatchEvent(new Event('system-logo-changed'));
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setSuccess(''); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/upload/logo?target=system', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const full = `${API_BASE}${data.url}`;
      setLogoUrl(full); publish(full);
      setSuccess('Logo atualizada. Já aparece no login e na barra lateral.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao enviar imagem.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleRemove() {
    if (!(await dialog.confirm({ title: 'Remover a logo do sistema?', message: 'O login e a barra lateral voltam a mostrar a marca padrão do E-Plenarius.', tone: 'danger', confirmLabel: 'Remover' }))) return;
    setError(''); setSuccess('');
    try {
      await api.delete('/upload/system-logo');
      setLogoUrl(null); publish(null);
      setSuccess('Logo removida.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível remover.');
    }
  }

  return (
    <Card>
      <div className="p-5">
        <p className="text-[13px]" style={{ color: MUTED }}>
          Aparece na tela de login e na barra lateral do superadmin, sempre sobre fundo escuro.
          Use PNG ou SVG com fundo transparente e letras claras.
        </p>

        {/* Prévia como aparece de verdade */}
        <div className="mt-4 rounded-xl flex items-center justify-center h-36 relative overflow-hidden"
             style={{ background: 'radial-gradient(500px 200px at 50% 0%, rgba(20,71,230,0.18), transparent 70%), #0B0D10' }}>
          {!loaded ? <Loader2 className="animate-spin" size={18} style={{ color: '#5B636D' }} />
            : logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoUrl} alt="Logo do sistema" style={{ maxHeight: 40, maxWidth: '70%', objectFit: 'contain' }} />
              : <span className="text-[13px]" style={{ color: '#5B636D' }}>Nenhuma logo enviada — usando a marca padrão</span>}
          <span className="absolute left-3 bottom-2.5 text-[10px] font-semibold uppercase" style={{ color: '#5B636D', letterSpacing: '0.08em' }}>Prévia</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="flex items-center gap-2 h-9 px-3.5 rounded-lg text-[13px] font-semibold text-white transition-colors bg-[#1447E6] hover:bg-[#103CC4] disabled:opacity-60">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
            {uploading ? 'Enviando…' : logoUrl ? 'Trocar logo' : 'Enviar logo'}
          </button>
          {logoUrl && (
            <button type="button" onClick={handleRemove}
                    className="flex items-center gap-2 h-9 px-3.5 rounded-lg text-[13px] font-semibold transition-colors border border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600">
              <Trash2 size={14} /> Remover
            </button>
          )}
          <span className="text-[11px] ml-auto" style={{ color: SOFT }}>PNG, JPG, SVG ou WebP · até 2 MB</span>
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleFile} className="hidden" />

        {(error || success) && <div className="mt-3">{error ? <Notice tone="error">{error}</Notice> : <Notice tone="ok"><Check size={14} /> {success}</Notice>}</div>}
      </div>
    </Card>
  );
}

/* ── Sistema ───────────────────────────────────────────────────────────── */
function SystemPanel() {
  const [health, setHealth] = useState<{ ok: boolean; uptime?: number; ms?: number } | null>(null);
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    const t = performance.now();
    try {
      const r = await fetch(`${API_URL}/health`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      setHealth({ ok: r.ok && d.status === 'ok', uptime: d.uptime, ms: Math.round(performance.now() - t) });
    } catch { setHealth({ ok: false }); }
    finally { setChecking(false); }
  }
  useEffect(() => { check(); }, []);

  const since = health?.uptime != null ? new Date(Date.now() - health.uptime * 1000) : null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center gap-4 p-5">
          <span className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: health?.ok ? '#ECFDF5' : health ? '#FEF2F2' : '#F1F5F9', color: health?.ok ? '#059669' : health ? '#DC2626' : SOFT }}>
            <Server size={18} />
          </span>
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-semibold flex items-center gap-2" style={{ color: INK }}>
              API {health == null ? 'verificando…' : health.ok ? 'no ar' : 'fora do ar'}
              {health?.ok && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} />}
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: MUTED }}>
              {health?.ok
                ? <>Resposta em {health.ms} ms{since ? ` · no ar desde ${since.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} (último deploy)` : ''}</>
                : health ? 'Não foi possível falar com o servidor.' : ' '}
            </p>
          </div>
          <button onClick={check} disabled={checking}
                  className="flex items-center gap-2 h-9 px-3.5 rounded-lg text-[13px] font-semibold transition-colors border border-slate-200 text-slate-600 hover:bg-slate-50">
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} /> Verificar
          </button>
        </div>
      </Card>

      <Card>
        <dl className="grid grid-cols-1 sm:grid-cols-2">
          <Info label="Sistema" value="E-Plenarius" />
          <Info label="Versão do painel" value={COMMIT ? COMMIT.slice(0, 7) : 'local'} mono />
          <Info label="Endereço da API" value={API_BASE.replace(/^https?:\/\//, '')} mono />
          <Info label="Ambiente" value={COMMIT ? 'Produção' : 'Desenvolvimento'} />
        </dl>
      </Card>
    </div>
  );
}

/* ── Peças ─────────────────────────────────────────────────────────────── */
function Card({ title, icon, children }: { title?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
      {title && (
        <header className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: `1px solid ${LINE}` }}>
          <span style={{ color: BLUE }}>{icon}</span>
          <h4 className="text-sm font-semibold" style={{ color: INK }}>{title}</h4>
        </header>
      )}
      {children}
    </section>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-5 py-3.5" style={{ borderTop: `1px solid ${LINE}` }}>
      <dt className="text-[11px] font-semibold uppercase" style={{ color: SOFT, letterSpacing: '0.06em' }}>{label}</dt>
      <dd className={`text-[13px] mt-0.5 truncate ${mono ? 'font-mono-jet' : ''}`} style={{ color: INK }}>{value}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium" style={{ color: '#334155' }}>{label}</span>
      {children}
    </label>
  );
}

function PwInput({ type, value, onChange, autoComplete }: { type: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} autoComplete={autoComplete} required
           className="w-full h-10 px-3.5 rounded-lg text-sm outline-none bg-white border border-slate-200 transition-colors hover:border-slate-300 focus:border-[#1447E6]"
           style={{ color: INK }} />
  );
}

function Req({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className="flex items-center gap-1.5" style={{ color: ok ? '#059669' : SOFT }}>
      {ok ? <CircleCheck size={13} /> : <Circle size={13} />} {text}
    </span>
  );
}

function Notice({ tone, children }: { tone: 'ok' | 'error'; children: React.ReactNode }) {
  const s = tone === 'ok'
    ? { background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }
    : { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' };
  return <div className="px-3.5 py-2.5 rounded-lg text-[13px] flex items-center gap-2" style={s}>{children}</div>;
}
