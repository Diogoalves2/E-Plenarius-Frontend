'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Loader2, ShieldCheck, Copy, Download, ArrowLeft, KeyRound } from 'lucide-react';
import { AuthUser, mfaEnable, mfaSetup, mfaVerify } from '@/lib/auth';

const input = {
  background: '#15191F',
  border: '1px solid rgba(255,255,255,0.08)',
  fontFamily: 'inherit',
} as const;

const label = 'text-xs font-semibold font-mono-jet tracking-wider';

function errorText(err: any): string {
  const status = err?.response?.status;
  const msg: string = err?.response?.data?.message ?? '';
  if (!err?.response) return 'Sem conexão com o servidor.';
  if (status === 429) return msg || 'Muitas tentativas. Aguarde alguns minutos.';
  if (Array.isArray(msg)) return 'Código inválido.';
  return msg || 'Não foi possível confirmar o código.';
}

function Remember({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2.5 text-xs cursor-pointer select-none" style={{ color: '#9AA3AE' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
             className="mt-0.5" style={{ accentColor: '#1447E6' }} />
      <span>Confiar neste computador por 30 dias<br />
        <span style={{ color: '#5B636D' }}>Não marque em computador público ou compartilhado.</span>
      </span>
    </label>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <p className="text-xs px-3.5 py-2.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
      {text}
    </p>
  );
}

function Submit({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={loading}
            className="w-full py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: '#1447E6', color: '#fff', opacity: loading ? 0.7 : 1 }}>
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1.5 text-xs mt-6" style={{ color: '#5B636D' }}>
      <ArrowLeft size={13} /> Voltar e entrar com outro usuário
    </button>
  );
}

/** Login com 2FA já ativa: código do app (ou de recuperação). */
export function MfaVerifyStep({ mfaToken, onDone, onBack }: {
  mfaToken: string; onDone: (user: AuthUser) => void; onBack: () => void;
}) {
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { user, usedRecoveryCode } = await mfaVerify(mfaToken, code, remember);
      if (usedRecoveryCode) {
        alert('Você entrou com um código de recuperação, que não vale mais. Se perdeu o celular, peça ao administrador para redefinir a verificação em duas etapas.');
      }
      onDone(user);
    } catch (err) {
      setError(errorText(err));
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="font-mono-jet text-xs tracking-widest mb-1.5" style={{ color: '#5B636D', letterSpacing: '0.1em' }}>
        VERIFICAÇÃO EM DUAS ETAPAS
      </p>
      <h2 className="font-tight font-semibold text-white text-2xl mb-2" style={{ letterSpacing: '-0.025em' }}>
        {recovery ? 'Código de recuperação' : 'Código do aplicativo'}
      </h2>
      <p className="text-sm mb-6" style={{ color: '#9AA3AE' }}>
        {recovery
          ? 'Digite um dos códigos de recuperação que você guardou (formato xxxx-xxxx).'
          : 'Abra o Google Authenticator (ou similar) no celular e digite o código de 6 dígitos do E-Plenarius.'}
      </p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <input
          autoFocus
          value={code}
          onChange={e => setCode(recovery ? e.target.value.slice(0, 9) : e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode={recovery ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          placeholder={recovery ? 'xxxx-xxxx' : '000000'}
          required
          className="w-full px-3.5 py-3 rounded-lg text-white outline-none text-center font-mono-jet"
          style={{ ...input, fontSize: 22, letterSpacing: '0.3em' }}
        />
        <Remember checked={remember} onChange={setRemember} />
        {error && <ErrorBox text={error} />}
        <Submit loading={loading}>Confirmar</Submit>
      </form>
      <button type="button" onClick={() => { setRecovery(r => !r); setCode(''); setError(''); }}
              className="flex items-center gap-1.5 text-xs mt-5" style={{ color: '#7FA0FF' }}>
        <KeyRound size={13} /> {recovery ? 'Usar o código do aplicativo' : 'Perdi o celular — usar código de recuperação'}
      </button>
      <Back onClick={onBack} />
    </div>
  );
}

/** Primeiro acesso de superadmin/presidente: cadastra o app autenticador. */
export function MfaSetupStep({ mfaToken, onDone, onBack }: {
  mfaToken: string; onDone: (user: AuthUser) => void; onBack: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    mfaSetup(mfaToken)
      .then(async ({ secret, otpauthUrl }) => {
        setSecret(secret);
        // QR gerado aqui mesmo no navegador: o segredo não passa por nenhum serviço externo.
        setQr(await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 }));
      })
      .catch(err => setError(errorText(err)));
  }, [mfaToken]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const r = await mfaEnable(mfaToken, code, remember);
      setCodes(r.recoveryCodes);
      setUser(r.user);
    } catch (err) {
      setError(errorText(err));
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  if (codes && user) {
    const text = `E-Plenarius — códigos de recuperação (${user.email})\nCada código vale uma única vez.\n\n${codes.join('\n')}\n`;
    return (
      <div>
        <div className="flex items-center gap-2 mb-2" style={{ color: '#34d399' }}>
          <ShieldCheck size={18} /> <span className="text-sm font-semibold">Verificação em duas etapas ativada</span>
        </div>
        <h2 className="font-tight font-semibold text-white text-2xl mb-2">Guarde os códigos de recuperação</h2>
        <p className="text-sm mb-5" style={{ color: '#9AA3AE' }}>
          Se perder o celular, use um destes códigos para entrar. Cada um vale <b>uma vez</b>. Imprima ou salve em local seguro — eles não serão mostrados de novo.
        </p>
        <div className="grid grid-cols-2 gap-2 p-4 rounded-xl mb-4 font-mono-jet text-sm text-white"
             style={{ background: '#15191F', border: '1px solid rgba(255,255,255,0.08)' }}>
          {codes.map(c => <span key={c} className="text-center py-1">{c}</span>)}
        </div>
        <div className="flex gap-2 mb-5">
          <button type="button" onClick={() => navigator.clipboard?.writeText(text)}
                  className="flex-1 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                  style={{ border: '1px solid rgba(255,255,255,0.12)', color: '#E5E7EB' }}>
            <Copy size={13} /> Copiar
          </button>
          <button type="button"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
                    a.download = 'e-plenarius-codigos-recuperacao.txt';
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                  className="flex-1 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                  style={{ border: '1px solid rgba(255,255,255,0.12)', color: '#E5E7EB' }}>
            <Download size={13} /> Baixar .txt
          </button>
        </div>
        <label className="flex items-center gap-2.5 text-xs mb-4 cursor-pointer" style={{ color: '#9AA3AE' }}>
          <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} style={{ accentColor: '#1447E6' }} />
          Guardei os códigos em local seguro
        </label>
        <button type="button" disabled={!saved} onClick={() => onDone(user)}
                className="w-full py-3 rounded-lg font-semibold text-sm"
                style={{ background: '#1447E6', color: '#fff', opacity: saved ? 1 : 0.5 }}>
          Continuar para o painel
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono-jet text-xs tracking-widest mb-1.5" style={{ color: '#5B636D', letterSpacing: '0.1em' }}>
        PRIMEIRO ACESSO · SEGURANÇA
      </p>
      <h2 className="font-tight font-semibold text-white text-2xl mb-2" style={{ letterSpacing: '-0.025em' }}>
        Ative a verificação em duas etapas
      </h2>
      <p className="text-sm mb-5" style={{ color: '#9AA3AE' }}>
        Obrigatória para presidente e administrador. Além da senha, o login pedirá um código do seu celular.
      </p>

      <ol className="flex flex-col gap-3 text-sm mb-5" style={{ color: '#C9CED6' }}>
        {[
          <>Instale o <b>Google Authenticator</b> (ou Microsoft Authenticator) no celular.</>,
          <>No app, toque em <b>+</b> e leia o QR code abaixo.</>,
          <>Digite o código de 6 dígitos que aparecer.</>,
        ].map((t, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                  style={{ background: 'rgba(82,130,255,0.15)', color: '#7FA0FF' }}>{i + 1}</span>
            <span>{t}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col items-center gap-2 mb-5">
        <div className="rounded-xl p-2 bg-white" style={{ width: 236, height: 236 }}>
          {qr ? <img src={qr} alt="QR code para o app autenticador" width={220} height={220} />
              : <div className="w-full h-full flex items-center justify-center"><Loader2 className="animate-spin" style={{ color: '#9AA3AE' }} /></div>}
        </div>
        {secret && (
          <p className="text-xs text-center" style={{ color: '#5B636D' }}>
            Sem câmera? Digite a chave no app:<br />
            <span className="font-mono-jet select-all" style={{ color: '#C9CED6', letterSpacing: '0.08em' }}>
              {secret.match(/.{1,4}/g)?.join(' ')}
            </span>
          </p>
        )}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className={label} style={{ color: '#9AA3AE', letterSpacing: '0.06em' }}>CÓDIGO DO APP</label>
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            required
            className="w-full px-3.5 py-3 rounded-lg text-white outline-none text-center font-mono-jet"
            style={{ ...input, fontSize: 22, letterSpacing: '0.3em' }}
          />
        </div>
        <Remember checked={remember} onChange={setRemember} />
        {error && <ErrorBox text={error} />}
        <Submit loading={loading}>Ativar e entrar</Submit>
      </form>
      <Back onClick={onBack} />
    </div>
  );
}
