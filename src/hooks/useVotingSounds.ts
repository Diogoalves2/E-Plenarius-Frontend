import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';

const START_URL = '/audio/voting-start.mp3';
const END_URL   = '/audio/voting-end.mp3';

/**
 * Toca som quando uma votação é aberta (voting:opened) ou encerrada (voting:closed).
 * Browsers modernos bloqueiam autoplay sem interação prévia — por isso retornamos
 * `needsActivation` + `activate()` pra exibir um botão "Ativar som" caso a primeira
 * tentativa falhe.
 */
export function useVotingSounds(socket: Socket | null) {
  const startRef = useRef<HTMLAudioElement | null>(null);
  const endRef   = useRef<HTMLAudioElement | null>(null);
  const [needsActivation, setNeedsActivation] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    startRef.current = new Audio(START_URL);
    endRef.current   = new Audio(END_URL);
    startRef.current.preload = 'auto';
    endRef.current.preload   = 'auto';
    startRef.current.volume = 1.0;
    endRef.current.volume   = 1.0;
  }, []);

  useEffect(() => {
    if (!socket) return;

    const tryPlay = async (el: HTMLAudioElement | null) => {
      if (!el) return;
      try {
        el.currentTime = 0;
        await el.play();
        setNeedsActivation(false);
      } catch (err) {
        // Autoplay bloqueado — sinaliza pra UI mostrar botão de ativar som.
        console.warn('[voting-sound] play() bloqueado:', err);
        setNeedsActivation(true);
      }
    };

    const onOpen  = () => tryPlay(startRef.current);
    const onClose = () => tryPlay(endRef.current);

    socket.on('voting:opened', onOpen);
    socket.on('voting:closed', onClose);
    return () => {
      socket.off('voting:opened', onOpen);
      socket.off('voting:closed', onClose);
    };
  }, [socket]);

  /** Chama em resposta a clique do usuário pra desbloquear o audio context. */
  async function activate() {
    try {
      // Toca silenciosamente os dois pra "unlockar" no mobile/desktop
      for (const ref of [startRef.current, endRef.current]) {
        if (!ref) continue;
        const originalVolume = ref.volume;
        ref.volume = 0;
        await ref.play();
        ref.pause();
        ref.currentTime = 0;
        ref.volume = originalVolume;
      }
      setNeedsActivation(false);
    } catch (err) {
      console.warn('[voting-sound] activate falhou:', err);
    }
  }

  return { needsActivation, activate };
}
