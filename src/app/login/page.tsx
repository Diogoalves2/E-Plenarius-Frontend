'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Loader2, AlertTriangle, User, Lock, ArrowRight } from 'lucide-react';
import { MfaSetupStep, MfaVerifyStep } from '@/components/auth/MfaSteps';

const SYSTEM_LOGO_KEY = 'system_logo_url';
const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ?? 'http://localhost:3001';

function resolveErrorMessage(err: any): { title: string; detail: string } {
  const status = err?.response?.status;
  const msg: string = err?.response?.data?.message ?? '';

  if (!err?.response) return { title: 'Sem conexão', detail: 'Não foi possível conectar ao servidor. Verifique sua internet.' };
  if (status === 401 || msg.toLowerCase().includes('credenciais') || msg.toLowerCase().includes('inválid'))
    return { title: 'Credenciais inválidas', detail: 'Usuário/e-mail ou senha incorretos.' };
  if (status === 403 || msg.toLowerCase().includes('desativad'))
    return { title: 'Conta desativada', detail: 'Esta conta está desativada. Contate o administrador.' };
  if (status === 429)
    return { title: 'Muitas tentativas', detail: 'Aguarde alguns instantes antes de tentar novamente.' };
  return { title: 'Erro ao entrar', detail: msg || 'Tente novamente mais tarde.' };
}

const fieldCls =
  'login-input w-full h-11 rounded-lg text-sm outline-none transition-[border-color,box-shadow] ' +
  'bg-[#15191F] border border-white/[0.08] text-white placeholder:text-[#5B636D] ' +
  'hover:border-white/[0.16] focus:border-[#1447E6] focus:ring-4 focus:ring-[#1447E6]/20';

export default function LoginPage() {
  const { login, finishLogin } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [systemLogo, setSystemLogo] = useState<string | null>(null);
  // Senha ok, falta o segundo fator (superadmin/presidente)
  const [mfa, setMfa] = useState<{ token: string; setup: boolean } | null>(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(SYSTEM_LOGO_KEY);
      if (cached) setSystemLogo(cached);
    } catch { /* sem armazenamento */ }

    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'}/upload/system-logo`)
      .then(r => r.json())
      .then(({ url }) => {
        if (url) {
          const full = `${API_BASE}${url}`;
          setSystemLogo(full);
          try { localStorage.setItem(SYSTEM_LOGO_KEY, full); } catch { /* sem armazenamento */ }
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(identifier, password);
      if (!result.done) {
        setMfa({ token: result.mfaToken, setup: result.setup });
        setPassword('');
      }
    } catch (err: any) {
      setError(resolveErrorMessage(err));
      setShakeKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  }, [login, identifier, password]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
         style={{
           background: 'radial-gradient(900px 480px at 50% -10%, rgba(20,71,230,0.16), transparent 70%), #0B0D10',
         }}>
      <div className="w-full max-w-[400px]">
        {/* Marca */}
        <div className="flex justify-center mb-8">
          {systemLogo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={systemLogo} alt="E-Plenarius" style={{ height: 30, maxWidth: 240, objectFit: 'contain' }} />
            : <div className="flex items-center gap-2.5">
                <Brasao size={32} color="#1447E6" />
                <span className="font-tight font-semibold text-lg tracking-tight text-white">E-Plenarius</span>
              </div>}
        </div>

        <div className="rounded-2xl p-8"
             style={{ background: 'rgba(17,20,26,0.92)', border: '1px solid rgba(255,255,255,0.07)',
                      boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -12px rgba(0,0,0,0.6)' }}>
          {mfa ? (
            mfa.setup
              ? <MfaSetupStep mfaToken={mfa.token} onDone={finishLogin} onBack={() => setMfa(null)} />
              : <MfaVerifyStep mfaToken={mfa.token} onDone={finishLogin} onBack={() => setMfa(null)} />
          ) : (<>
            <h1 className="font-tight font-semibold text-[22px] text-center text-white" style={{ letterSpacing: '-0.02em' }}>
              Entrar no painel
            </h1>
            <p className="text-sm text-center mt-1.5 mb-7" style={{ color: '#8A94A2' }}>
              Use seu usuário ou e-mail cadastrado na Câmara.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="identifier" className="text-[13px] font-medium" style={{ color: '#C9CED6' }}>Usuário ou e-mail</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#5B636D' }} />
                  <input
                    id="identifier"
                    type="text"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="usuario ou nome@camara.leg.br"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoFocus
                    required
                    className={`${fieldCls} pl-10 pr-3.5`}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-[13px] font-medium" style={{ color: '#C9CED6' }}>Senha</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#5B636D' }} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    autoComplete="current-password"
                    required
                    className={`${fieldCls} pl-10 pr-11`}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md transition-colors hover:bg-white/5"
                          style={{ color: '#5B636D' }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div key={shakeKey} role="alert" className="flex gap-2.5 px-3.5 py-3 rounded-lg animate-shake"
                     style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)' }}>
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
                className="group mt-2 w-full h-11 rounded-lg font-semibold text-sm text-white flex items-center justify-center gap-2 transition-colors bg-[#1447E6] hover:bg-[#103CC4] disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1447E6]/40">
                {loading
                  ? <><Loader2 size={15} className="animate-spin" /> Entrando…</>
                  : <>Entrar <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" /></>}
              </button>
            </form>
          </>)}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#5B636D' }}>
          Acesso restrito a membros da Câmara.
        </p>
      </div>
    </div>
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
    </svg>
  );
}
