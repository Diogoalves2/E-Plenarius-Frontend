'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import api from '@/lib/api';

interface AuditLog {
  id: string;
  action: string;
  targetType: string | null;
  userId: string | null;
  detail: Record<string, any> | null;
  ipAddress: string | null;
  hash: string;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  'vote:cast':       '#059669',
  'voting:opened':   '#1447E6',
  'voting:closed':   '#b45309',
  'session:started': '#059669',
  'session:ended':   '#8A94A2',
};

export default function AuditoriaPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [chainStatus, setChainStatus] = useState<{ valid: boolean; brokenAt?: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!user?.chamberId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/audit/chamber/${user.chamberId}`);
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }, [user?.chamberId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  async function verifyChain() {
    if (!user?.chamberId) return;
    setVerifying(true);
    try {
      const { data } = await api.get(`/audit/chamber/${user.chamberId}/verify`);
      setChainStatus(data);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-tight font-semibold text-2xl" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>Auditoria</h2>
          <p className="text-sm mt-1" style={{ color: '#8A94A2' }}>Registro imutável de todas as ações do sistema</p>
        </div>
        <button onClick={verifyChain} disabled={verifying}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563', opacity: verifying ? 0.7 : 1 }}>
          {verifying ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
          Verificar Integridade
        </button>
      </div>

      {/* Chain integrity banner */}
      {chainStatus && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6 text-sm font-semibold"
             style={{ background: chainStatus.valid ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${chainStatus.valid ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, color: chainStatus.valid ? '#059669' : '#dc2626' }}>
          {chainStatus.valid
            ? <><CheckCircle2 size={16} /> Cadeia de hash íntegra — nenhuma adulteração detectada.</>
            : <><XCircle size={16} /> Adulteração detectada no registro: <code className="font-mono-jet ml-1">{chainStatus.brokenAt}</code></>}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : logs.length === 0 ? (
        <Empty icon={<Shield size={36} style={{ color: '#D1D5DB' }} />} text="Nenhum registro de auditoria." />
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
          <div className="grid text-xs font-mono-jet font-semibold px-5 py-3 gap-4"
               style={{ color: '#8A94A2', letterSpacing: '0.05em', borderBottom: '1px solid rgba(15,23,42,0.06)', gridTemplateColumns: '1fr 120px 100px 120px' }}>
            <span>AÇÃO / DETALHE</span>
            <span>HASH</span>
            <span>IP</span>
            <span>DATA/HORA</span>
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(15,23,42,0.04)' }}>
            {logs.map(log => (
              <div key={log.id} className="grid items-start px-5 py-3.5 gap-4 text-xs"
                   style={{ gridTemplateColumns: '1fr 120px 100px 120px' }}>
                <div>
                  <span className="inline-block font-mono-jet font-semibold px-2 py-0.5 rounded mb-1"
                        style={{ background: 'rgba(15,23,42,0.05)', color: ACTION_COLORS[log.action] ?? '#4B5563', fontSize: 10 }}>
                    {log.action}
                  </span>
                  {log.detail && (
                    <p className="text-xs leading-relaxed mt-0.5 truncate" style={{ color: '#4B5563' }}>
                      {Object.entries(log.detail).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                    </p>
                  )}
                </div>
                <code className="font-mono-jet text-[11px]" style={{ color: '#8A94A2' }}>{log.hash}</code>
                <span style={{ color: '#8A94A2' }}>{log.ipAddress ?? '—'}</span>
                <span style={{ color: '#8A94A2' }}>
                  {new Date(log.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button onClick={fetchLogs} disabled={loading} className="flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
                style={{ color: '#8A94A2' }}>
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>
    </div>
  );
}

function Spinner() { return <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin" style={{ color: '#8A94A2' }} /></div>; }
function Empty({ icon, text }: { icon: React.ReactNode; text: string }) { return <div className="flex flex-col items-center justify-center py-20 text-center">{icon}<p className="mt-4 text-sm" style={{ color: '#8A94A2' }}>{text}</p></div>; }
