'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';

export interface VereadorExpediente {
  id: string;
  name: string;
  avatarUrl: string | null;
  party: string | null;
  initials: string | null;
  title: string | null;
}

export interface ExpedienteAtivo {
  inscricaoId: string;
  tipo: 'grande' | 'pequeno';
  duracao: number;
  tempoRestante: number;
  vereador: VereadorExpediente;
  paused?: boolean;
}

export interface AparteAtivo {
  vereador: VereadorExpediente;
  tempoRestante: number;
  duracao: number;
}

export interface SolicitacaoAparte {
  userId: string;
  vereador: VereadorExpediente;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export function useExpediente(sessionId: string | null) {
  const { socket, connected, on } = useSocket(sessionId);
  const [expedienteAtivo, setExpedienteAtivo] = useState<ExpedienteAtivo | null>(null);
  const [aparteAtivo, setAparteAtivo] = useState<AparteAtivo | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAparte[]>([]);
  const [inscritosVersion, setInscritosVersion] = useState(0);

  // Fetch state from API on socket connect (handles reconnections)
  const syncEstado = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_BASE}/expediente/sessions/${sessionId}/ativo`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data) { setExpedienteAtivo(null); setAparteAtivo(null); setSolicitacoes([]); return; }
      setExpedienteAtivo({
        inscricaoId: data.inscricaoId,
        tipo: data.tipo,
        duracao: data.tipo === 'grande' ? 600 : 300,
        tempoRestante: data.tempoRestante,
        vereador: data.vereador,
        paused: data.paused,
      });
      setSolicitacoes(data.solicitacoesAparte ?? []);
      if (data.aparteAtivo) {
        setAparteAtivo({ vereador: data.aparteAtivo.vereador, tempoRestante: data.aparteAtivo.tempoRestante, duracao: 120 });
      } else {
        setAparteAtivo(null);
      }
    } catch {
      // silently ignore
    }
  }, [sessionId]);

  useEffect(() => {
    if (!socket) return;

    // Sync state after (re)connection
    socket.on('connect', syncEstado);

    const offIniciado = on('expediente:iniciado', (data: ExpedienteAtivo) => {
      setExpedienteAtivo(data);
      setAparteAtivo(null);
      setSolicitacoes([]);
    });

    const offTick = on('expediente:tick', ({ tempoRestante }: { tempoRestante: number }) => {
      setExpedienteAtivo(prev => prev ? { ...prev, tempoRestante, paused: false } : null);
    });

    const offAjuste = on('expediente:ajuste', ({ tempoRestante }: { tempoRestante: number }) => {
      setExpedienteAtivo(prev => prev ? { ...prev, tempoRestante } : null);
    });

    const offEncerrado = on('expediente:encerrado', () => {
      setExpedienteAtivo(null);
      setAparteAtivo(null);
      setSolicitacoes([]);
    });

    // Apartes
    const offAparteSolicitado = on('aparte:solicitado', (data: { userId: string; vereador: VereadorExpediente }) => {
      setSolicitacoes(prev => {
        if (prev.find(s => s.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, vereador: data.vereador }];
      });
    });

    const offAparteCancelado = on('aparte:cancelado', ({ userId }: { userId: string }) => {
      setSolicitacoes(prev => prev.filter(s => s.userId !== userId));
    });

    const offAparteIniciado = on('aparte:iniciado', (data: { vereador: VereadorExpediente; duracao: number; tempoRestante: number }) => {
      setAparteAtivo({ vereador: data.vereador, tempoRestante: data.tempoRestante, duracao: data.duracao });
      setExpedienteAtivo(prev => prev ? { ...prev, paused: true } : null);
    });

    const offAparteTick = on('aparte:tick', ({ tempoRestante }: { tempoRestante: number }) => {
      setAparteAtivo(prev => prev ? { ...prev, tempoRestante } : null);
    });

    const offAparteEncerrado = on('aparte:encerrado', ({ tempoRestanteOrador }: { tempoRestanteOrador: number }) => {
      setAparteAtivo(null);
      setSolicitacoes([]);
      setExpedienteAtivo(prev => prev ? { ...prev, paused: false, tempoRestante: tempoRestanteOrador } : null);
    });

    const offInscricaoAtualizada = on('expediente:inscricao_atualizada', () => {
      setInscritosVersion(v => v + 1);
    });

    return () => {
      socket.off('connect', syncEstado);
      offIniciado();
      offTick();
      offAjuste();
      offEncerrado();
      offAparteSolicitado();
      offAparteCancelado();
      offAparteIniciado();
      offAparteTick();
      offAparteEncerrado();
      offInscricaoAtualizada();
    };
  }, [socket, on, syncEstado]);

  // Initial sync on mount
  useEffect(() => { syncEstado(); }, [syncEstado]);

  return { expedienteAtivo, aparteAtivo, solicitacoes, connected, inscritosVersion };
}
