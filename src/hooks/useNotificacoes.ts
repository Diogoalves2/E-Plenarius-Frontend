'use client';

import { useEffect, useRef } from 'react';
import { useSocket } from './useSocket';

interface NotifOptions {
  sessionId: string | null;
  userId?: string;
}

function notify(title: string, body: string, icon?: string) {
  if (typeof window === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: icon ?? '/favicon.ico', silent: false });
  } catch {
    // some environments block Notification constructor
  }
}

export function useNotificacoes({ sessionId, userId }: NotifOptions) {
  const { on, socket } = useSocket(sessionId);
  const requestedRef = useRef(false);

  // Request permission once
  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Listen for relevant events
  useEffect(() => {
    if (!socket) return;

    const offVotingOpened = on('voting:opened', (data: any) => {
      notify(
        '🗳️ Votação aberta',
        `${data.item?.title ?? 'Item'} — registre seu voto agora`,
      );
    });

    const offExpedienteIniciado = on('expediente:iniciado', (data: any) => {
      if (userId && data.vereador?.id === userId) {
        notify(
          '🎤 Sua vez na tribuna',
          `${data.tipo === 'grande' ? 'Grande Expediente (10 min)' : 'Pequeno Expediente (5 min)'} — use seu tempo`,
        );
      }
    });

    const offAparteSolicitado = on('aparte:solicitado', (data: any) => {
      notify(
        '✋ Solicitação de Aparte',
        `${data.vereador?.name ?? 'Vereador'} solicita aparte`,
      );
    });

    const offAparteIniciado = on('aparte:iniciado', (data: any) => {
      if (userId && data.vereador?.id === userId) {
        notify(
          '✅ Aparte aceito',
          'Você tem 2 minutos para seu aparte',
        );
      }
    });

    return () => {
      offVotingOpened();
      offExpedienteIniciado();
      offAparteSolicitado();
      offAparteIniciado();
    };
  }, [socket, on, userId]);
}
