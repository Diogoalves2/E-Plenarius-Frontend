import axios, { AxiosError } from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

async function tryRefresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  // Tenta refresh até 2x com backoff. Diferencia 401 (token inválido = logout)
  // de erro transitório (network/5xx = retry, mantém sessão).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data } = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
        { refreshToken },
        { timeout: 15000 },
      );
      return data;
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      // 401 / 403 = refresh token revogado ou expirado. Logout real.
      if (status === 401 || status === 403) return null;
      // 500/network/timeout: espera 1s e tenta de novo
      if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
    }
  }
  // Esgotou tentativas em erro transitório. Não desloga — só falha a request atual.
  throw new Error('refresh-transient');
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as any;
    if (error.response?.status === 401 && !original?._retry && !original?.url?.includes('/auth/login')) {
      original._retry = true;
      const refreshToken = Cookies.get('refresh_token');
      if (!refreshToken) {
        window.location.href = '/login';
        return Promise.reject(error);
      }
      try {
        const tokens = await tryRefresh(refreshToken);
        if (tokens === null) {
          // Refresh token de fato inválido — logout
          Cookies.remove('access_token');
          Cookies.remove('refresh_token');
          window.location.href = '/login';
          return Promise.reject(error);
        }
        Cookies.set('access_token', tokens.accessToken, { expires: 1 / 96 });
        Cookies.set('refresh_token', tokens.refreshToken, { expires: 7 });
        original.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return api(original);
      } catch (e: any) {
        // Erro transitório — não desloga. Só propaga falha desta request.
        if (e?.message === 'refresh-transient') {
          return Promise.reject(error);
        }
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
