'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import api from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ?? 'http://localhost:3001';

export interface ChamberInfo {
  id: string;
  name: string;
  city: string;
  state: string;
  slug: string;
  /** URL absoluta do brasão/logo, já pronta para <img>. */
  logo: string | null;
  /** Há sessão em andamento agora (atualizado a cada 30 s). */
  live: boolean;
}

const ChamberContext = createContext<ChamberInfo | null>(null);

/** Câmara do usuário logado: buscada uma vez e compartilhada por todo o painel. */
export function ChamberProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [chamber, setChamber] = useState<Omit<ChamberInfo, 'live'> | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!user?.chamberId) { setChamber(null); return; }
    api.get(`/chambers/${user.chamberId}`)
      .then(({ data }) => setChamber({
        id: data.id, name: data.name, city: data.city, state: data.state, slug: data.slug,
        logo: data.logoUrl ? `${API_BASE}${data.logoUrl}` : null,
      }))
      .catch(() => {});
  }, [user?.chamberId]);

  useEffect(() => {
    if (!user?.chamberId) return;
    const check = () => api.get(`/sessions/active/${user.chamberId}`)
      .then(({ data }) => setLive(!!data?.id)).catch(() => {});
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [user?.chamberId]);

  useEffect(() => {
    if (chamber) document.title = `${chamber.name} · Painel E-Plenarius`;
  }, [chamber]);

  return <ChamberContext.Provider value={chamber ? { ...chamber, live } : null}>{children}</ChamberContext.Provider>;
}

export function useChamber() {
  return useContext(ChamberContext);
}
