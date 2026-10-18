'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
export const PUBLIC_MEDIA = PUBLIC_API.replace(/\/api\/?$/, '');

export async function publicGet<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${PUBLIC_API}${path}`);
    return r.ok ? r.json() : null;
  } catch { return null; }
}

const TABS = [
  { key: 'sessoes', label: 'Sessões', href: (id: string) => `/publico/${id}` },
  { key: 'vereadores', label: 'Vereadores', href: (id: string) => `/publico/${id}/vereadores` },
  { key: 'votacoes', label: 'Votações', href: (id: string) => `/publico/${id}/votacoes` },
  { key: 'dados', label: 'Dados abertos', href: (id: string) => `/publico/${id}/votacoes#dados-abertos` },
];

/** Abas do portal de transparência (usadas também na página de sessões existente). */
export function PublicNav({ chamberId, active }: { chamberId: string; active: string }) {
  return (
    <nav className="bg-white border-b" style={{ borderColor: 'rgba(15,23,42,0.08)' }}>
      <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <Link key={t.key} href={t.href(chamberId)}
                className="px-3 py-3 text-sm font-semibold whitespace-nowrap"
                style={{ color: active === t.key ? '#1447E6' : '#64748B', borderBottom: `2px solid ${active === t.key ? '#1447E6' : 'transparent'}` }}>
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function PublicShell({ chamberId, active, title, children }: {
  chamberId: string; active: string; title: string; children: React.ReactNode;
}) {
  const [camara, setCamara] = useState<{ name: string; city: string; state: string; logoUrl: string | null } | null>(null);
  useEffect(() => {
    publicGet<any>(`/public/chambers/${chamberId}`).then(d => d && setCamara(d.camara));
  }, [chamberId]);

  return (
    <div className="min-h-screen" style={{ background: '#F6F7F9', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ background: '#0B0D10', color: '#E9EDF2' }}>
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center gap-4">
          {camara?.logoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={`${PUBLIC_MEDIA}${camara.logoUrl}`} alt="" style={{ height: 40, width: 40, objectFit: 'contain' }} />
          )}
          <div className="min-w-0">
            <p className="font-mono text-[10px]" style={{ letterSpacing: '0.1em', color: '#8A94A2' }}>
              {camara ? `${camara.name.toUpperCase()} · ${camara.city.toUpperCase()}/${camara.state}` : 'CÂMARA MUNICIPAL'} · PORTAL DA TRANSPARÊNCIA
            </p>
            <h1 className="text-lg font-bold truncate" style={{ letterSpacing: '-0.02em' }}>{title}</h1>
          </div>
        </div>
      </header>
      <PublicNav chamberId={chamberId} active={active} />
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

export const STATUS_PUB: Record<string, { label: string; color: string; bg: string }> = {
  aprovado: { label: 'APROVADO', color: '#059669', bg: 'rgba(16,185,129,0.1)' },
  rejeitado: { label: 'REJEITADO', color: '#dc2626', bg: 'rgba(239,68,68,0.1)' },
};

export const CHOICE_PUB: Record<string, { label: string; color: string }> = {
  sim: { label: 'Sim', color: '#059669' },
  nao: { label: 'Não', color: '#dc2626' },
  abstencao: { label: 'Abstenção', color: '#64748B' },
};
