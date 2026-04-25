import Cookies from 'js-cookie';
import api from './api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'presidente' | 'vereador' | 'secretaria';
  chamberId: string | null;
  initials: string;
  party: string;
  avatarUrl?: string | null;
}

export async function login(identifier: string, password: string): Promise<AuthUser> {
  const { data } = await api.post('/auth/login', { identifier, password });
  Cookies.set('access_token', data.accessToken, { expires: 1 / 96 });
  Cookies.set('refresh_token', data.refreshToken, { expires: 7 });
  return data.user;
}

export async function logout() {
  try { await api.delete('/sessions/leave'); } catch {}
  try { await api.post('/auth/logout'); } catch {}
  Cookies.remove('access_token');
  Cookies.remove('refresh_token');
}

export function isAuthenticated(): boolean {
  return !!Cookies.get('access_token') || !!Cookies.get('refresh_token');
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function storeUser(user: AuthUser) {
  localStorage.setItem('auth_user', JSON.stringify(user));
}

export function clearUser() {
  localStorage.removeItem('auth_user');
}
