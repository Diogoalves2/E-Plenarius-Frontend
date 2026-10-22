import axios, { AxiosError } from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Access token (15 min) só em memória: não vai para cookie legível nem localStorage.
 * Ao recarregar a página, a sessão volta pelo refresh token, que fica num cookie HttpOnly
 * gravado pela rota /api/auth do próprio painel (ver app/api/auth/[...path]/route.ts).
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

/** Chamadas de login/sessão: mesmo domínio do painel (cookies HttpOnly). */
export const authApi = axios.create({
  baseURL: '/api/auth',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

authApi.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

export interface SessionData {
  accessToken: string;
  user: any;
}

let refreshing: Promise<SessionData | null> | null = null;

/**
 * Renova a sessão pelo cookie HttpOnly. Uma renovação por vez (várias requisições que
 * recebem 401 juntas esperam a mesma). null = sessão encerrada (fazer login).
 * Erro de rede/servidor lança 'refresh-transient' e não desloga.
 */
export function refreshSession(): Promise<SessionData | null> {
  if (!refreshing) {
    refreshing = (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { data } = await authApi.post('/refresh', {}, { timeout: 15000 });
          if (!data?.accessToken) {
            setAccessToken(null);
            return null;
          }
          setAccessToken(data.accessToken);
          return data as SessionData;
        } catch (err) {
          const status = (err as AxiosError).response?.status;
          if (status === 401 || status === 403) {
            setAccessToken(null);
            return null;
          }
          if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
        }
      }
      throw new Error('refresh-transient');
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as any;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        const session = await refreshSession();
        if (!session) {
          window.location.href = '/login';
          return Promise.reject(error);
        }
        original.headers.Authorization = `Bearer ${session.accessToken}`;
        return api(original);
      } catch {
        // Erro transitório: não desloga, só falha esta requisição.
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
