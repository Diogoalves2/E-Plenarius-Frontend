'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useChamberRules } from '@/lib/legislativo';

/** Roteiro da sessão: mostra a fase atual; o presidente avança/volta (registrado na ata). */
export function PhaseBar({ sessionId, chamberId, socket, canControl, dark = false }: {
  sessionId: string; chamberId: string; socket: any; canControl: boolean; dark?: boolean;
}) {
  const { rules } = useChamberRules(chamberId);
  const [phase, setPhase] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/sessions/${sessionId}`).then(r => setPhase(r.data?.phase ?? null)).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    if (!socket) return;
    const onPhase = (d: { sessionId: string; phase: string | null }) => { if (d.sessionId === sessionId) setPhase(d.phase); };
    socket.on('session:phase', onPhase);
    return () => { socket.off('session:phase', onPhase); };
  }, [socket, sessionId]);

  const phases = rules?.sessionPhases ?? [];
  if (!phases.length) return null;
  const idx = phases.findIndex(p => p.key === phase);

  async function go(key: string) {
    if (!canControl || busy) return;
    setBusy(true); setError('');
    try {
      const { data } = await api.patch(`/sessions/${sessionId}/phase`, { phase: key });
      setPhase(data.phase);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erro ao mudar fase');
    } finally { setBusy(false); }
  }

  const fg = dark ? '#E9EDF2' : '#0B1220';
  const muted = dark ? '#5B636D' : '#8A94A2';

  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: dark ? 'rgba(255,255,255,0.03)' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'}` }}>
      <div className="flex items-center gap-3">
        <span className="font-mono-jet text-[10px] font-semibold flex-shrink-0" style={{ color: muted, letterSpacing: '0.08em' }}>ROTEIRO</span>
        {canControl && (
          <button onClick={() => idx > 0 && go(phases[idx - 1].key)} disabled={idx <= 0 || busy} title="Fase anterior"
                  className="rounded-lg p-1.5 disabled:opacity-30" style={{ border: '1px solid rgba(15,23,42,0.1)', color: fg }}>
            <ChevronLeft size={14} />
          </button>
        )}
        <div className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0">
          {phases.map((p, i) => {
            const current = i === idx, done = idx >= 0 && i < idx;
            return (
              <button key={p.key} onClick={() => go(p.key)} disabled={!canControl || busy}
                      className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                      style={{
                        background: current ? '#1447E6' : done ? (dark ? 'rgba(255,255,255,0.06)' : 'rgba(20,71,230,0.06)') : 'transparent',
                        color: current ? '#fff' : done ? (dark ? '#9AA4B2' : '#1447E6') : muted,
                        border: current ? '1px solid #1447E6' : `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'}`,
                        cursor: canControl ? 'pointer' : 'default',
                      }}>
                {p.label}
              </button>
            );
          })}
        </div>
        {canControl && (
          <button onClick={() => idx < phases.length - 1 && go(phases[idx + 1].key)} disabled={idx >= phases.length - 1 || busy}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-30 flex-shrink-0"
                  style={{ background: '#1447E6' }}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <>Avançar <ChevronRight size={13} /></>}
          </button>
        )}
      </div>
      {error && <p className="text-xs mt-2" style={{ color: '#dc2626' }}>{error}</p>}
    </div>
  );
}
