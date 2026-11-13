'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Building2, Radio, AlertTriangle, Info, CheckCircle2, ShieldCheck, ShieldAlert,
  ChevronRight, Server, Database, Fingerprint, Vote, RefreshCw, MapPin,
} from 'lucide-react';
import api from '@/lib/api';
import { DEFAULT_PHASES } from '@/lib/legislativo';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ?? 'http://localhost:3001';
const BLUE = '#1447E6';
const INK = '#0B1220';
const MUTED = '#64748B';
const SOFT = '#94A3B8';
const LINE = 'rgba(15,23,42,0.08)';

interface Leader { name: string; role: 'presidente' | 'vice_presidente'; mfa: boolean; lastLoginAt: string | null }
interface ChamberRow {
  id: string; name: string; city: string; state: string; logoUrl: string | null; isActive: boolean; createdAt: string;
  members: number; tablets: number; tabletsPending: number; sessionsDone: number; lastSessionAt: string | null;
  itemsVoted: number; votes: number; leaders: Leader[]; live: boolean;
}
interface LiveSession {
  id: string; chamberId: string; chamberName: string; chamberLogoUrl: string | null; members: number;
  number: number; type: string; phase: string | null; startedAt: string | null; present: number;
  votingNumber: string | null; votingTitle: string | null;
}
interface Alert { level: 'warning' | 'info'; kind: string; chamberId: string; chamberName: string; message: string }
interface Overview {
  generatedAt: string;
  system: {
    startedAt: string; dbSizeBytes: number | null; lastCheckpointAt: string | null;
    totals: { chambers: number; activeChambers: number; users: number; sessions: number; itemsVoted: number; votes: number; auditRecords: number };
  };
  live: LiveSession[];
  alerts: Alert[];
  chambers: ChamberRow[];
}

const TYPE_LABEL: Record<string, string> = { ordinaria: 'Ordinária', extraordinaria: 'Extraordinária', solene: 'Solene', especial: 'Especial' };
const nf = (n: number) => n.toLocaleString('pt-BR');
const logo = (p: string | null) => (p ? (p.startsWith('http') ? p : `${API_BASE}${p}`) : null);

function ago(iso: string | null, now: number) {
  if (!iso) return '—';
  const m = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h${m % 60 ? ` ${m % 60} min` : ''}`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} dia${d > 1 ? 's' : ''}`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function bytes(n: number | null) {
  if (n == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${u[i]}`;
}

export default function SuperadminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get<Overview>('/chambers/admin/overview');
      setData(data); setError(false);
    } catch { setError(true); }
    finally { setRefreshing(false); setNow(Date.now()); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => { clearInterval(id); clearInterval(tick); };
  }, [load]);

  const t = data?.system.totals;
  const warnings = data?.alerts.filter(a => a.level === 'warning').length ?? 0;

  return (
    <div className="min-h-full px-6 py-8 lg:px-9" style={{ background: '#F5F6F8' }}>
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
        <div>
          <h2 className="font-tight font-bold text-[22px]" style={{ color: INK, letterSpacing: '-0.03em' }}>Visão geral</h2>
          <p className="text-[13px] mt-1 flex items-center gap-2" style={{ color: SOFT }}>
            {data ? <>Atualizado às {new Date(data.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · a cada 30 s</> : 'Carregando…'}
            <button onClick={load} aria-label="Atualizar agora" title="Atualizar agora" className="p-1 rounded-md hover:bg-white transition-colors">
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </p>
        </div>
        <Link href="/superadmin/camaras?new=1"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors bg-[#1447E6] hover:bg-[#103CC4]">
          <Plus size={14} strokeWidth={2.5} /> Nova câmara
        </Link>
      </div>

      {error && !data && (
        <div className="rounded-xl px-4 py-3 mb-6 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}>
          Não foi possível carregar a visão geral. Verifique se a API está no ar.
        </div>
      )}

      {/* Indicadores */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5 mb-6">
        <Kpi icon={<Building2 size={18} />} color={BLUE} label="Câmaras ativas"
             value={t ? `${t.activeChambers}` : '—'} sub={t ? `de ${t.chambers} cadastrada${t.chambers === 1 ? '' : 's'}` : ''} />
        <Kpi icon={<Radio size={18} />} color="#059669" label="Ao vivo agora"
             value={data ? String(data.live.length) : '—'} sub={data?.live.length ? 'sessões em andamento' : 'nenhuma sessão aberta'} pulse={!!data?.live.length} />
        <Kpi icon={<AlertTriangle size={18} />} color={warnings ? '#D97706' : SOFT} label="Pendências"
             value={data ? String(data.alerts.length) : '—'} sub={data ? (warnings ? `${warnings} pedem atenção` : 'nada urgente') : ''} />
        <Kpi icon={<Vote size={18} />} color="#7C3AED" label="Votos registrados"
             value={t ? nf(t.votes) : '—'} sub={t ? `${nf(t.itemsVoted)} matérias votadas` : ''} />
      </div>

      {/* Ao vivo + pendências */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4 mb-6">
        <Card title="Ao vivo agora" count={data?.live.length}
              icon={<span className="relative flex w-2 h-2"><span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: '#10B981' }} /><span className="relative w-2 h-2 rounded-full" style={{ background: '#10B981' }} /></span>}>
          {!data ? <Skeleton rows={2} /> : data.live.length === 0 ? (
            <Empty icon={<Radio size={20} />} text="Nenhuma sessão em andamento." />
          ) : (
            <div className="flex flex-col">
              {data.live.map((s, i) => {
                const phase = s.phase ? DEFAULT_PHASES.find(p => p.key === s.phase)?.label : null;
                return (
                  <div key={s.id} className="flex items-center gap-3.5 px-5 py-4" style={{ borderTop: i ? `1px solid ${LINE}` : undefined }}>
                    <ChamberLogo src={logo(s.chamberLogoUrl)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: INK }}>{s.chamberName}</p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: MUTED }}>
                        {s.number}ª Sessão {TYPE_LABEL[s.type] ?? s.type}{phase ? ` · ${phase}` : ''} · iniciada {ago(s.startedAt, now)}
                      </p>
                      {s.votingNumber && (
                        <span className="inline-flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-md max-w-full"
                              style={{ background: 'rgba(20,71,230,0.07)', color: BLUE }}>
                          <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: BLUE }} />
                          <span className="truncate">Votando {s.votingNumber}{s.votingTitle ? ` — ${s.votingTitle}` : ''}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-tight font-bold text-lg leading-none" style={{ color: INK }}>{s.present}<span className="text-sm font-semibold" style={{ color: SOFT }}>/{s.members}</span></p>
                      <p className="text-[11px] mt-1" style={{ color: SOFT }}>presentes</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Pendências" count={data?.alerts.length}>
          {!data ? <Skeleton rows={3} /> : data.alerts.length === 0 ? (
            <Empty icon={<CheckCircle2 size={20} />} text="Tudo em ordem." tone="#059669" />
          ) : (
            <div className="flex flex-col max-h-[320px] overflow-y-auto">
              {data.alerts.map((a, i) => (
                <Link key={i} href={`/superadmin/camaras/${a.chamberId}/vereadores`}
                      className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
                      style={{ borderTop: i ? `1px solid ${LINE}` : undefined }}>
                  {a.level === 'warning'
                    ? <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#D97706' }} />
                    : <Info size={15} className="flex-shrink-0 mt-0.5" style={{ color: BLUE }} />}
                  <div className="min-w-0">
                    <p className="text-[13px] leading-snug" style={{ color: INK }}>{a.message}</p>
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: SOFT }}>{a.chamberName}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Câmaras */}
      <Card title="Câmaras" count={data?.chambers.length}
            action={<Link href="/superadmin/camaras" className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: BLUE }}>Gerenciar <ChevronRight size={13} /></Link>}>
        {!data ? <Skeleton rows={3} /> : data.chambers.length === 0 ? (
          <Empty icon={<Building2 size={20} />} text="Nenhuma câmara cadastrada." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ minWidth: 880 }}>
              <thead>
                <tr className="text-[10px] font-bold uppercase" style={{ color: SOFT, letterSpacing: '0.08em' }}>
                  {['Câmara', 'Presidência', 'Vereadores', 'Tablets', 'Sessões', 'Matérias votadas', 'Última sessão', 'Status'].map((h, i) => (
                    <th key={h} className={`py-2.5 font-bold ${i === 0 ? 'pl-5' : ''} ${i === 7 ? 'pr-5' : ''} ${i >= 2 && i <= 5 ? 'text-right pr-6' : ''}`}
                        style={{ borderBottom: `1px solid ${LINE}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.chambers.map(c => {
                  const pres = c.leaders.find(l => l.role === 'presidente');
                  const href = `/superadmin/camaras/${c.id}/vereadores`;
                  return (
                    <tr key={c.id} className="group transition-colors hover:bg-slate-50/70" style={{ borderBottom: `1px solid ${LINE}` }}>
                      <td className="py-3.5 pl-5">
                        <Link href={href} className="flex items-center gap-3">
                          <ChamberLogo src={logo(c.logoUrl)} />
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold truncate group-hover:underline" style={{ color: INK }}>{c.name}</p>
                            <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: SOFT }}><MapPin size={10} /> {c.city}, {c.state}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="py-3.5">
                        {pres ? (
                          <div className="flex items-center gap-1.5 text-[13px]" style={{ color: INK }}>
                            <span className="truncate max-w-[150px]">{pres.name}</span>
                            {pres.mfa
                              ? <span title="Verificação em duas etapas ativa"><ShieldCheck size={14} style={{ color: '#059669' }} /></span>
                              : <span title="Sem verificação em duas etapas"><ShieldAlert size={14} style={{ color: '#D97706' }} /></span>}
                          </div>
                        ) : <span className="text-[12px] font-semibold" style={{ color: '#D97706' }}>Sem presidente</span>}
                      </td>
                      <Num>{c.members}</Num>
                      <Num>
                        {c.tablets}
                        {c.tabletsPending > 0 && <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: '#FEF3C7', color: '#B45309' }}>+{c.tabletsPending}</span>}
                      </Num>
                      <Num>{c.sessionsDone}</Num>
                      <Num>{nf(c.itemsVoted)}</Num>
                      <td className="py-3.5 text-[12px]" style={{ color: MUTED }}>{ago(c.lastSessionAt, now)}</td>
                      <td className="py-3.5 pr-5"><Status active={c.isActive} live={c.live} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Sistema */}
      <div className="mt-6">
        <Card title="Saúde do sistema">
          {!data ? <Skeleton rows={1} /> : (
            <div className="grid grid-cols-1 md:grid-cols-3">
              <SysItem icon={<Server size={16} />} color="#059669" label="API"
                       value={<span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} /> No ar</span>}
                       sub={`desde ${new Date(data.system.startedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} (último deploy)`} />
              <SysItem icon={<Database size={16} />} color={BLUE} label="Banco de dados"
                       value={bytes(data.system.dbSizeBytes)}
                       sub={`${nf(t!.users)} usuários · ${nf(t!.sessions)} sessões`} />
              <SysItem icon={<Fingerprint size={16} />} color="#7C3AED" label="Auditoria"
                       value={`${nf(t!.auditRecords)} registros`}
                       sub={data.system.lastCheckpointAt ? `último selo de integridade ${ago(data.system.lastCheckpointAt, now)}` : 'sem selo de integridade ainda'} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ── Peças ─────────────────────────────────────────────────────────────── */
function Kpi({ icon, color, label, value, sub, pulse }: { icon: React.ReactNode; color: string; label: string; value: string; sub: string; pulse?: boolean }) {
  return (
    <div className="bg-white rounded-xl px-5 py-4" style={{ border: `1px solid ${LINE}` }}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold" style={{ color: MUTED }}>{label}</span>
        <span className="w-8 h-8 rounded-lg flex items-center justify-center relative" style={{ background: `${color}12`, color }}>
          {icon}
          {pulse && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse" style={{ background: '#10B981' }} />}
        </span>
      </div>
      <p className="font-tight font-bold text-[28px] leading-none mt-2" style={{ color: INK, letterSpacing: '-0.03em' }}>{value}</p>
      <p className="text-[12px] mt-1.5" style={{ color: SOFT }}>{sub}</p>
    </div>
  );
}

function Card({ title, count, icon, action, children }: { title: string; count?: number; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
      <header className="flex items-center gap-2.5 px-5 py-3.5" style={{ borderBottom: `1px solid ${LINE}` }}>
        {icon}
        <h3 className="font-tight font-semibold text-sm" style={{ color: INK, letterSpacing: '-0.01em' }}>{title}</h3>
        {count != null && (
          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: '#F1F5F9', color: MUTED }}>{count}</span>
        )}
        <div className="ml-auto">{action}</div>
      </header>
      {children}
    </section>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return <td className="py-3.5 pr-6 text-right text-[13px] font-semibold tabular-nums" style={{ color: INK }}>{children}</td>;
}

function Status({ active, live }: { active: boolean; live: boolean }) {
  const s = !active ? { t: 'Inativa', c: SOFT, bg: '#F1F5F9' } : live ? { t: 'Ao vivo', c: '#059669', bg: '#ECFDF5' } : { t: 'Ativa', c: BLUE, bg: 'rgba(20,71,230,0.07)' };
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md" style={{ background: s.bg, color: s.c }}>
      <span className={`w-1.5 h-1.5 rounded-full ${live && active ? 'animate-pulse' : ''}`} style={{ background: s.c }} />
      {s.t}
    </span>
  );
}

function SysItem({ icon, color, label, value, sub }: { icon: React.ReactNode; color: string; label: string; value: React.ReactNode; sub: string }) {
  return (
    <div className="flex items-start gap-3 px-5 py-4 md:[&:not(:first-child)]:border-l" style={{ borderColor: LINE }}>
      <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}12`, color }}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold" style={{ color: MUTED }}>{label}</p>
        <div className="text-sm font-semibold mt-0.5" style={{ color: INK }}>{value}</div>
        <p className="text-[11px] mt-0.5" style={{ color: SOFT }}>{sub}</p>
      </div>
    </div>
  );
}

function ChamberLogo({ src }: { src: string | null }) {
  return (
    <span className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0" style={{ background: '#F8FAFC', border: `1px solid ${LINE}` }}>
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt="" className="w-full h-full object-contain p-1" />
        : <Building2 size={16} style={{ color: BLUE }} />}
    </span>
  );
}

function Empty({ icon, text, tone = SOFT }: { icon: React.ReactNode; text: string; tone?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span style={{ color: tone }}>{icon}</span>
      <p className="text-[13px]" style={{ color: MUTED }}>{text}</p>
    </div>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="px-5 py-4 flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="h-9 rounded-lg animate-pulse" style={{ background: '#F1F5F9' }} />)}
    </div>
  );
}

