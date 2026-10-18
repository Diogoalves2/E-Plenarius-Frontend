import { Lock } from 'lucide-react';

/** Votação secreta em andamento: o placar parcial fica oculto até o encerramento. */
export function SecretTally({ total, dark = false, large = false }: { total: number; dark?: boolean; large?: boolean }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl"
      style={{
        padding: large ? '20px 24px' : '12px 14px',
        background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(20,71,230,0.05)',
        border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(20,71,230,0.15)'}`,
      }}
    >
      <Lock size={large ? 28 : 18} style={{ color: dark ? '#9AA4B2' : '#1447E6', flexShrink: 0 }} />
      <div>
        <div className={large ? 'text-2xl font-bold' : 'text-sm font-bold'} style={{ color: dark ? '#E9EDF2' : '#0F172A' }}>
          Votação secreta · {total} {total === 1 ? 'voto registrado' : 'votos registrados'}
        </div>
        <div className={large ? 'text-base' : 'text-xs'} style={{ color: dark ? '#8A94A2' : '#64748B' }}>
          O placar é revelado quando o presidente encerrar a votação.
        </div>
      </div>
    </div>
  );
}
