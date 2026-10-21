'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, KeyRound, Copy } from 'lucide-react';
import api from '@/lib/api';

interface MfaStatus { required: boolean; enabled: boolean; enabledAt: string | null; recoveryCodesLeft: number }

/** Situação da verificação em duas etapas do usuário logado + novos códigos de recuperação. */
export function MfaCard() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [asking, setAsking] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);

  const load = () => api.get('/auth/mfa/status').then(r => setStatus(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  async function regenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/mfa/recovery-codes', { code });
      setCodes(data.recoveryCodes);
      setAsking(false); setCode('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Código incorreto.');
    } finally {
      setLoading(false);
    }
  }

  if (!status) return null;

  return (
    <div className="bg-white rounded-xl p-5 mb-5" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
      <div className="flex items-start gap-3">
        {status.enabled
          ? <ShieldCheck size={20} style={{ color: '#059669' }} className="flex-shrink-0 mt-0.5" />
          : <ShieldAlert size={20} style={{ color: '#D97706' }} className="flex-shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: '#0B1220' }}>Verificação em duas etapas</p>
          <p className="text-xs mt-0.5" style={{ color: '#4B5563' }}>
            {status.enabled
              ? <>Ativa desde {new Date(status.enabledAt!).toLocaleDateString('pt-BR')} · {status.recoveryCodesLeft} código(s) de recuperação restante(s).</>
              : 'Será configurada no próximo login.'}
          </p>
          {status.enabled && status.recoveryCodesLeft <= 3 && !codes && (
            <p className="text-xs mt-1 font-semibold" style={{ color: '#D97706' }}>Poucos códigos de recuperação: gere novos.</p>
          )}
        </div>
        {status.enabled && !asking && (
          <button onClick={() => { setAsking(true); setCodes(null); }}
                  className="text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 flex-shrink-0"
                  style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#1447E6' }}>
            <KeyRound size={13} /> Novos códigos
          </button>
        )}
      </div>

      {asking && (
        <form onSubmit={regenerate} className="mt-4 flex flex-wrap items-center gap-2">
          <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                 inputMode="numeric" autoComplete="one-time-code" placeholder="Código do app" required
                 className="px-3 py-2 rounded-lg text-sm font-mono-jet outline-none"
                 style={{ border: '1px solid rgba(15,23,42,0.15)', width: 150 }} />
          <button type="submit" disabled={loading} className="text-xs font-semibold px-3 py-2 rounded-lg text-white flex items-center gap-1.5"
                  style={{ background: '#1447E6' }}>
            {loading && <Loader2 size={12} className="animate-spin" />} Gerar
          </button>
          <button type="button" onClick={() => { setAsking(false); setError(''); }} className="text-xs" style={{ color: '#8A94A2' }}>Cancelar</button>
          {error && <p className="w-full text-xs" style={{ color: '#DC2626' }}>{error}</p>}
          <p className="w-full text-xs" style={{ color: '#8A94A2' }}>Os códigos antigos deixam de valer.</p>
        </form>
      )}

      {codes && (
        <div className="mt-4">
          <p className="text-xs mb-2" style={{ color: '#4B5563' }}>Guarde em local seguro. Cada código vale uma vez e não será mostrado de novo.</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 rounded-lg font-mono-jet text-sm" style={{ background: '#F5F6F8' }}>
            {codes.map(c => <span key={c} className="text-center">{c}</span>)}
          </div>
          <button onClick={() => navigator.clipboard?.writeText(codes.join('\n'))}
                  className="text-xs mt-2 flex items-center gap-1.5" style={{ color: '#1447E6' }}>
            <Copy size={12} /> Copiar
          </button>
        </div>
      )}
    </div>
  );
}
