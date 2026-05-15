import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';

const WARNING_URL = '/audio/expediente-warning.mp3';
const END_URL     = '/audio/expediente-end.mp3';
const WARNING_THRESHOLD = 60; // dispara quando faltar exatamente 60s (1 min)

/**
 * Áudios do expediente:
 *  - warning: faltando 1 min (tempoRestante === 60)
 *  - end: quando o tempo zera (expediente:encerrado com motivo 'tempo_esgotado')
 *
 * Os triggers resetam quando começa um novo expediente ou quando o presidente
 * estende o tempo acima do threshold.
 */
export function useExpedienteSounds(socket: Socket | null) {
  const warningRef = useRef<HTMLAudioElement | null>(null);
  const endRef     = useRef<HTMLAudioElement | null>(null);
  const warningTriggered = useRef(false);
  const [needsActivation, setNeedsActivation] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    warningRef.current = new Audio(WARNING_URL);
    endRef.current     = new Audio(END_URL);
    for (const el of [warningRef.current, endRef.current]) {
      el.preload = 'auto';
      el.volume = 1.0;
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    const tryPlay = async (el: HTMLAudioElement | null) => {
      try {
        if (!el) return;
        el.currentTime = 0;
        await el.play();
        setNeedsActivation(false);
      } catch (err) {
        console.warn('[expediente-sound] play() bloqueado:', err);
        setNeedsActivation(true);
      }
    };

    const onIniciado   = () => { warningTriggered.current = false; };
    const onEncerrado  = ({ motivo }: { motivo?: string }) => {
      if (motivo === 'tempo_esgotado') tryPlay(endRef.current);
      warningTriggered.current = false;
    };

    const onTick = ({ tempoRestante }: { tempoRestante: number }) => {
      if (tempoRestante === WARNING_THRESHOLD && !warningTriggered.current) {
        warningTriggered.current = true;
        tryPlay(warningRef.current);
      }
      if (tempoRestante > WARNING_THRESHOLD + 5) {
        warningTriggered.current = false;
      }
    };

    socket.on('expediente:iniciado', onIniciado);
    socket.on('expediente:encerrado', onEncerrado);
    socket.on('expediente:tick', onTick);

    return () => {
      socket.off('expediente:iniciado', onIniciado);
      socket.off('expediente:encerrado', onEncerrado);
      socket.off('expediente:tick', onTick);
    };
  }, [socket]);

  return { needsActivation };
}
