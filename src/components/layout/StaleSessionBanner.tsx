'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
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
    <div className="flex items-start sm:items-center gap-3 px-4 sm:px-6 py-2.5 text-sm"
         style={{ background: '#FFFBEB', borderBottom: '1px solid #FDE68A', color: '#78350F' }}>
      <AlertTriangle size={17} className="flex-shrink-0 mt-0.5 sm:mt-0" style={{ color: '#D97706' }} />
      <span className="flex-1">
        <b>Sessão aberta desde {since.toLocaleDateString('pt-BR')}.</b>{' '}
        Enquanto estiver aberta, aceita presença e votos. Se ela já terminou, encerre-a. Sessões sem atividade por 12 h são encerradas automaticamente.
      </span>
      <Link href="/dashboard/sessoes" className="flex-shrink-0 font-semibold underline underline-offset-2" style={{ color: '#92400E' }}>
        Ir para Sessões
      </Link>
    </div>
  );
}
