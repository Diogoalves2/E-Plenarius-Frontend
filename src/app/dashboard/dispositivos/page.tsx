'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Tablet, Check, Ban, Trash2, Loader2, RefreshCw, Pencil } from 'lucide-react';
import api from '@/lib/api';

interface Device {
  id: string;
  code: string;
  name: string | null;
  label: string | null;
  status: 'pendente' | 'aprovado' | 'revogado';
  lastSeenAt: string | null;
  approvedAt: string | null;
  createdAt: string;
}

const STATUS: Record<Device['status'], { label: string; color: string; bg: string }> = {
  pendente: { label: 'AGUARDANDO', color: '#b45309', bg: 'rgba(245,158,11,0.12)' },
  aprovado: { label: 'AUTORIZADO', color: '#059669', bg: 'rgba(16,185,129,0.10)' },
  revogado: { label: 'BLOQUEADO',  color: '#dc2626', bg: 'rgba(239,68,68,0.10)' },
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

export default function DispositivosPage() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.chamberId) return;
    try {
      const { data } = await api.get(`/devices/chamber/${user.chamberId}`);
      setDevices(data);
    } finally {
      setLoading(false);
    }
  }, [user?.chamberId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id); setError('');
    try { await fn(); await load(); }
    catch (err: any) { setError(err.response?.data?.message || 'Erro ao atualizar tablet'); }
    finally { setBusy(null); }
  }

  const approve = (d: Device) => {
    const label = prompt(`Autorizar o tablet ${d.code}.\nDê um nome para identificá-lo (opcional):`, d.label ?? '');
    if (label === null) return;
    act(d.id, () => api.patch(`/devices/${d.id}/approve`, { label: label.trim() || null }));
  };
  const rename = (d: Device) => {
    const label = prompt('Novo nome do tablet:', d.label ?? '');
    if (label === null) return;
    act(d.id, () => api.patch(`/devices/${d.id}/label`, { label: label.trim() || null }));
  };
  const revoke = (d: Device) => {
    if (!confirm(`Bloquear o tablet ${d.label ?? d.code}? Quem estiver usando é desconectado na hora.`)) return;
    act(d.id, () => api.patch(`/devices/${d.id}/revoke`));
  };
  const remove = (d: Device) => {
    if (!confirm(`Remover o registro do tablet ${d.label ?? d.code}? Se ele tentar entrar de novo, aparecerá como pendente.`)) return;
    act(d.id, () => api.delete(`/devices/${d.id}`));
  };

  const pending = devices.filter(d => d.status === 'pendente');
  const others = devices.filter(d => d.status !== 'pendente');

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="font-tight font-semibold text-2xl" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>Tablets</h2>
          <p className="text-sm mt-1" style={{ color: '#8A94A2' }}>
            Só tablets autorizados conseguem entrar no app. Ao tentar entrar pela primeira vez, o tablet mostra um código — confira e autorize aqui.
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-70 flex-shrink-0" style={{ color: '#8A94A2' }}>
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl mb-4 text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin" style={{ color: '#8A94A2' }} /></div>
      ) : devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Tablet size={36} style={{ color: '#D1D5DB' }} />
          <p className="mt-4 text-sm" style={{ color: '#8A94A2' }}>
            Nenhum tablet registrado. Abra o app no tablet e entre com o PIN de um vereador — ele aparecerá aqui para autorização.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {pending.length > 0 && <Section title={`AGUARDANDO AUTORIZAÇÃO · ${pending.length}`} items={pending} busy={busy}
            actions={d => (<>
              <Btn onClick={() => approve(d)} color="#059669" icon={<Check size={14} />} label="Autorizar" />
              <Btn onClick={() => remove(d)} color="#8A94A2" icon={<Trash2 size={14} />} label="Descartar" />
            </>)} />}
          {others.length > 0 && <Section title="REGISTRADOS" items={others} busy={busy}
            actions={d => (<>
              <Btn onClick={() => rename(d)} color="#4B5563" icon={<Pencil size={14} />} label="Renomear" />
              {d.status === 'aprovado'
                ? <Btn onClick={() => revoke(d)} color="#dc2626" icon={<Ban size={14} />} label="Bloquear" />
                : <Btn onClick={() => approve(d)} color="#059669" icon={<Check size={14} />} label="Reautorizar" />}
              <Btn onClick={() => remove(d)} color="#8A94A2" icon={<Trash2 size={14} />} label="Remover" />
            </>)} />}
        </div>
      )}
    </div>
  );
}

function Section({ title, items, busy, actions }: {
  title: string; items: Device[]; busy: string | null; actions: (d: Device) => React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono-jet text-[10px] font-semibold mb-2" style={{ color: '#8A94A2', letterSpacing: '0.08em' }}>{title}</p>
      <div className="bg-white rounded-xl divide-y" style={{ border: '1px solid rgba(15,23,42,0.08)', borderColor: 'rgba(15,23,42,0.06)' }}>
        {items.map(d => {
          const st = STATUS[d.status];
          return (
            <div key={d.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex items-center justify-center rounded-lg font-mono-jet font-bold text-sm"
                     style={{ width: 84, height: 40, background: 'rgba(20,71,230,0.06)', color: '#1447E6', letterSpacing: '0.12em', flexShrink: 0 }}>
                  {d.code}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: '#0B1220' }}>{d.label ?? d.name ?? 'Tablet sem nome'}</div>
                  <div className="text-xs" style={{ color: '#8A94A2' }}>
                    {d.name && d.label ? `${d.name} · ` : ''}registrado {fmt(d.createdAt)} · último uso {fmt(d.lastSeenAt)}
                  </div>
                </div>
              </div>
              <span className="font-mono-jet text-[10px] font-semibold px-2 py-1 rounded" style={{ color: st.color, background: st.bg }}>{st.label}</span>
              <div className="flex items-center gap-2">
                {busy === d.id ? <Loader2 size={16} className="animate-spin" style={{ color: '#8A94A2' }} /> : actions(d)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Btn({ onClick, color, icon, label }: { onClick: () => void; color: string; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold hover:opacity-80"
            style={{ border: '1px solid rgba(15,23,42,0.1)', color, minHeight: 36 }}>
      {icon} {label}
    </button>
  );
}
