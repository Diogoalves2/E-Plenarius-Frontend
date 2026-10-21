import api, { authApi, setAccessToken } from './api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'presidente' | 'vice_presidente' | 'vereador' | 'secretaria';
  chamberId: string | null;
  initials: string;
  party: string;
  avatarUrl?: string | null;
}

/** Login concluído, ou falta o segundo fator (código do app autenticador). */
export type LoginResult =
  | { done: true; user: AuthUser }
  | { done: false; mfaToken: string; setup: boolean };

function finish(data: any): AuthUser {
  setAccessToken(data.accessToken);
  return data.user;
}

export async function login(identifier: string, password: string): Promise<LoginResult> {
  const { data } = await authApi.post('/login', { identifier, password });
  if (data.mfaToken) return { done: false, mfaToken: data.mfaToken, setup: !!data.mfaSetupRequired };
  return { done: true, user: finish(data) };
}

export async function mfaSetup(mfaToken: string): Promise<{ secret: string; otpauthUrl: string }> {
  return (await authApi.post('/mfa/setup', { mfaToken })).data;
}

export async function mfaEnable(mfaToken: string, code: string, remember: boolean) {
  const { data } = await authApi.post('/mfa/enable', { mfaToken, code, remember });
  return { user: finish(data), recoveryCodes: data.recoveryCodes as string[] };
}

export async function mfaVerify(mfaToken: string, code: string, remember: boolean) {
  const { data } = await authApi.post('/mfa/verify', { mfaToken, code, remember });
  return { user: finish(data), usedRecoveryCode: !!data.usedRecoveryCode };
}

export async function logout() {
  try { await api.delete('/sessions/leave'); } catch {}
  try { await authApi.post('/logout'); } catch {}
  setAccessToken(null);
}

/**
 * Versões antigas guardavam tokens em cookies legíveis por JavaScript e o usuário no
 * localStorage. Apaga o que tiver sobrado neste navegador.
 */
export function clearLegacyStorage() {
  if (typeof window === 'undefined') return;
  for (const name of ['access_token', 'refresh_token']) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }
  try { localStorage.removeItem('auth_user'); } catch {}
}

/** Presidente ou vice-presidente: conduzem a sessão (votações, expediente, roteiro). */
export function canConductSession(role?: string | null): boolean {
  return role === 'presidente' || role === 'vice_presidente';
}

export const ROLE_LABEL: Record<string, string> = {
  presidente: 'Presidente',
  vice_presidente: 'Vice-presidente',
  vereador: 'Vereador',
  secretaria: 'Servidor(a) administrativo(a)',
  superadmin: 'Superadmin',
};

/** Membros da Casa (votam e contam presença). */
export const MEMBER_ROLES = ['vereador', 'presidente', 'vice_presidente'];
