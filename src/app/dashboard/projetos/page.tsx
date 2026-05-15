'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, CheckCircle2, XCircle, ExternalLink, Search, Loader2 } from 'lucide-react';
import api from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';

interface AuthorUser {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
}

interface SessionInfo {
  id: string;
  number: number;
  type: 'ordinaria' | 'extraordinaria' | 'solene' | 'especial';
  date: string;
  startedAt: string | null;
}

interface VotedItem {
  id: string;
  sessionId: string;
  chamberId: string;
  number: string;
  type: string;
  title: string;
  description: string | null;
  pdfUrl: string | null;
  authorName: string;
  authorUser: AuthorUser | null;
  status: 'aprovado' | 'rejeitado';
  votesYes: number | null;
  votesNo: number | null;
  votesAbstain: number | null;
  votingClosedAt: string | null;
  session: SessionInfo | null;
}

const SESSION_TYPE_LABEL: Record<string, string> = {
  ordinaria: 'Ordinária',
  extraordinaria: 'Extraordinária',
  solene: 'Solene',
  especial: 'Especial',
};

export default function ProjetosPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<VotedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<string>('Todos');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!user?.chamberId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/agenda/chamber/${user.chamberId}/voted`);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [user?.chamberId]);

  useEffect(() => { load(); }, [load]);

  // Lista de tipos presentes nos dados (pra montar os filtros)
  const types = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.type) set.add(i.type); });
    return ['Todos', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  // Counts por tipo
  const countsByType = useMemo(() => {
    const m: Record<string, number> = { Todos: items.length };
    items.forEach(i => { m[i.type] = (m[i.type] ?? 0) + 1; });
    return m;
  }, [items]);

  // Filtra por tipo e busca
  const filtered = useMemo(() => {
    let list = items;
    if (activeType !== 'Todos') list = list.filter(i => i.type === activeType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.number.toLowerCase().includes(q) ||
        i.title.toLowerCase().includes(q) ||
        i.authorName.toLowerCase().includes(q) ||
        i.type.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, activeType, search]);

  // Agrupado por tipo pra exibição
  const grouped = useMemo(() => {
    const m = new Map<string, VotedItem[]>();
    filtered.forEach(i => {
      if (!m.has(i.type)) m.set(i.type, []);
      m.get(i.type)!.push(i);
    });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div style={{ padding: '32px 36px 64px', background: '#F5F6F8', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0D1117', letterSpacing: '-0.03em', margin: 0 }}>
          Projetos Votados
        </h2>
        <p style={{ fontSize: 13, color: '#8A94A2', marginTop: 4 }}>
          Histórico de todos os projetos aprovados e rejeitados na câmara.
        </p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 480 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8A94A2' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por número, título ou autor…"
          style={{
            width: '100%', padding: '10px 12px 10px 36px',
            border: '1px solid #E4E7ED', borderRadius: 10,
            fontSize: 13, color: '#0D1117', background: '#fff', outline: 'none',
          }}
        />
      </div>

      {/* Filter chips por tipo */}
      {!loading && items.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {types.map(t => {
            const active = activeType === t;
            return (
              <button
                key={t}
                onClick={() => setActiveType(t)}
                style={{
                  padding: '7px 14px', borderRadius: 999,
                  fontSize: 12, fontWeight: 600,
                  background: active ? '#1447E6' : '#fff',
                  color: active ? '#fff' : '#4B5563',
                  border: `1px solid ${active ? '#1447E6' : '#E4E7ED'}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {t}
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                  background: active ? 'rgba(255,255,255,0.25)' : '#F0F2F5',
                  color: active ? '#fff' : '#8A94A2',
                }}>
                  {countsByType[t] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Conteúdo */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: '#8A94A2' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, padding: 64, textAlign: 'center' }}>
          <FileText size={40} style={{ color: '#D1D5DB', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: '#0D1117', margin: 0 }}>
            {items.length === 0 ? 'Nenhum projeto votado ainda' : 'Nenhum resultado para o filtro'}
          </p>
          <p style={{ fontSize: 13, color: '#8A94A2', marginTop: 6 }}>
            {items.length === 0
              ? 'Projetos aparecerão aqui após serem aprovados ou rejeitados em sessão.'
              : 'Tente outro tipo de projeto ou refine a busca.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {grouped.map(([type, list]) => (
            <div key={type}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#0D1117', letterSpacing: '0.04em', margin: 0, textTransform: 'uppercase' }}>
                  {type}
                </h3>
                <span style={{ fontSize: 11, color: '#8A94A2', fontWeight: 600 }}>
                  {list.length} {list.length === 1 ? 'projeto' : 'projetos'}
                </span>
              </div>
              <div style={{ background: '#fff', border: '1px solid #E4E7ED', borderRadius: 12, overflow: 'hidden' }}>
                {list.map((item, idx) => (
                  <ProjectRow key={item.id} item={item} isLast={idx === list.length - 1} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectRow({ item, isLast }: { item: VotedItem; isLast: boolean }) {
  const aprovado = item.status === 'aprovado';
  const dateStr = item.votingClosedAt
    ? new Date(item.votingClosedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const sessionLabel = item.session
    ? `${item.session.number}ª Sessão ${SESSION_TYPE_LABEL[item.session.type] ?? item.session.type}`
    : 'Sessão desconhecida';

  return (
    <div style={{
      padding: '14px 18px',
      borderBottom: isLast ? 'none' : '1px solid #F0F2F5',
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center',
    }}>
      {/* Esquerda — info */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
            background: '#F0F4FF', color: '#1447E6', letterSpacing: '0.04em',
          }}>
            Nº {item.number}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
            background: aprovado ? '#ECFDF5' : '#FEF2F2',
            color: aprovado ? '#059669' : '#dc2626',
            border: `1px solid ${aprovado ? '#A7F3D0' : '#FECACA'}`,
          }}>
            {aprovado ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
            {aprovado ? 'APROVADO' : 'REJEITADO'}
          </span>
          <span style={{ fontSize: 11, color: '#8A94A2', fontWeight: 600 }}>{dateStr}</span>
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#0D1117', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          {item.title}
        </p>
        <p style={{ fontSize: 12, color: '#8A94A2', margin: 0 }}>
          {sessionLabel} · Autor: <span style={{ color: '#4B5563', fontWeight: 600 }}>{item.authorName}</span>
        </p>
      </div>

      {/* Direita — placar + PDF */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <ScoreBox label="Sim" value={item.votesYes ?? 0} color="#059669" bg="#ECFDF5" />
        <ScoreBox label="Não" value={item.votesNo ?? 0} color="#dc2626" bg="#FEF2F2" />
        <ScoreBox label="Abst." value={item.votesAbstain ?? 0} color="#8A94A2" bg="#F5F6F8" />
        {item.pdfUrl && (
          <a
            href={item.pdfUrl.startsWith('http') ? item.pdfUrl : `${API_BASE}${item.pdfUrl}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 8,
              background: '#1447E6', color: '#fff',
              fontSize: 12, fontWeight: 600, textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            <FileText size={13} /> PDF
            <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

function ScoreBox({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{
      minWidth: 52, padding: '6px 10px', borderRadius: 8,
      background: bg, textAlign: 'center',
    }}>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#8A94A2', marginTop: 2, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}
