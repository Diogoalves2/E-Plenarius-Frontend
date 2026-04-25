'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AuthUser, login as apiLogin, logout as apiLogout, getStoredUser, storeUser, clearUser, isAuthenticated } from '@/lib/auth';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      const stored = getStoredUser();
      if (stored) setUser(stored);
    }
    setLoading(false);
  }, []);

  async function login(identifier: string, password: string) {
    const userData = await apiLogin(identifier, password);
    storeUser(userData);
    setUser(userData);
    router.push(userData.role === 'superadmin' ? '/superadmin' : '/dashboard');
  }

  async function logout() {
    await apiLogout();
    clearUser();
    setUser(null);
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
