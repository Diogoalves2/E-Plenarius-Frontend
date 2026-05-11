'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, Plus, ArrowRight, MapPin, CheckCircle2, XCircle } from 'lucide-react';
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

  const total  = chambers.length;
  const active = chambers.filter(c => c.isActive).length;
  const recent = chambers.slice(0, 6);

  return (
    <div className="p-8 max-w-6xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h2 className="font-tight font-bold text-3xl" style={{ color: '#0B1220', letterSpacing: '-0.03em' }}>
            Visão Geral
          </h2>
          <p className="text-sm mt-1.5" style={{ color: '#8A94A2' }}>
            Resumo do sistema E-Plenarius
          </p>
        </div>
        <Link
          href="/superadmin/camaras"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, oklch(0.52 0.16 255), oklch(0.45 0.18 270))', boxShadow: '0 4px 14px rgba(82,130,255,0.35)' }}
        >
          <Plus size={16} strokeWidth={2.5} />
          Nova Câmara
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-5 mb-10">
        <StatCard
          label="Total de Câmaras"
          value={loading ? '—' : String(total)}
          color="#5282FF"
          gradient="linear-gradient(135deg, rgba(82,130,255,0.12), rgba(82,130,255,0.04))"
          icon={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5282FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V9h6v12"/>
            </svg>
          }
        />
        <StatCard
          label="Câmaras Ativas"
          value={loading ? '—' : String(active)}
          color="#10b981"
          gradient="linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))"
          icon={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          }
        />
      </div>

      {/* Chambers grid */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-tight font-semibold text-lg" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>
            Câmaras recentes
          </h3>
          <Link
            href="/superadmin/camaras"
            className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-70"
            style={{ color: 'oklch(0.52 0.16 255)' }}
          >
            Ver todas <ArrowRight size={15} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: 'rgba(15,23,42,0.05)' }} />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="rounded-2xl py-16 flex flex-col items-center gap-4 bg-white"
               style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                 style={{ background: 'rgba(82,130,255,0.08)' }}>
              <Building2 size={28} style={{ color: 'oklch(0.52 0.16 255)' }} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm mb-1" style={{ color: '#0B1220' }}>Nenhuma câmara cadastrada</p>
              <p className="text-sm" style={{ color: '#8A94A2' }}>Comece criando a primeira câmara municipal</p>
            </div>
            <Link
              href="/superadmin/camaras"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white"
              style={{ background: 'oklch(0.52 0.16 255)' }}
            >
              <Plus size={15} /> Cadastrar agora
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recent.map(c => (
              <ChamberCard key={c.id} chamber={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, gradient, icon }: {
  label: string; value: string; color: string; gradient: string; icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-6 bg-white flex items-center gap-5"
         style={{ border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
           style={{ background: gradient, border: `1px solid ${color}22` }}>
        {icon}
      </div>
      <div>
        <p className="font-tight font-bold text-4xl" style={{ color: '#0B1220', letterSpacing: '-0.03em' }}>{value}</p>
        <p className="text-sm mt-1" style={{ color: '#8A94A2' }}>{label}</p>
      </div>
    </div>
  );
}

function ChamberCard({ chamber: c }: { chamber: Chamber }) {
  return (
    <Link href={`/superadmin/camaras/${c.id}/vereadores`}
          className="group block rounded-2xl bg-white p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
          style={{ border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>

      {/* Top row: logo + status */}
      <div className="flex items-start justify-between mb-4">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
             style={{ background: 'rgba(82,130,255,0.07)', border: '1px solid rgba(82,130,255,0.15)' }}>
          {c.logoUrl
            ? <img src={`${API_BASE}${c.logoUrl}`} alt={c.name} className="w-full h-full object-contain p-1.5" />
            : <Building2 size={26} style={{ color: 'oklch(0.52 0.16 255)' }} />}
        </div>

        <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                background: c.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(15,23,42,0.06)',
                color: c.isActive ? '#059669' : '#8A94A2',
                border: `1px solid ${c.isActive ? 'rgba(16,185,129,0.2)' : 'rgba(15,23,42,0.1)'}`,
              }}>
          {c.isActive
            ? <CheckCircle2 size={12} strokeWidth={2.5} />
            : <XCircle size={12} strokeWidth={2.5} />}
          {c.isActive ? 'Ativa' : 'Inativa'}
        </span>
      </div>

      {/* Name */}
      <p className="font-tight font-bold text-base leading-snug mb-1.5 group-hover:text-blue-600 transition-colors"
         style={{ color: '#0B1220', letterSpacing: '-0.01em' }}>
        {c.name}
      </p>

      {/* City / State */}
      <div className="flex items-center gap-1.5 text-sm" style={{ color: '#8A94A2' }}>
        <MapPin size={13} />
        {c.city}, {c.state}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 flex items-center justify-between"
           style={{ borderTop: '1px solid rgba(15,23,42,0.06)' }}>
        <span className="text-xs" style={{ color: '#B0B8C4' }}>
          Desde {new Date(c.createdAt).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
        </span>
        <span className="text-xs font-semibold flex items-center gap-1 transition-colors group-hover:text-blue-500"
              style={{ color: 'oklch(0.52 0.16 255)' }}>
          Gerenciar <ArrowRight size={12} />
        </span>
      </div>
    </Link>
  );
}
