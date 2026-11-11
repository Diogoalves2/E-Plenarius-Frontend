'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useChamber } from '@/contexts/ChamberContext';

/**
 * Sessão iniciada antes de hoje e ainda aberta: provavelmente esquecida.
 * Enquanto aberta, aceita presença e voto — o aviso pede para encerrar.
 */
export function StaleSessionBanner() {
  const { user } = useAuth();
  const chamber = useChamber();
  if (!chamber?.live || !chamber.liveSince || user?.role === 'vereador') return null;
  const since = new Date(chamber.liveSince);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (since >= today) return null;

  return (
    <div className="flex items-center gap-3 px-4 sm:px-8 h-10 text-[13px] flex-shrink-0"
         style={{ background: '#FFFDF7', borderBottom: '1px solid rgba(217,119,6,0.14)' }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#F59E0B' }} />
      <span className="min-w-0 truncate" style={{ color: '#475569' }}>
        <span className="font-semibold" style={{ color: '#0B1220' }}>
          Sessão aberta desde {since.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
        </span>
        <span className="hidden md:inline"> · encerra sozinha após 12 h sem atividade</span>
      </span>
      <Link href="/dashboard/sessoes"
            className="ml-auto flex items-center gap-1 font-semibold flex-shrink-0 transition-opacity hover:opacity-70"
            style={{ color: '#B45309' }}>
        Encerrar <ArrowRight size={13} />
      </Link>
    </div>
  );
}
