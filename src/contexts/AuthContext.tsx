'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AuthUser, LoginResult, login as apiLogin, logout as apiLogout, clearLegacyStorage } from '@/lib/auth';
import api, { refreshSession, setAccessToken } from '@/lib/api';

/** Avisa as outras abas do mesmo navegador (painel, telão) sobre login/logout. */
const AUTH_CHANNEL = 'eplenarius-auth';
function broadcast(msg: 'login' | 'logout') {
  try { const c = new BroadcastChannel(AUTH_CHANNEL); c.postMessage(msg); c.close(); } catch { /* navegador sem suporte */ }
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** Pode parar no meio: superadmin/presidente ainda precisam do código da 2FA. */
  login: (identifier: string, password: string) => Promise<LoginResult>;
  /** Conclui o login (depois da senha, ou da 2FA) e vai para o painel. */
  finishLogin: (user: AuthUser) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(data: any): AuthUser {
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    chamberId: data.chamberId ?? null,
    initials: data.initials ?? '',
    party: data.party ?? '',
    avatarUrl: data.avatarUrl ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/users/me');
      setUser(toAuthUser(data));
    } catch { /* mantém o usuário atual */ }
  }, []);

  // Ao abrir/recarregar: a sessão volta pelo cookie HttpOnly (nada fica salvo no navegador).
  useEffect(() => {
    clearLegacyStorage();
    refreshSession()
      .then(session => { if (session) setUser(toAuthUser(session.user)); })
      .catch(() => { /* servidor fora do ar: tela de login mostra o erro ao tentar */ })
      .finally(() => setLoading(false));
  }, []);

  // Logout em uma aba encerra todas (o telão some junto); login em uma aba reabre as outras.
  useEffect(() => {
    const out = () => { setAccessToken(null); setUser(null); };
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(AUTH_CHANNEL);
      ch.onmessage = e => {
        if (e.data === 'logout') out();
        if (e.data === 'login') refreshSession().then(s => { if (s) setUser(toAuthUser(s.user)); }).catch(() => {});
      };
    } catch { /* navegador sem suporte */ }
    window.addEventListener('eplenarius:logged-out', out);
    return () => { ch?.close(); window.removeEventListener('eplenarius:logged-out', out); };
  }, []);

  const finishLogin = useCallback((u: AuthUser) => {
    setUser(toAuthUser(u));
    broadcast('login');
    router.push(u.role === 'superadmin' ? '/superadmin' : '/dashboard');
  }, [router]);

  const login = useCallback(async (identifier: string, password: string) => {
    const result = await apiLogin(identifier, password);
    if (result.done) finishLogin(result.user);
    return result;
  }, [finishLogin]);

  async function logout() {
    await apiLogout();
    setUser(null);
    broadcast('logout');
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, finishLogin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
