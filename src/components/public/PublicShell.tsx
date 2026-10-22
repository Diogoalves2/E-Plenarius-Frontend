'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarDays, Users, Vote, Database, Landmark, Radio, Loader2 } from 'lucide-react';

export const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
export const PUBLIC_MEDIA = PUBLIC_API.replace(/\/api\/?$/, '');

export async function publicGet<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${PUBLIC_API}${path}`);
    if (!r.ok) return null;
    const text = await r.text(); // resposta vazia (ex.: nenhuma sessão ativa) = null
    return text ? JSON.parse(text) : null;
  } catch { return null; }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tokens do portal (texto nunca usa a cor do dado). */
export const T = {
  ink: '#0B1220', ink2: '#334155', muted: '#64748B', hair: 'rgba(15,23,42,0.08)',
  grid: '#E5E9F0', page: '#F4F6F9', accent: '#1447E6',
  sim: '#059669', nao: '#dc2626', abst: '#94a3b8', ausente: '#E2E8F0',
};

const TABS = [
  { key: 'sessoes', label: 'Sessões', icon: CalendarDays, href: (id: string) => `/publico/${id}` },
  { key: 'votacoes', label: 'Votações', icon: Vote, href: (id: string) => `/publico/${id}/votacoes` },
  { key: 'vereadores', label: 'Vereadores', icon: Users, href: (id: string) => `/publico/${id}/vereadores` },
  { key: 'dados', label: 'Dados abertos', icon: Database, href: (id: string) => `/publico/${id}/votacoes#dados-abertos` },
];

export interface PublicCamara {
  id: string; name: string; city: string; state: string; logoUrl: string | null;
  legislaturaInicio?: number | null; legislaturaFim?: number | null;
}

export function PublicShell({ chamberId, active, title, subtitle, children }: {
  chamberId: string; active: string; title: string; subtitle?: string; children: React.ReactNode;
}) {
  const [camara, setCamara] = useState<PublicCamara | null>(null);
  const [liveSession, setLiveSession] = useState<string | null>(null);
  const isUuid = UUID.test(chamberId);

  useEffect(() => {
    if (!isUuid) return;
    publicGet<PublicCamara>(`/chambers/${chamberId}`).then(c => c && setCamara(c));
    publicGet<{ id: string } | null>(`/sessions/active/${chamberId}`).then(s => setLiveSession(s?.id ?? null));
  }, [chamberId, isUuid]);

  useEffect(() => {
    if (camara) document.title = `${title} · ${camara.name}`;
  }, [camara, title]);

  const legislatura = camara?.legislaturaInicio && camara?.legislaturaFim
    ? `Legislatura ${camara.legislaturaInicio}–${camara.legislaturaFim}` : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: T.page, fontFamily: 'Inter, system-ui, sans-serif', color: T.ink }}>
      <div style={{ background: '#0B1220', color: '#CBD5E1' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-8 flex items-center justify-between text-[11px]">
          <span className="font-semibold tracking-wide">PORTAL DA TRANSPARÊNCIA</span>
          <span className="hidden sm:inline" style={{ color: '#94A3B8' }}>Lei de Acesso à Informação · Lei 12.527/2011</span>
        </div>
      </div>

      <header className="bg-white" style={{ borderBottom: `1px solid ${T.hair}` }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6 flex items-center gap-4">
          <div className="flex-shrink-0 rounded-2xl flex items-center justify-center overflow-hidden"
               style={{ width: 64, height: 64, background: '#F8FAFC', border: `1px solid ${T.hair}` }}>
            {camara?.logoUrl
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={`${PUBLIC_MEDIA}${camara.logoUrl}`} alt={`Brasão da ${camara.name}`} style={{ width: 56, height: 56, objectFit: 'contain' }} />
              : <Landmark size={28} color={T.accent} />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold leading-tight truncate" style={{ fontSize: 'clamp(18px, 3vw, 24px)', letterSpacing: '-0.02em' }}>
              {camara?.name ?? ' '}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: T.muted }}>
              {camara ? ['Poder Legislativo Municipal', `${camara.city}/${camara.state}`, legislatura].filter(Boolean).join(' · ') : ' '}
            </p>
          </div>
          {liveSession && (
            <Link href={`/publico/${chamberId}/sessao/${liveSession}`}
                  className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(5,150,105,0.08)', color: '#047857', border: '1px solid rgba(5,150,105,0.25)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: T.sim }} />
              <Radio size={13} /> Sessão ao vivo
            </Link>
          )}
        </div>
        <nav className="max-w-6xl mx-auto px-2 sm:px-4 flex gap-1 overflow-x-auto" aria-label="Seções do portal">
          {TABS.map(t => {
            const on = active === t.key;
            return (
              <Link key={t.key} href={t.href(chamberId)} aria-current={on ? 'page' : undefined}
                    className="flex items-center gap-2 px-3 py-3 text-sm font-semibold whitespace-nowrap"
                    style={{ color: on ? T.accent : T.muted, borderBottom: `2px solid ${on ? T.accent : 'transparent'}` }}>
                <t.icon size={15} /> {t.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h2 className="font-bold" style={{ fontSize: 22, letterSpacing: '-0.02em' }}>{title}</h2>
          {subtitle && <p className="text-sm mt-1" style={{ color: T.muted }}>{subtitle}</p>}
        </div>
        {isUuid ? children : <div className="flex justify-center py-20"><Loader2 className="animate-spin" color={T.muted} /></div>}
      </main>

      <footer className="bg-white" style={{ borderTop: `1px solid ${T.hair}` }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 text-xs flex flex-wrap gap-x-6 gap-y-1 justify-between" style={{ color: T.muted }}>
          <span>{camara ? `${camara.name} · ${camara.city}/${camara.state}` : ''}</span>
          <span>Resultados com verificação criptográfica pública · E-Plenarius</span>
        </div>
      </footer>
    </div>
  );
}

export const STATUS_PUB: Record<string, { label: string; color: string; bg: string }> = {
  aprovado: { label: 'Aprovado', color: '#047857', bg: 'rgba(5,150,105,0.1)' },
  rejeitado: { label: 'Rejeitado', color: '#b91c1c', bg: 'rgba(220,38,38,0.1)' },
};

export const CHOICE_PUB: Record<string, { label: string; color: string }> = {
  sim: { label: 'Sim', color: T.sim },
  nao: { label: 'Não', color: T.nao },
  abstencao: { label: 'Abstenção', color: T.abst },
};

/** Data em pt-BR; aceita 'AAAA-MM-DD' (sem fuso, não volta um dia) ou data completa. */
export function dataPub(v: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!v) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', opts);
}

export const ROLE_PUB = (m: { role: string; title?: string | null }) =>
  m.role === 'presidente' ? 'Presidente' : m.role === 'vice_presidente' ? 'Vice-presidente' : m.title || 'Vereador(a)';
