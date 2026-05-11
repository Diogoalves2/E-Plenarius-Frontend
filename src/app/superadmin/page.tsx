'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, ArrowRight, MapPin, Users, Building2, Activity } from 'lucide-react';
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
const BLUE = '#1447E6';

export default function SuperadminOverviewPage() {
  const [chambers, setChambers] = useState<Chamber[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.get('/chambers').then(({ data }) => setChambers(data)).finally(() => setLoading(false));
  }, []);

  const total    = chambers.length;
  const active   = chambers.filter(c => c.isActive).length;
  const inactive = total - active;
  const recent   = chambers.slice(0, 6);

  return (
    <div style={{ background: '#F5F6F8', minHeight: '100%', padding: '32px 36px 64px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0D1117', letterSpacing: '-0.03em', margin: 0, fontFamily: '"Inter Tight","Inter",sans-serif' }}>
            Visão Geral
          </h2>
          <p style={{ fontSize: 13, color: '#8A94A2', marginTop: 3, letterSpacing: '-0.01em' }}>
            Resumo do sistema E-Plenarius
          </p>
        </div>
        <Link href="/superadmin/camaras" style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '9px 18px', borderRadius: 8,
          background: BLUE, color: '#fff',
          fontWeight: 600, fontSize: 13,
          textDecoration: 'none', letterSpacing: '-0.01em',
        }}>
          <Plus size={14} strokeWidth={2.5} />
          Nova Câmara
        </Link>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard
          label="Total de Câmaras"
          value={loading ? '—' : String(total)}
          sub="cadastradas no sistema"
          color={BLUE}
          icon={<Building2 size={20} color={BLUE} strokeWidth={1.8} />}
        />
        <StatCard
          label="Câmaras Ativas"
          value={loading ? '—' : String(active)}
          sub={active > 0 ? 'em operação' : 'nenhuma ativa'}
          color="#059669"
          icon={<Activity size={20} color="#059669" strokeWidth={1.8} />}
          dot
        />
        <StatCard
          label="Câmaras Inativas"
          value={loading ? '—' : String(inactive)}
          sub="fora de operação"
          color="#8A94A2"
          icon={<Users size={20} color="#8A94A2" strokeWidth={1.8} />}
        />
      </div>

      {/* ── Chambers table ── */}
      <div style={{ background: '#fff', border: '1px solid #E4E7ED', borderRadius: 10, overflow: 'hidden' }}>

        {/* Table header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid #F0F2F5',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0D1117', letterSpacing: '-0.02em', fontFamily: '"Inter Tight","Inter",sans-serif' }}>
              Câmaras recentes
            </span>
            {!loading && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#8A94A2',
                background: '#F5F6F8', border: '1px solid #E4E7ED',
                padding: '2px 8px', borderRadius: 5,
              }}>{recent.length}</span>
            )}
          </div>
          <Link href="/superadmin/camaras" style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12, fontWeight: 600, color: BLUE,
            textDecoration: 'none',
          }}>
            Ver todas <ArrowRight size={13} />
          </Link>
        </div>

        {/* Column labels */}
        {!loading && recent.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 120px 100px',
            padding: '10px 20px', borderBottom: '1px solid #F0F2F5',
          }}>
            {['CÂMARA', 'LOCALIZAÇÃO', 'CADASTRO', 'STATUS'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: '#B0B8C4', letterSpacing: '0.08em' }}>{h}</span>
            ))}
          </div>
        )}

        {/* Rows */}
        {loading ? (
          <div style={{ padding: '32px 20px' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{
                height: 20, borderRadius: 6, marginBottom: 14,
                background: '#F5F6F8',
                animation: 'pulse 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.1}s`,
              }} />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState />
        ) : (
          recent.map((c, i) => (
            <Link
              key={c.id}
              href={`/superadmin/camaras/${c.id}/vereadores`}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 120px 100px',
                alignItems: 'center',
                padding: '14px 20px',
                borderBottom: i < recent.length - 1 ? '1px solid #F5F6F8' : 'none',
                textDecoration: 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFD')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Name + logo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: '#F0F4FF', border: '1px solid #DBEAFE',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}>
                  {c.logoUrl
                    ? <img src={`${API_BASE}${c.logoUrl}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                    : <Building2 size={16} color={BLUE} strokeWidth={1.8} />}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#0D1117', letterSpacing: '-0.01em', margin: 0 }}>{c.name}</p>
                </div>
              </div>

              {/* City */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#8A94A2', fontSize: 12 }}>
                <MapPin size={11} />
                {c.city}, {c.state}
              </div>

              {/* Date */}
              <span style={{ fontSize: 12, color: '#8A94A2' }}>
                {new Date(c.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>

              {/* Status */}
              <div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 600,
                  padding: '4px 10px', borderRadius: 6,
                  background: c.isActive ? '#ECFDF5' : '#F5F6F8',
                  color: c.isActive ? '#059669' : '#8A94A2',
                  border: `1px solid ${c.isActive ? '#A7F3D0' : '#E4E7ED'}`,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: c.isActive ? '#059669' : '#CBD5E1',
                    flexShrink: 0,
                  }} />
                  {c.isActive ? 'Ativa' : 'Inativa'}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
    </div>
  );
}

function StatCard({ label, value, sub, color, icon, dot }: {
  label: string; value: string; sub: string;
  color: string; icon: React.ReactNode; dot?: boolean;
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E4E7ED', borderRadius: 10,
      padding: '20px 22px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 8,
          background: `${color}10`, border: `1px solid ${color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        {dot && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '0.06em' }}>AO VIVO</span>
          </div>
        )}
      </div>
      <p style={{ fontSize: 32, fontWeight: 800, color: '#0D1117', letterSpacing: '-0.04em', margin: '0 0 4px', fontFamily: '"Inter Tight","Inter",sans-serif', lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#0D1117', margin: '0 0 2px', letterSpacing: '-0.01em' }}>{label}</p>
      <p style={{ fontSize: 11, color: '#B0B8C4', margin: 0 }}>{sub}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ padding: '56px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
      <div style={{ width: 52, height: 52, borderRadius: 10, background: '#F0F4FF', border: '1px solid #DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Building2 size={24} color={BLUE} strokeWidth={1.6} />
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#0D1117', margin: '0 0 4px' }}>Nenhuma câmara cadastrada</p>
        <p style={{ fontSize: 13, color: '#8A94A2', margin: 0 }}>Comece criando a primeira câmara municipal</p>
      </div>
      <Link href="/superadmin/camaras" style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 8,
        background: BLUE, color: '#fff',
        fontWeight: 600, fontSize: 13, textDecoration: 'none',
      }}>
        <Plus size={13} strokeWidth={2.5} /> Cadastrar agora
      </Link>
    </div>
  );
}
