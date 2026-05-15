import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';

const WARNING_URL = '/audio/expediente-warning.mp3';
const WARNING_THRESHOLD = 60; // dispara quando faltar exatamente 60s (1 min)

/**
 * Toca um alerta sonoro quando faltar 1 minuto para o vereador no expediente.
 * Reseta automaticamente se a sessão for reiniciada, encerrada, ou se o presidente
 * estender o tempo acima do threshold (assim toca de novo quando faltar 1 min).
 */
export function useExpedienteSounds(socket: Socket | null) {
  const warningRef = useRef<HTMLAudioElement | null>(null);
  const triggered = useRef(false);
  const [needsActivation, setNeedsActivation] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    warningRef.current = new Audio(WARNING_URL);
    warningRef.current.preload = 'auto';
    warningRef.current.volume = 1.0;
  }, []);

  useEffect(() => {
    if (!socket) return;

    const reset = () => { triggered.current = false; };

    const tryPlay = async () => {
      try {
        const el = warningRef.current;
        if (!el) return;
        el.currentTime = 0;
        await el.play();
        setNeedsActivation(false);
      } catch (err) {
        console.warn('[expediente-warning] play() bloqueado:', err);
        setNeedsActivation(true);
      }
    };

    const onTick = ({ tempoRestante }: { tempoRestante: number }) => {
      if (tempoRestante === WARNING_THRESHOLD && !triggered.current) {
        triggered.current = true;
        tryPlay();
      }
      // Se o tempo foi estendido pra bem acima do threshold, libera pra tocar de novo.
      if (tempoRestante > WARNING_THRESHOLD + 5) {
        triggered.current = false;
      }
    };

    socket.on('expediente:iniciado', reset);
    socket.on('expediente:encerrado', reset);
    socket.on('expediente:tick', onTick);

    return () => {
      socket.off('expediente:iniciado', reset);
      socket.off('expediente:encerrado', reset);
      socket.off('expediente:tick', onTick);
    };
  }, [socket]);

  return { needsActivation };
}
