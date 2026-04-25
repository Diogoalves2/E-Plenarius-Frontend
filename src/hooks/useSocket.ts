'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';

const WS_URL = (process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001');

export function useSocket(sessionId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  // Reactive socket so consumers re-run effects when it becomes available
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const getToken = () => Cookies.get('access_token') ?? '';

    const sock = io(`${WS_URL}/voting`, {
      auth: { token: getToken() },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = sock;
    setSocket(sock);

    const onConnect = () => {
      setConnected(true);
      // Rejoin session room on every connect/reconnect
      sock.emit('session:join', { sessionId });
    };

    const onDisconnect = () => setConnected(false);

    sock.on('connect', onConnect);
    sock.on('disconnect', onDisconnect);

    // Refresh token before each reconnect attempt
    sock.io.on('reconnect_attempt', () => {
      sock.auth = { token: getToken() };
    });

    return () => {
      sock.off('connect', onConnect);
      sock.off('disconnect', onDisconnect);
      sock.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [sessionId]);

  function on(event: string, handler: (data: any) => void) {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }

  return { socket, connected, on };
}
