'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Loader2, AlertTriangle } from 'lucide-react';

const SYSTEM_LOGO_KEY = 'system_logo_url';
const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';

function resolveErrorMessage(err: any): { title: string; detail: string } {
  const status = err?.response?.status;
  const msg: string = err?.response?.data?.message ?? '';

  if (!err?.response) return { title: 'Sem conexão', detail: 'Não foi possível conectar ao servidor. Verifique sua internet.' };
  if (status === 401 || msg.toLowerCase().includes('credenciais') || msg.toLowerCase().includes('inválid'))
    return { title: 'Credenciais inválidas', detail: 'Usuário/e-mail ou senha incorretos. Verifique os dados e tente novamente.' };
  if (status === 403 || msg.toLowerCase().includes('desativad'))
    return { title: 'Conta desativada', detail: 'Esta conta está desativada. Contate o administrador.' };
  if (status === 429)
    return { title: 'Muitas tentativas', detail: 'Aguarde alguns instantes antes de tentar novamente.' };
  return { title: 'Erro ao entrar', detail: msg || 'Tente novamente mais tarde.' };
}

export default function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [systemLogo, setSystemLogo] = useState<string | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem(SYSTEM_LOGO_KEY);
    if (cached) setSystemLogo(cached);

    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'}/upload/system-logo`)
      .then(r => r.json())
      .then(({ url }) => {
        if (url) {
          const full = `${API_BASE}${url}`;
          setSystemLogo(full);
          localStorage.setItem(SYSTEM_LOGO_KEY, full);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(identifier, password);
    } catch (err: any) {
      setError(resolveErrorMessage(err));
      setShakeKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  }, [login, identifier, password]);

  return (
    <div className="min-h-screen flex" style={{ background: '#0B0D10' }}>
      {/* Left — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 p-12"
           style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center">
          {systemLogo
            ? <img src={systemLogo} alt="Logo" style={{ maxHeight: 40, maxWidth: 200, objectFit: 'contain' }} />
            : <>
                <Brasao size={36} color="#1447E6" />
                <span className="font-tight font-semibold text-white text-lg tracking-tight ml-3">E-Plenarius</span>
              </>}
        </div>

        <div>
          <p className="font-mono-jet text-xs tracking-widest mb-4"
             style={{ color: '#5B636D', letterSpacing: '0.1em' }}>
            SISTEMA DE VOTAÇÃO MUNICIPAL
          </p>
          <h1 className="font-tight font-semibold text-white leading-tight"
              style={{ fontSize: 42, letterSpacing: '-0.03em', lineHeight: 1.08 }}>
            Votação em<br />tempo real,<br />com{' '}
            <span style={{ color: '#1447E6' }}>auditoria<br />imutável.</span>
          </h1>
          <p className="mt-5 text-sm leading-relaxed" style={{ color: '#9AA3AE' }}>
            Plataforma multi-câmara com WebSocket para sessões ao vivo,
            app para vereadores e telão do plenário.
          </p>

          <div className="mt-10 flex flex-col gap-3">
            {[
              ['Presidente', 'Abre votações, gerencia sessões e vereadores'],
              ['Vereadores', 'Votam pelo app com confirmação em dois toques'],
              ['Telão', 'Contagem ao vivo para público e imprensa'],
            ].map(([role, desc]) => (
              <div key={role} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                     style={{ background: 'rgba(82,130,255,0.15)', color: '#1447E6' }}>
                  <CheckIcon />
                </div>
                <div>
                  <span className="text-sm font-semibold text-white">{role}</span>
                  <span className="text-sm ml-1.5" style={{ color: '#9AA3AE' }}>{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="font-mono-jet text-xs" style={{ color: '#5B636D' }}>
          SHA‑256 · ed25519 · WebSocket · Multi-tenant
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center mb-10 lg:hidden">
            {systemLogo
              ? <img src={systemLogo} alt="Logo" style={{ maxHeight: 32, maxWidth: 160, objectFit: 'contain' }} />
              : <>
                  <Brasao size={28} color="#1447E6" />
                  <span className="font-tight font-semibold text-white ml-2">E-Plenarius</span>
                </>}
          </div>

          <p className="font-mono-jet text-xs tracking-widest mb-1.5"
             style={{ color: '#5B636D', letterSpacing: '0.1em' }}>
            ACESSO AO SISTEMA
          </p>
          <h2 className="font-tight font-semibold text-white text-3xl mb-8"
              style={{ letterSpacing: '-0.025em' }}>
            Entrar
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold font-mono-jet tracking-wider"
                     style={{ color: '#9AA3AE', letterSpacing: '0.06em' }}>
                USUÁRIO OU E-MAIL
              </label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="pedro ou pedro@camara.leg.br"
                autoCapitalize="none"
                autoCorrect="off"
                required
                className="w-full px-3.5 py-3 rounded-lg text-sm text-white outline-none transition-all"
                style={{
                  background: '#15191F',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontFamily: 'inherit',
                }}
                onFocus={e => e.target.style.borderColor = '#1447E6'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold font-mono-jet tracking-wider"
                     style={{ color: '#9AA3AE', letterSpacing: '0.06em' }}>
                SENHA
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-3 pr-11 rounded-lg text-sm text-white outline-none transition-all"
                  style={{
                    background: '#15191F',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => e.target.style.borderColor = '#1447E6'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: '#5B636D' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div key={shakeKey} className="flex gap-3 px-4 py-3.5 rounded-xl animate-shake"
                   style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#f87171' }}>{error.title}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'rgba(248,113,113,0.8)' }}>{error.detail}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-opacity"
              style={{
                background: '#1447E6',
                color: '#fff',
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}>
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-xs mt-8" style={{ color: '#5B636D' }}>
            Acesso restrito a membros da câmara.<br />
            Contate o administrador para solicitar acesso.
          </p>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function Brasao({ size = 40, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="40" cy="40" r="38" stroke={color} strokeWidth="1.5" />
      <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="0.9"
              strokeDasharray="2 3" opacity="0.5" />
      <path d="M40 18 L44.5 32 L59 32 L47.2 40.5 L51.8 54.5 L40 46 L28.2 54.5 L32.8 40.5 L21 32 L35.5 32 Z"
            fill={color} opacity="0.92" />
      <path d="M14 56 L66 56" stroke={color} strokeWidth="1.2" opacity="0.6" />
      <text x="40" y="68" textAnchor="middle" fontSize="8" fontFamily="Inter Tight, sans-serif"
            fontWeight="700" fill={color} letterSpacing="2">VA</text>
    </svg>
  );
}
