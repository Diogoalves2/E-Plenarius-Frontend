'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, Plus, ChevronRight } from 'lucide-react';
import api from '@/lib/api';

interface Chamber {
  id: string;
  name: string;
  city: string;
  state: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';

export default function SuperadminOverviewPage() {
  const [chambers, setChambers] = useState<Chamber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/chambers').then(({ data }) => setChambers(data)).finally(() => setLoading(false));
  }, []);

  const total = chambers.length;
  const active = chambers.filter(c => c.isActive).length;
  const recent = chambers.slice(0, 4);

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-tight font-semibold text-2xl" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>
            Visão Geral
          </h2>
          <p className="text-sm mt-1" style={{ color: '#8A94A2' }}>Resumo do sistema E-Plenarius</p>
        </div>
        <Link href="/superadmin/camaras"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90"
              style={{ background: 'oklch(0.52 0.16 255)' }}>
          <Plus size={15} />
          Nova Câmara
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard label="Total de Câmaras" value={loading ? '—' : String(total)} icon={<Building2 size={18} style={{ color: 'oklch(0.52 0.16 255)' }} />} />
        <StatCard label="Câmaras Ativas" value={loading ? '—' : String(active)}
          icon={<span className="w-2 h-2 rounded-full inline-block animate-pulse-dot" style={{ background: '#10b981' }} />} />
      </div>

      {/* Recent chambers */}
      <div className="bg-white rounded-xl" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
        <div className="flex items-center justify-between px-5 py-4"
             style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
          <h3 className="font-semibold text-sm" style={{ color: '#0B1220' }}>Câmaras recentes</h3>
          <Link href="/superadmin/camaras"
                className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70"
                style={{ color: 'oklch(0.52 0.16 255)' }}>
            Ver todas <ChevronRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-sm text-center" style={{ color: '#8A94A2' }}>Carregando…</div>
        ) : recent.length === 0 ? (
          <div className="px-5 py-8 text-sm text-center" style={{ color: '#8A94A2' }}>
            Nenhuma câmara cadastrada ainda.{' '}
            <Link href="/superadmin/camaras" className="font-semibold" style={{ color: 'oklch(0.52 0.16 255)' }}>
              Cadastrar agora
            </Link>
          </div>
        ) : (
          <div>
            {recent.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3"
                   style={{ borderBottom: i < recent.length - 1 ? '1px solid rgba(15,23,42,0.05)' : 'none' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
                     style={{ background: 'rgba(82,130,255,0.08)' }}>
                  {c.logoUrl
                    ? <img src={`${API_BASE}${c.logoUrl}`} alt={c.name} className="w-full h-full object-contain p-0.5" />
                    : <Building2 size={14} style={{ color: 'oklch(0.52 0.16 255)' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#0B1220' }}>{c.name}</p>
                  <p className="text-xs" style={{ color: '#8A94A2' }}>{c.city} — {c.state}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded font-mono-jet font-semibold flex-shrink-0"
                      style={{ background: c.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(15,23,42,0.06)', color: c.isActive ? '#059669' : '#8A94A2' }}>
                  {c.isActive ? 'ATIVA' : 'INATIVA'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl px-5 py-4 flex items-center gap-4"
         style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
           style={{ background: 'rgba(82,130,255,0.08)' }}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-tight font-semibold" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>{value}</p>
        <p className="text-xs mt-0.5" style={{ color: '#8A94A2' }}>{label}</p>
      </div>
    </div>
  );
}
