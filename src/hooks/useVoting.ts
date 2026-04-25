'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

interface AgendaItem {
  id: string;
  number: string;
  type: string;
  title: string;
  description: string;
  authorName: string;
  authorUser?: { id: string; name: string; party: string; initials: string };
  votingType: 'aberta' | 'secreta';
  quorumMinimum: number;
  orderIndex: number;
  status: 'pendente' | 'em_votacao' | 'aprovado' | 'rejeitado' | 'retirado';
  votesYes: number;
  votesNo: number;
  votesAbstain: number;
  votingOpenedAt?: string;
  votingClosedAt?: string;
}

interface VoteCounts { sim: number; nao: number; abstencao: number }

export interface LiveVoteEvent {
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  userParty: string | null;
  userInitials: string | null;
  agendaItemId: string;
  choice: string;
  hash: string;
  counts: VoteCounts;
}

async function fetchVotesForItem(item: AgendaItem): Promise<LiveVoteEvent[]> {
  try {
    const { data } = await api.get(`/voting/item/${item.id}/votes`);
    const counts = { sim: item.votesYes ?? 0, nao: item.votesNo ?? 0, abstencao: item.votesAbstain ?? 0 };
    return (data as any[]).reverse().map(v => ({
      userId: v.userId,
      userName: v.user?.name ?? '',
      userAvatarUrl: v.user?.avatarUrl ?? null,
      userParty: v.user?.party ?? null,
      userInitials: v.user?.initials ?? null,
      agendaItemId: v.agendaItemId,
      choice: item.votingType === 'aberta' ? v.choice : 'secreta',
      hash: v.hash,
      counts,
    }));
  } catch {
    return [];
  }
}

export function useVoting(sessionId: string | null, socket: any) {
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [activeItem, setActiveItem] = useState<AgendaItem | null>(null);
  const [counts, setCounts] = useState<VoteCounts>({ sim: 0, nao: 0, abstencao: 0 });
  const [voteLog, setVoteLog] = useState<LiveVoteEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAgenda = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const [agendaRes, activeRes] = await Promise.all([
        api.get(`/agenda/session/${sessionId}`),
        api.get(`/agenda/session/${sessionId}/active-voting`).catch(() => ({ data: null })),
      ]);

      const items: AgendaItem[] = agendaRes.data;
      setAgenda(items);

      if (activeRes.data) {
        // Votação em andamento — restaura item + votos já registrados
        const item: AgendaItem = activeRes.data;
        setActiveItem(item);
        setCounts({ sim: item.votesYes ?? 0, nao: item.votesNo ?? 0, abstencao: item.votesAbstain ?? 0 });
        const existing = await fetchVotesForItem(item);
        setVoteLog(existing);
      } else {
        // Sem votação ativa — mantém o último item encerrado visível com seus votos
        const lastClosed = items
          .filter(i => (i.status === 'aprovado' || i.status === 'rejeitado') && i.votingClosedAt)
          .sort((a, b) => new Date(b.votingClosedAt!).getTime() - new Date(a.votingClosedAt!).getTime())[0];

        if (lastClosed) {
          setActiveItem(lastClosed);
          setCounts({ sim: lastClosed.votesYes ?? 0, nao: lastClosed.votesNo ?? 0, abstencao: lastClosed.votesAbstain ?? 0 });
          const existing = await fetchVotesForItem(lastClosed);
          setVoteLog(existing);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { loadAgenda(); }, [loadAgenda]);

  // WebSocket listeners
  useEffect(() => {
    if (!socket) return;

    const onVotingOpened = (data: { agendaItem: AgendaItem }) => {
      setActiveItem(data.agendaItem);
      setCounts({ sim: 0, nao: 0, abstencao: 0 });
      setVoteLog([]);
      setAgenda(prev =>
        prev.map(i => i.id === data.agendaItem.id ? { ...i, status: 'em_votacao' } : i),
      );
    };

    const onVoteCast = (data: LiveVoteEvent) => {
      setCounts(data.counts);
      setVoteLog(prev => [data, ...prev].slice(0, 50));
    };

    const onVotingClosed = (data: { agendaItem: AgendaItem; result: string; counts: VoteCounts }) => {
      setActiveItem(data.agendaItem);
      setCounts(data.counts);
      setAgenda(prev =>
        prev.map(i => i.id === data.agendaItem.id ? { ...i, status: data.agendaItem.status } : i),
      );
    };

    socket.on('voting:opened', onVotingOpened);
    socket.on('vote:cast', onVoteCast);
    socket.on('voting:closed', onVotingClosed);

    return () => {
      socket.off('voting:opened', onVotingOpened);
      socket.off('vote:cast', onVoteCast);
      socket.off('voting:closed', onVotingClosed);
    };
  }, [socket]);

  async function openVoting(agendaItemId: string) {
    await api.patch(`/voting/open/${agendaItemId}`);
  }

  async function closeVoting(agendaItemId: string) {
    await api.patch(`/voting/close/${agendaItemId}`);
    // Não limpa activeItem aqui — o evento voting:closed via socket atualiza o estado
    // com o resultado final e mantém o painel visível
  }

  async function castVote(agendaItemId: string, choice: 'sim' | 'nao' | 'abstencao') {
    const res = await api.post('/voting/cast', { agendaItemId, choice });
    return res.data;
  }

  return { agenda, activeItem, counts, voteLog, loading, openVoting, closeVoting, castVote, reload: loadAgenda };
}
