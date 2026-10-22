import { NextRequest, NextResponse } from 'next/server';

/**
 * Autenticação do painel passa por aqui (mesmo domínio do painel), não direto para a API:
 * - o refresh token (7 dias) fica em cookie HttpOnly + Secure + SameSite=Strict — nenhum
 *   JavaScript da página consegue lê-lo, nem um script injetado (XSS);
 * - o access token (15 min) volta só no corpo e fica em memória na aba;
 * - "confiar neste computador" (2FA) também fica em cookie HttpOnly;
 * - a API recebe o IP real do navegador, autenticado pelo segredo WEB_PROXY_SECRET.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'gru1'; // São Paulo, perto da VPS

const API = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const PROXY_SECRET = process.env.WEB_PROXY_SECRET ?? '';
const RT_COOKIE = 'ep_rt';
const TRUST_COOKIE = 'ep_mfa_trust';
const ALLOWED = new Set(['login', 'refresh', 'logout', 'mfa/setup', 'mfa/enable', 'mfa/verify']);

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth',
};

function clientIp(req: NextRequest): string {
  // Na Vercel estes cabeçalhos são reescritos pela plataforma (o navegador não os forja).
  return req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
}

/** Só aceita chamadas da própria página (defesa extra contra CSRF, além do SameSite=Strict). */
function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.get('host');
  } catch {
    return false;
  }
}

async function callApi(path: string, body: unknown, req: NextRequest, authorization?: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (PROXY_SECRET) {
    headers['x-eplen-proxy'] = PROXY_SECRET;
    const ip = clientIp(req);
    if (ip) headers['x-eplen-client-ip'] = ip;
  }
  if (authorization) headers.Authorization = authorization;
  const res = await fetch(`${API}/auth/${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data: data as Record<string, any> };
}

function reply(status: number, data: Record<string, any>) {
  const { refreshToken, trustToken, ...body } = data ?? {};
  const res = NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (status < 300 && refreshToken) res.cookies.set(RT_COOKIE, refreshToken, { ...cookieBase, maxAge: 7 * 24 * 3600 });
  if (status < 300 && trustToken) res.cookies.set(TRUST_COOKIE, trustToken, { ...cookieBase, maxAge: 30 * 24 * 3600 });
  return res;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join('/');
  if (!ALLOWED.has(path)) return NextResponse.json({ message: 'Não encontrado' }, { status: 404 });
  if (!sameOrigin(req)) return NextResponse.json({ message: 'Origem não permitida' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const rt = req.cookies.get(RT_COOKIE)?.value;

  try {
    if (path === 'login') {
      const { identifier, password } = body ?? {};
      const r = await callApi('login', { identifier, password, trustToken: req.cookies.get(TRUST_COOKIE)?.value }, req);
      return reply(r.status, r.data);
    }

    if (path === 'refresh') {
      // Sem cookie = visitante sem login: responde "sem sessão" sem erro (evita 401 em toda página pública).
      if (!rt) return NextResponse.json({ session: null }, { headers: { 'Cache-Control': 'no-store' } });
      const r = await callApi('refresh', { refreshToken: rt }, req);
      const res = reply(r.status, r.data);
      if (r.status === 401 || r.status === 403) res.cookies.delete({ name: RT_COOKIE, path: cookieBase.path });
      return res;
    }

    if (path === 'logout') {
      const auth = req.headers.get('authorization');
      if (auth && rt) await callApi('logout', { refreshToken: rt }, req, auth).catch(() => null);
      const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
      res.cookies.delete({ name: RT_COOKIE, path: cookieBase.path });
      return res;
    }

    // mfa/setup, mfa/enable, mfa/verify: corpo repassado como veio
    const r = await callApi(path, body, req);
    return reply(r.status, r.data);
  } catch {
    return NextResponse.json({ message: 'Servidor indisponível' }, { status: 502 });
  }
}
