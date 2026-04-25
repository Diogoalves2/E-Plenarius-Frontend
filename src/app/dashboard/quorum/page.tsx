'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Users, CheckCircle2, Loader2, AlertCircle, Bell } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import api from '@/lib/api';

interface Vereador { id: string; name: string; initials: string; party: string | null; role: string; avatarUrl?: string | null; }
interface Presence { userId: string; }
interface ActiveSession { id: string; number: number; type: string; status: string; }

export default function QuorumPage() {
  const { user } = useAuth();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [vereadores, setVereadores] = useState<Vereador[]>([]);
  const [presences, setPresences] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [quorumAlert, setQuorumAlert] = useState(false);
  const { on, socket } = useSocket(session?.id ?? null);

  const reload = useCallback(async () => {
    if (!user?.chamberId) return;
    setLoading(true);
    try {
      const [membersRes] = await Promise.all([api.get(`/users/chamber/${user.chamberId}`)]);
      setVereadores(membersRes.data.filter((v: any) => v.isActive));

      try {
        const { data: sess } = await api.get(`/sessions/active/${user.chamberId}`);
        setSession(sess);
        const { data: pres } = await api.get(`/sessions/${sess.id}/presences`);
        const ids = (pres as any[]).map((p: any) => p.userId) as string[];
        setPresences(new Set<string>(ids));
      } catch {
        setSession(null);
        setPresences(new Set());
      }
    } finally { setLoading(false); }
  }, [user?.chamberId]);

  useEffect(() => { reload(); }, [reload]);

  // Real-time quorum updates via WebSocket
  useEffect(() => {
    if (!socket) return;
    const off = on('quorum:updated', ({ presentCount }: { sessionId: string; presentCount: number }) => {
      // Re-fetch presences to get updated user list (we only receive count, need to know WHO)
      if (!session) return;
      api.get(`/sessions/${session.id}/presences`).then(({ data }) => {
        const ids = (data as any[]).map((p: any) => p.userId) as string[];
        setPresences(new Set<string>(ids));
        const total = vereadores.length;
        const quorumMin = Math.floor(total / 2) + 1;
        if (presentCount < quorumMin && total > 0) setQuorumAlert(true);
        else setQuorumAlert(false);
      }).catch(() => {});
    });
    return () => { off(); };
  }, [socket, on, session, vereadores.length]);

  async function confirmMyPresence() {
    if (!session || !user?.id) return;
    setConfirming(true);
    try {
      await api.post(`/sessions/${session.id}/presence`);
      setPresences(prev => { const next = new Set<string>(Array.from(prev)); next.add(user.id); return next; });
    } finally { setConfirming(false); }
  }

  const presentCount = presences.size;
  const total = vereadores.length;
  const quorumPct = total > 0 ? Math.round((presentCount / total) * 100) : 0;
  const myPresenceConfirmed = user?.id ? presences.has(user.id) : false;

  if (loading) return <div className="p-8"><Spinner /></div>;

  if (!session) return (
    <div className="p-8">
      <h2 className="font-tight font-semibold text-2xl mb-2" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>Quórum</h2>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle size={36} style={{ color: '#D1D5DB' }} />
        <p className="mt-4 font-semibold" style={{ color: '#0B1220' }}>Nenhuma sessão em andamento</p>
        <p className="text-sm mt-1" style={{ color: '#8A94A2' }}>Inicie uma sessão para gerenciar o quórum.</p>
      </div>
    </div>
  );

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="font-tight font-semibold text-2xl" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>Quórum</h2>
        <p className="text-sm mt-1" style={{ color: '#8A94A2' }}>{session.number}ª Sessão em andamento</p>
      </div>

      {/* Quorum alert banner */}
      {quorumAlert && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4 text-sm font-semibold"
             style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>
          <Bell size={16} className="flex-shrink-0" />
          Atenção: quórum insuficiente para deliberação. Aguarde mais presenças.
        </div>
      )}

      {/* Stats card */}
      <div className="bg-white rounded-xl p-5 mb-6 flex items-center gap-6" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
        <div className="text-center">
          <p className="font-tight font-semibold text-4xl" style={{ color: '#0B1220', letterSpacing: '-0.03em' }}>{presentCount}</p>
          <p className="text-xs mt-1" style={{ color: '#8A94A2' }}>presentes</p>
        </div>
        <div className="text-center">
          <p className="font-tight font-semibold text-4xl" style={{ color: '#D1D5DB', letterSpacing: '-0.03em' }}>{total - presentCount}</p>
          <p className="text-xs mt-1" style={{ color: '#8A94A2' }}>ausentes</p>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: '#4B5563' }}>Quórum</span>
            <span className="text-xs font-mono-jet font-semibold" style={{ color: quorumPct >= 50 ? '#059669' : '#b45309' }}>{presentCount}/{total}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,0.06)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${quorumPct}%`, background: quorumPct >= 50 ? '#10b981' : '#f59e0b' }} />
          </div>
          <p className="text-xs mt-1" style={{ color: quorumPct >= 50 ? '#059669' : '#b45309' }}>
            {quorumPct >= 50 ? `Quórum atingido (${quorumPct}%)` : `Quórum insuficiente (${quorumPct}%)`}
          </p>
        </div>
      </div>

      {/* Confirm presence button */}
      {!myPresenceConfirmed && (
        <button onClick={confirmMyPresence} disabled={confirming}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white mb-6 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                style={{ background: 'oklch(0.52 0.16 255)', opacity: confirming ? 0.7 : 1 }}>
          {confirming ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Confirmar Minha Presença
        </button>
      )}
      {myPresenceConfirmed && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-6 text-sm font-semibold"
             style={{ background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }}>
          <CheckCircle2 size={16} /> Sua presença está confirmada
        </div>
      )}

      {/* Vereadores grid */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {vereadores.map((v) => {
          const present = presences.has(v.id);
          return (
            <div key={v.id} className="bg-white rounded-xl p-4 flex items-center gap-3 transition-opacity"
                 style={{ border: '1px solid rgba(15,23,42,0.08)', opacity: present ? 1 : 0.45 }}>
              <MemberAvatar v={v} size={44} present={present} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: '#0B1220' }}>{v.name}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: '#8A94A2' }}>
                  {v.party}{v.party && v.role ? ' · ' : ''}{v.role === 'presidente' ? 'Presidente' : v.role === 'secretaria' ? 'Secretaria' : 'Vereador'}
                </p>
              </div>
              <span className="text-[10px] font-mono-jet font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: present ? 'rgba(16,185,129,0.1)' : 'rgba(15,23,42,0.06)', color: present ? '#059669' : '#8A94A2' }}>
                {present ? 'PRES' : 'AUS'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';
const AVATAR_PALETTE = [
  { a: '#E0E7FF', b: '#C7D2FE', fg: '#3730A3' }, { a: '#FCE7F3', b: '#FBCFE8', fg: '#9D174D' },
  { a: '#FEF3C7', b: '#FDE68A', fg: '#78350F' }, { a: '#DCFCE7', b: '#BBF7D0', fg: '#14532D' },
  { a: '#E0F2FE', b: '#BAE6FD', fg: '#075985' }, { a: '#F3E8FF', b: '#E9D5FF', fg: '#581C87' },
  { a: '#FFE4E6', b: '#FECDD3', fg: '#881337' }, { a: '#ECFCCB', b: '#D9F99D', fg: '#365314' },
  { a: '#E2E8F0', b: '#CBD5E1', fg: '#334155' },
];
function avatarColor(name: string) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
function MemberAvatar({ v, size = 44, present }: { v: Vereador; size?: number; present: boolean }) {
  const c = avatarColor(v.name);
  if ((v as any).avatarUrl) return (
    <div style={{ width: size, height: size, borderRadius: 999, overflow: 'hidden', flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${API_BASE}${(v as any).avatarUrl}`} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, overflow: 'hidden', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `repeating-linear-gradient(45deg, ${c.a} 0 4px, ${c.b} 4px 8px)`,
    }}>
      <div style={{
        fontFamily: 'Inter Tight, sans-serif', fontWeight: 700,
        fontSize: size * 0.34, color: c.fg, letterSpacing: -0.4,
        background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(3px)',
        padding: `${size * 0.04}px ${size * 0.1}px`, borderRadius: 4,
      }}>{v.initials}</div>
    </div>
  );
}
function Spinner() { return <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin" style={{ color: '#8A94A2' }} /></div>; }
