'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { Plus, Building2, MapPin, X, Copy, Check, Loader2, Eye, EyeOff, ImagePlus, Trash2, KeyRound, Pencil, Users, Search, ShieldCheck, ShieldAlert, CalendarRange, ChevronRight, Ban, Power } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useDialog } from '@/components/ui/Dialog';

import { Select } from '@/components/ui/Select';
interface Chamber {
  id: string;
  name: string;
  city: string;
  state: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  legislaturaInicio?: number | null;
  legislaturaFim?: number | null;
  bienioInicio?: number | null;
  bienioFim?: number | null;
  anoBienio?: number | null;
}

interface Credentials {
  chamber: Chamber;
  presidenteEmail: string;
  presidentePassword: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ?? 'http://localhost:3001';
const BLUE = '#1447E6';

export default function CamarasPage() {
  return <Suspense><CamarasPageInner /></Suspense>;
}

interface Leader { name: string; role: 'presidente' | 'vice_presidente'; mfa: boolean }
interface ChamberStats {
  id: string; members: number; tablets: number; tabletsPending: number; sessionsDone: number;
  itemsVoted: number; lastSessionAt: string | null; leaders: Leader[]; live: boolean;
  lastSuspension: { at: string; reason: string | null } | null;
}
type Filter = 'todas' | 'ativas' | 'ao_vivo' | 'inativas';

function ago(iso: string | null) {
  if (!iso) return 'nenhuma ainda';
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `há ${Math.max(1, m)} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} dia${d > 1 ? 's' : ''}`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function CamarasPageInner() {
  const dialog = useDialog();
  const [chambers, setChambers] = useState<Chamber[]>([]);
  const [stats, setStats] = useState<Record<string, ChamberStats>>({});
  const [loadingChambers, setLoadingChambers] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Chamber | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todas');

  const router = useRouter();
  const searchParams = useSearchParams();

  const fetchChambers = useCallback(async () => {
    try {
      const [{ data }, ov] = await Promise.all([
        api.get('/chambers'),
        api.get('/chambers/admin/overview').catch(() => null),
      ]);
      setChambers(data);
      if (ov?.data?.chambers) setStats(Object.fromEntries(ov.data.chambers.map((c: ChamberStats) => [c.id, c])));
    } finally {
      setLoadingChambers(false);
    }
  }, []);

  useEffect(() => { fetchChambers(); }, [fetchChambers]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowModal(true);
      router.replace('/superadmin/camaras');
    }
  }, [searchParams, router]);

  function handleCreated(creds: Credentials) {
    setShowModal(false);
    setCredentials(creds);
    fetchChambers();
  }

  const [switching, setSwitching] = useState<string | null>(null);

  async function suspend(chamber: Chamber) {
    const reason = await dialog.prompt({
      title: `Suspender ${chamber.name}?`,
      message: (
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Ninguém da Câmara consegue entrar (painel, telão e tablets).</li>
          <li>Quem estiver conectado é desconectado na hora.</li>
          <li>O portal público sai do ar.</li>
          <li>Nenhum dado é apagado: ao reativar, tudo volta como estava.</li>
        </ul>
      ),
      label: 'Motivo (opcional, fica na auditoria)',
      placeholder: 'Ex.: falta de pagamento',
      maxLength: 200,
      tone: 'danger',
      confirmLabel: 'Suspender câmara',
    });
    if (reason === null) return;
    setSwitching(chamber.id);
    try {
      await api.patch(`/chambers/${chamber.id}/status`, { active: false, ...(reason.trim() ? { reason: reason.trim() } : {}) });
      await fetchChambers();
    } catch (err: any) {
      await dialog.alert({ title: 'Não foi possível suspender', message: err?.response?.data?.message ?? 'Tente novamente.', tone: 'danger' });
    } finally { setSwitching(null); }
  }

  async function reactivate(chamber: Chamber) {
    if (!(await dialog.confirm({ title: `Reativar ${chamber.name}?`, message: 'Os usuários da Câmara voltam a entrar normalmente e o portal público volta ao ar.', confirmLabel: 'Reativar câmara' }))) return;
    setSwitching(chamber.id);
    try {
      await api.patch(`/chambers/${chamber.id}/status`, { active: true });
      await fetchChambers();
    } catch (err: any) {
      await dialog.alert({ title: 'Não foi possível reativar', message: err?.response?.data?.message ?? 'Tente novamente.', tone: 'danger' });
    } finally { setSwitching(null); }
  }

  async function resetCredentials(chamber: Chamber) {
    if (!(await dialog.confirm({ title: 'Redefinir a senha do presidente?', message: <>Câmara <b>{chamber.name}</b>. A senha atual deixa de funcionar e uma nova será exibida.</>, tone: 'danger', confirmLabel: 'Redefinir senha' }))) return;
    setResetting(chamber.id);
    try {
      const { data } = await api.patch(`/chambers/${chamber.id}/reset-credentials`);
      setCredentials({ chamber, presidenteEmail: data.presidenteEmail, presidentePassword: data.presidentePassword });
    } finally {
      setResetting(null);
    }
  }

  const counts: Record<Filter, number> = {
    todas: chambers.length,
    ativas: chambers.filter(c => c.isActive).length,
    ao_vivo: chambers.filter(c => stats[c.id]?.live).length,
    inativas: chambers.filter(c => !c.isActive).length,
  };
  const q = query.trim().toLowerCase();
  const visible = chambers.filter(c =>
    (filter === 'todas' || (filter === 'ativas' && c.isActive) || (filter === 'inativas' && !c.isActive) || (filter === 'ao_vivo' && stats[c.id]?.live)) &&
    (!q || `${c.name} ${c.city} ${c.state} ${c.slug}`.toLowerCase().includes(q)),
  );
  const FILTERS: [Filter, string][] = [['todas', 'Todas'], ['ativas', 'Ativas'], ['ao_vivo', 'Ao vivo'], ['inativas', 'Suspensas']];

  return (
    <div className="min-h-full px-6 py-8 lg:px-9" style={{ background: '#F5F6F8' }}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="font-tight font-bold text-[22px]" style={{ color: '#0B1220', letterSpacing: '-0.03em' }}>Câmaras municipais</h2>
          <p className="text-[13px] mt-1" style={{ color: '#94A3B8' }}>
            {counts.todas} cadastrada{counts.todas !== 1 ? 's' : ''} · {counts.ativas} ativa{counts.ativas !== 1 ? 's' : ''}
            {counts.ao_vivo > 0 && <> · <span style={{ color: '#059669' }}>{counts.ao_vivo} ao vivo</span></>}
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors bg-[#1447E6] hover:bg-[#103CC4]">
          <Plus size={14} strokeWidth={2.5} /> Nova câmara
        </button>
      </div>

      {/* Busca + filtros */}
      {chambers.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nome, cidade ou código"
                   className="w-full h-9 pl-9 pr-3 rounded-lg text-[13px] outline-none bg-white border border-slate-200 transition-colors hover:border-slate-300 focus:border-[#1447E6]" />
          </div>
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filtrar câmaras">
            {FILTERS.map(([k, label]) => {
              const on = filter === k;
              const dot = k === 'ativas' ? BLUE : k === 'ao_vivo' ? '#10B981' : k === 'inativas' ? '#DC2626' : null;
              return (
                <button key={k} role="tab" aria-selected={on} onClick={() => setFilter(k)}
                        className={`flex items-center gap-2 h-9 px-3.5 rounded-full text-[13px] font-medium transition-colors border ${
                          on ? 'bg-[#1447E6]/[0.08] border-[#1447E6]/40 text-[#1447E6]'
                             : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}>
                  {dot && <span className={`w-1.5 h-1.5 rounded-full ${k === 'ao_vivo' && counts[k] ? 'animate-pulse' : ''}`} style={{ background: dot }} />}
                  {label}
                  <span className={`tabular-nums text-[12px] ${on ? 'text-[#1447E6]/70' : 'text-slate-400'}`}>{counts[k]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loadingChambers ? (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <div key={i} className="h-[300px] rounded-xl animate-pulse bg-white" style={{ border: '1px solid rgba(15,23,42,0.06)' }} />)}
        </div>
      ) : chambers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
          <span className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(20,71,230,0.07)' }}>
            <Building2 size={22} style={{ color: BLUE }} />
          </span>
          <p className="mt-4 font-semibold" style={{ color: '#0B1220' }}>Nenhuma câmara cadastrada</p>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Clique em &quot;Nova câmara&quot; para começar.</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm py-16 text-center" style={{ color: '#94A3B8' }}>Nenhuma câmara encontrada com esses filtros.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {visible.map(c => (
            <ChamberCard key={c.id} c={c} s={stats[c.id]} onEdit={() => setEditTarget(c)}
                         onReset={() => resetCredentials(c)} resetting={resetting === c.id}
                         onSuspend={() => suspend(c)} onReactivate={() => reactivate(c)} switching={switching === c.id} />
          ))}
        </div>
      )}

      {showModal && <NewChamberModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
      {editTarget && <EditChamberModal chamber={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); fetchChambers(); }} />}
      {credentials && <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />}
    </div>
  );
}

function ChamberCard({ c, s, onEdit, onReset, resetting, onSuspend, onReactivate, switching }: {
  c: Chamber; s?: ChamberStats; onEdit: () => void; onReset: () => void; resetting: boolean;
  onSuspend: () => void; onReactivate: () => void; switching: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const pres = s?.leaders.find(l => l.role === 'presidente');
  const status = !c.isActive ? { t: 'Suspensa', c: '#DC2626', bg: '#FEF2F2' }
    : s?.live ? { t: 'Ao vivo', c: '#059669', bg: '#ECFDF5' }
    : { t: 'Ativa', c: BLUE, bg: 'rgba(20,71,230,0.07)' };
  const susp = !c.isActive ? s?.lastSuspension : null;
  const bienio = c.bienioInicio && c.bienioFim
    ? `Biênio ${c.bienioInicio}–${c.bienioFim}${c.anoBienio ? ` · ${c.anoBienio}º ano` : ''}`
    : 'Biênio não configurado';
  const numbers: [string, number | undefined][] = [
    ['Vereadores', s?.members], ['Tablets', s?.tablets], ['Sessões', s?.sessionsDone], ['Votadas', s?.itemsVoted],
  ];

  function copy() {
    navigator.clipboard.writeText(c.slug);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <article className="bg-white rounded-xl flex flex-col transition-colors border border-slate-200/80 hover:border-slate-300">
      {!c.isActive && (
        <div className="flex items-center gap-3 px-5 py-3 rounded-t-xl" style={{ background: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
          <Ban size={15} className="flex-shrink-0" style={{ color: '#DC2626' }} />
          <div className="flex-1 min-w-0 text-[12px] leading-snug" style={{ color: '#991B1B' }}>
            <b>Câmara suspensa</b>{susp?.at ? ` desde ${new Date(susp.at).toLocaleDateString('pt-BR')}` : ''}
            {susp?.reason && <span className="block truncate" style={{ color: '#B91C1C' }}>{susp.reason}</span>}
          </div>
          <button onClick={onReactivate} disabled={switching}
                  className="flex-shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-white transition-colors bg-[#059669] hover:bg-[#047857] disabled:opacity-60">
            {switching ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />} Reativar
          </button>
        </div>
      )}
      <div className="flex flex-col flex-1" style={{ opacity: c.isActive ? 1 : 0.6 }}>
      {/* Identidade */}
      <div className="flex items-start gap-3.5 p-5 pb-4">
        <span className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}>
          {c.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={`${API_BASE}${c.logoUrl}`} alt="" className="w-full h-full object-contain p-1" />
            : <Building2 size={20} style={{ color: BLUE }} />}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-tight font-semibold text-[15px] leading-snug" style={{ color: '#0B1220', letterSpacing: '-0.01em' }}>{c.name}</h3>
          <p className="text-[12px] flex items-center gap-1 mt-0.5" style={{ color: '#94A3B8' }}><MapPin size={11} /> {c.city}, {c.state}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md flex-shrink-0"
              style={{ background: status.bg, color: status.c }}>
          <span className={`w-1.5 h-1.5 rounded-full ${s?.live && c.isActive ? 'animate-pulse' : ''}`} style={{ background: status.c }} />
          {status.t}
        </span>
      </div>

      {/* Presidência */}
      <div className="mx-5 flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] min-w-0" style={{ background: '#F8FAFC' }}>
        <span className="flex-shrink-0" style={{ color: '#94A3B8' }}>Presidente</span>
        {pres ? (
          <>
            <span className="font-semibold truncate" style={{ color: '#0B1220' }}>{pres.name}</span>
            <span className="ml-auto flex-shrink-0 inline-flex items-center gap-1 font-semibold"
                  title={pres.mfa ? 'Verificação em duas etapas ativa' : 'Verificação em duas etapas pendente'}
                  style={{ color: pres.mfa ? '#059669' : '#D97706' }}>
              {pres.mfa ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />} {pres.mfa ? '2FA' : '2FA pendente'}
            </span>
          </>
        ) : <span className="font-semibold" style={{ color: s ? '#D97706' : '#94A3B8' }}>{s ? 'não definido' : '—'}</span>}
      </div>

      {/* Números */}
      <div className="grid grid-cols-4 mx-5 mt-3 rounded-lg" style={{ border: '1px solid rgba(15,23,42,0.06)' }}>
        {numbers.map(([label, v], i) => (
          <div key={label} className="px-2 py-2.5 text-center" style={{ borderLeft: i ? '1px solid rgba(15,23,42,0.06)' : undefined }}>
            <p className="font-tight font-bold text-[17px] leading-none tabular-nums" style={{ color: '#0B1220' }}>
              {v ?? '—'}
              {label === 'Tablets' && !!s?.tabletsPending && (
                <span className="ml-1 text-[10px] font-semibold align-top" style={{ color: '#B45309' }} title="Aguardando aprovação">+{s.tabletsPending}</span>
              )}
            </p>
            <p className="text-[10px] mt-1 uppercase font-semibold" style={{ color: '#94A3B8', letterSpacing: '0.05em' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between gap-3 mx-5 mt-3 text-[11px]" style={{ color: '#94A3B8' }}>
        <span className="flex items-center gap-1 truncate"><CalendarRange size={12} /> {bienio}</span>
        <span className="flex-shrink-0">{!s ? '' : s.lastSessionAt ? `Última sessão ${ago(s.lastSessionAt)}` : 'Nenhuma sessão ainda'}</span>
      </div>

      {/* Código do app */}
      <button type="button" onClick={copy} title="Copiar código"
              className="group mx-5 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors hover:bg-slate-50"
              style={{ border: '1px dashed rgba(15,23,42,0.14)' }}>
        <span className="text-[10px] font-bold uppercase flex-shrink-0" style={{ color: '#94A3B8', letterSpacing: '0.08em' }}>Código do app</span>
        <span className="font-mono-jet text-[12px] truncate flex-1" style={{ color: '#0B1220' }}>{c.slug}</span>
        <span className="flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold" style={{ color: copied ? '#059669' : '#94A3B8' }}>
          {copied ? <><Check size={12} /> Copiado</> : <Copy size={12} className="group-hover:text-[#1447E6]" />}
        </span>
      </button>

      {/* Ações */}
      <div className="flex items-center gap-2 p-5 pt-4 mt-auto">
        <Link href={`/superadmin/camaras/${c.id}/vereadores`}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-[13px] font-semibold transition-colors bg-[#1447E6]/[0.07] text-[#1447E6] hover:bg-[#1447E6]/[0.12]">
          <Users size={14} /> Vereadores <ChevronRight size={14} />
        </Link>
        <button onClick={onEdit}
                className="flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-semibold transition-colors border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300">
          <Pencil size={13} /> Editar
        </button>
        <button onClick={onReset} disabled={resetting} title="Redefinir senha do presidente" aria-label="Redefinir senha do presidente"
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors border border-slate-200 text-slate-500 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 disabled:opacity-60">
          {resetting ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
        </button>
        {c.isActive && (
          <button onClick={onSuspend} disabled={switching} title="Suspender câmara" aria-label="Suspender câmara"
                  className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors border border-slate-200 text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 disabled:opacity-60">
            {switching ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
          </button>
        )}
      </div>
      </div>
    </article>
  );
}

/* ── New Chamber Modal ─────────────────────────────────────── */

function NewChamberModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Credentials) => void }) {
  const [form, setForm] = useState({ name: '', city: '', state: '', presidenteName: '', presidenteEmail: '', presidentePassword: '', presidenteParty: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function removeLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let logoUrl: string | undefined;
      if (logoFile) {
        const fd = new FormData();
        fd.append('file', logoFile);
        const { data: up } = await api.post('/upload/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        logoUrl = up.url;
      }
      const payload = { ...form, logoUrl };
      if (!payload.presidentePassword) delete (payload as any).presidentePassword;
      if (!payload.presidenteParty) delete (payload as any).presidenteParty;
      const { data } = await api.post('/chambers/setup', payload);
      onCreated(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar câmara');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(11,18,32,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col"
           style={{ border: '1px solid rgba(15,23,42,0.08)', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0"
             style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
          <h2 className="font-tight font-semibold text-lg" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>
            Nova Câmara
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
            <X size={18} style={{ color: '#8A94A2' }} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4 overflow-y-auto flex-1">

          {/* Logo */}
          <div>
            <p className="text-xs font-semibold font-mono-jet mb-2" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>
              LOGOMARCA <span className="font-normal">(opcional)</span>
            </p>
            {logoPreview ? (
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
                     style={{ border: '1px solid rgba(15,23,42,0.12)', background: '#F6F7F9' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoPreview} alt="preview" className="w-full h-full object-contain p-1" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#0B1220' }}>{logoFile?.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#8A94A2' }}>{logoFile ? (logoFile.size / 1024).toFixed(0) + ' KB' : ''}</p>
                </div>
                <button type="button" onClick={removeLogo} className="p-2 rounded-lg hover:bg-red-50 transition-colors" style={{ color: '#8A94A2' }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm transition-all"
                      style={{ border: '2px dashed rgba(15,23,42,0.12)', color: '#8A94A2' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#1447E6'; e.currentTarget.style.color = '#1447E6'; e.currentTarget.style.background = 'rgba(20,71,230,0.04)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(15,23,42,0.12)'; e.currentTarget.style.color = '#8A94A2'; e.currentTarget.style.background = 'transparent'; }}>
                <ImagePlus size={16} />
                Clique para enviar a logomarca
                <span className="text-xs opacity-70">(JPG, PNG, SVG · 2 MB)</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" onChange={handleLogoChange} className="hidden" />
          </div>

          <Field label="NOME DA CÂMARA" required>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Câmara Municipal de Vila Aurora" required />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="CIDADE" required>
              <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Vila Aurora" required />
            </Field>
            <Field label="ESTADO" required>
              <Input value={form.state} onChange={e => set('state', e.target.value.toUpperCase())} placeholder="MG" maxLength={2} required />
            </Field>
          </div>

          {/* Presidente */}
          <div className="pt-1" style={{ borderTop: '1px solid rgba(15,23,42,0.06)' }}>
            <p className="text-xs font-mono-jet font-semibold mb-3" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>PRESIDENTE</p>
            <div className="flex flex-col gap-3">
              <Field label="NOME COMPLETO" required>
                <Input value={form.presidenteName} onChange={e => set('presidenteName', e.target.value)} placeholder="João da Silva" required />
              </Field>
              <Field label="E-MAIL DE ACESSO" required>
                <Input type="email" value={form.presidenteEmail} onChange={e => set('presidenteEmail', e.target.value)} placeholder="joao@vilaaurora.leg.br" required />
              </Field>
              <Field label="PARTIDO" hint="(opcional)">
                <Input value={form.presidenteParty} onChange={e => set('presidenteParty', e.target.value.toUpperCase())} placeholder="MDB, PT, PSD…" />
              </Field>
              <Field label="SENHA" hint="Deixe em branco para gerar automaticamente">
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={form.presidentePassword}
                    onChange={e => set('presidentePassword', e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    minLength={form.presidentePassword ? 8 : undefined}
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#8A94A2' }}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </Field>
            </div>
          </div>

          {error && (
            <div className="px-3.5 py-3 rounded-lg text-sm"
                 style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                    style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563' }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
                    style={{ background: '#1447E6', opacity: loading ? 0.7 : 1 }}>
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Criando…' : 'Criar Câmara'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Edit Chamber Modal ────────────────────────────────────── */

function EditChamberModal({ chamber, onClose, onSaved }: { chamber: Chamber; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: chamber.name, city: chamber.city, state: chamber.state });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(chamber.logoUrl ? `${API_BASE}${chamber.logoUrl}` : null);
  const [presId, setPresId] = useState<string | null>(null);
  const [presForm, setPresForm] = useState({ name: '', email: '', party: '' });
  const [legForm, setLegForm] = useState({ legislaturaInicio: '', legislaturaFim: '', bienioInicio: '', bienioFim: '', anoBienio: '' });
  const [presFile, setPresFile] = useState<File | null>(null);
  const [presPreview, setPresPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const logoRef = useRef<HTMLInputElement>(null);
  const presRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get(`/users/chamber/${chamber.id}`).then(({ data }) => {
      const p = (data as any[]).find(u => u.role === 'presidente');
      if (p) {
        setPresId(p.id);
        setPresForm({ name: p.name, email: p.email, party: p.party ?? '' });
        if (p.avatarUrl) setPresPreview(`${API_BASE}${p.avatarUrl}`);
      }
    });
    setLegForm({
      legislaturaInicio: String(chamber.legislaturaInicio ?? ''),
      legislaturaFim: String(chamber.legislaturaFim ?? ''),
      bienioInicio: String(chamber.bienioInicio ?? ''),
      bienioFim: String(chamber.bienioFim ?? ''),
      anoBienio: String(chamber.anoBienio ?? ''),
    });
  }, [chamber.id]);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }
  function setPres(k: string, v: string) { setPresForm(f => ({ ...f, [k]: v })); }
  function setLeg(k: string, v: string) { setLegForm(f => ({ ...f, [k]: v })); }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setLogoFile(file); setLogoPreview(URL.createObjectURL(file));
  }
  function handlePresChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setPresFile(file); setPresPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let logoUrl: string | undefined;
      if (logoFile) {
        const fd = new FormData();
        fd.append('file', logoFile);
        const { data: up } = await api.post('/upload/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        logoUrl = up.url;
      }
      const legPatch: any = {};
      if (legForm.legislaturaInicio) legPatch.legislaturaInicio = Number(legForm.legislaturaInicio);
      if (legForm.legislaturaFim) legPatch.legislaturaFim = Number(legForm.legislaturaFim);
      if (legForm.bienioInicio) legPatch.bienioInicio = Number(legForm.bienioInicio);
      if (legForm.bienioFim) legPatch.bienioFim = Number(legForm.bienioFim);
      if (legForm.anoBienio) legPatch.anoBienio = Number(legForm.anoBienio);
      await api.patch(`/chambers/${chamber.id}`, { ...form, ...(logoUrl ? { logoUrl } : {}), ...legPatch });

      if (presId) {
        const presPatch: any = { name: presForm.name, email: presForm.email, party: presForm.party || undefined };
        if (presFile) {
          const fd2 = new FormData();
          fd2.append('file', presFile);
          const { data: av } = await api.post('/upload/avatar', fd2, { headers: { 'Content-Type': 'multipart/form-data' } });
          presPatch.avatarUrl = av.url;
        }
        await api.patch(`/users/${presId}`, presPatch);
      }

      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(11,18,32,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col" style={{ border: '1px solid rgba(15,23,42,0.08)', maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
          <h2 className="font-tight font-semibold text-lg" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>Editar Câmara</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors"><X size={18} style={{ color: '#8A94A2' }} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
          {/* Logo */}
          <div>
            <p className="text-xs font-semibold font-mono-jet mb-2" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>LOGOMARCA</p>
            <ImageUploadField preview={logoPreview} file={logoFile} inputRef={logoRef}
              onChange={handleLogoChange} onRemove={() => { setLogoFile(null); setLogoPreview(null); if (logoRef.current) logoRef.current.value = ''; }}
              placeholder="Clique para enviar a logomarca" />
          </div>

          <Field label="NOME DA CÂMARA" required>
            <Input value={form.name} onChange={e => set('name', e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CIDADE" required><Input value={form.city} onChange={e => set('city', e.target.value)} required /></Field>
            <Field label="ESTADO" required><Input value={form.state} onChange={e => set('state', e.target.value.toUpperCase())} maxLength={2} required /></Field>
          </div>

          {/* Presidente */}
          <div className="pt-1 flex flex-col gap-3" style={{ borderTop: '1px solid rgba(15,23,42,0.06)' }}>
            <p className="text-xs font-mono-jet font-semibold" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>PRESIDENTE</p>
            <div>
              <p className="text-xs font-semibold font-mono-jet mb-2" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>FOTO</p>
              <ImageUploadField preview={presPreview} file={presFile} inputRef={presRef}
                onChange={handlePresChange} onRemove={() => { setPresFile(null); setPresPreview(null); if (presRef.current) presRef.current.value = ''; }}
                placeholder="Clique para enviar a foto" avatar />
            </div>
            <Field label="NOME COMPLETO">
              <Input value={presForm.name} onChange={e => setPres('name', e.target.value)} placeholder="Nome do presidente" />
            </Field>
            <Field label="E-MAIL DE ACESSO">
              <Input type="email" value={presForm.email} onChange={e => setPres('email', e.target.value)} placeholder="email@camara.leg.br" />
            </Field>
            <Field label="PARTIDO" hint="(opcional)">
              <Input value={presForm.party} onChange={e => setPres('party', e.target.value.toUpperCase())} placeholder="MDB, PT, PSD…" />
            </Field>
          </div>

          {/* Legislatura & Biênio */}
          <div className="pt-1 flex flex-col gap-3" style={{ borderTop: '1px solid rgba(15,23,42,0.06)' }}>
            <p className="text-xs font-mono-jet font-semibold" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>LEGISLATURA & BIÊNIO</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="LEGISLATURA INÍCIO">
                <Input type="number" value={legForm.legislaturaInicio} onChange={e => setLeg('legislaturaInicio', e.target.value)} placeholder="2025" />
              </Field>
              <Field label="LEGISLATURA FIM">
                <Input type="number" value={legForm.legislaturaFim} onChange={e => setLeg('legislaturaFim', e.target.value)} placeholder="2028" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="BIÊNIO INÍCIO">
                <Input type="number" value={legForm.bienioInicio} onChange={e => setLeg('bienioInicio', e.target.value)} placeholder="2025" />
              </Field>
              <Field label="BIÊNIO FIM">
                <Input type="number" value={legForm.bienioFim} onChange={e => setLeg('bienioFim', e.target.value)} placeholder="2026" />
              </Field>
            </div>
            <Field label="ANO DO BIÊNIO">
              <Select ariaLabel="Ano do biênio" value={legForm.anoBienio} onChange={v => setLeg('anoBienio', v)}
                      options={[{ value: '', label: 'Não configurado' }, { value: '1', label: '1º Ano do Biênio' }, { value: '2', label: '2º Ano do Biênio' }]} />
            </Field>
          </div>

          {error && <div className="px-3.5 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563' }}>Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: '#1447E6', opacity: loading ? 0.7 : 1 }}>
              {loading && <Loader2 size={14} className="animate-spin" />}{loading ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Credentials Modal ─────────────────────────────────────── */

function CredentialsModal({ credentials, onClose }: { credentials: Credentials; onClose: () => void }) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  function copy(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(11,18,32,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
           style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
        <div className="px-6 pt-6 pb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(16,185,129,0.1)' }}>
            <Check size={20} style={{ color: '#059669' }} />
          </div>
          <h2 className="font-tight font-semibold text-lg" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>
            Câmara criada com sucesso!
          </h2>
          <p className="text-sm mt-1" style={{ color: '#4B5563' }}>
            Compartilhe as credenciais abaixo com o presidente da câmara.
          </p>
        </div>

        <div className="px-6 pb-3 flex flex-col gap-3">
          <div className="rounded-xl p-4" style={{ background: '#F6F7F9', border: '1px solid rgba(15,23,42,0.08)' }}>
            <p className="font-mono-jet text-xs font-semibold mb-1.5" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>CÂMARA</p>
            <p className="font-semibold text-sm" style={{ color: '#0B1220' }}>{credentials.chamber.name}</p>
            <p className="text-xs mt-0.5" style={{ color: '#8A94A2' }}>{credentials.chamber.city} — {credentials.chamber.state}</p>
          </div>

          <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: '#F6F7F9', border: '1px solid rgba(15,23,42,0.08)' }}>
            <p className="font-mono-jet text-xs font-semibold" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>CREDENCIAIS DO PRESIDENTE</p>
            <CopyRow label="E-MAIL" value={credentials.presidenteEmail} copied={copiedEmail} onCopy={() => copy(credentials.presidenteEmail, setCopiedEmail)} />
            <div>
              <p className="font-mono-jet text-xs mb-1" style={{ color: '#8A94A2', letterSpacing: '0.05em' }}>SENHA</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono-jet text-sm px-3 py-2 rounded-lg"
                      style={{ background: 'white', border: '1px solid rgba(15,23,42,0.08)', color: '#0B1220', letterSpacing: '0.05em' }}>
                  {showPwd ? credentials.presidentePassword : '••••••••••'}
                </code>
                <button onClick={() => setShowPwd(v => !v)} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#8A94A2' }}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button onClick={() => copy(credentials.presidentePassword, setCopiedPwd)} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: copiedPwd ? '#059669' : '#8A94A2' }}>
                  {copiedPwd ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-base leading-none mt-0.5">⚠️</span>
            <p className="text-xs leading-relaxed" style={{ color: '#8A94A2' }}>
              Esta senha não poderá ser visualizada novamente. Copie e compartilhe agora com o presidente.
            </p>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button onClick={onClose}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: '#1447E6' }}>
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Shared helpers ────────────────────────────────────────── */

const iStyle: React.CSSProperties = { background: 'white', border: '1px solid #E4E7ED', color: '#0D1117', transition: 'border-color 0.15s' };

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3.5 py-2.5 rounded-lg text-sm outline-none ${className}`}
      style={iStyle}
      onFocus={e => (e.target.style.borderColor = '#1447E6')}
      onBlur={e => (e.target.style.borderColor = '#E4E7ED')}
    />
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold font-mono-jet" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>
        {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
        {hint && <span className="font-normal ml-1.5 normal-case" style={{ letterSpacing: '0' }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function ImageUploadField({
  preview, file, inputRef, onChange, onRemove, placeholder, avatar,
}: {
  preview: string | null;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  placeholder: string;
  avatar?: boolean;
}) {
  return preview ? (
    <div className="flex items-center gap-3">
      <div className={`flex-shrink-0 overflow-hidden flex items-center justify-center ${avatar ? 'w-14 h-14 rounded-full' : 'w-14 h-14 rounded-xl'}`}
           style={{ border: '1px solid rgba(15,23,42,0.12)', background: '#F6F7F9' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="preview" className={`w-full h-full object-cover ${avatar ? '' : 'object-contain p-1'}`} />
      </div>
      <div className="flex-1 min-w-0">
        {file && <p className="text-sm font-semibold truncate" style={{ color: '#0B1220' }}>{file.name}</p>}
        {file && <p className="text-xs mt-0.5" style={{ color: '#8A94A2' }}>{(file.size / 1024).toFixed(0)} KB</p>}
        {!file && <p className="text-xs" style={{ color: '#8A94A2' }}>Foto atual</p>}
      </div>
      <button type="button" onClick={onRemove} className="p-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0" style={{ color: '#8A94A2' }}>
        <Trash2 size={15} />
      </button>
    </div>
  ) : (
    <>
      <button type="button" onClick={() => inputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm transition-all"
              style={{ border: '2px dashed rgba(15,23,42,0.12)', color: '#8A94A2' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#1447E6'; e.currentTarget.style.color = '#1447E6'; e.currentTarget.style.background = 'rgba(20,71,230,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(15,23,42,0.12)'; e.currentTarget.style.color = '#8A94A2'; e.currentTarget.style.background = 'transparent'; }}>
        <ImagePlus size={16} />
        {placeholder}
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" onChange={onChange} className="hidden" />
    </>
  );
}

function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div>
      <p className="font-mono-jet text-xs mb-1" style={{ color: '#8A94A2', letterSpacing: '0.05em' }}>{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 font-mono-jet text-sm px-3 py-2 rounded-lg truncate"
              style={{ background: 'white', border: '1px solid rgba(15,23,42,0.08)', color: '#0B1220' }}>
          {value}
        </code>
        <button onClick={onCopy} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: copied ? '#059669' : '#8A94A2' }}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
}
