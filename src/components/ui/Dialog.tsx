'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { AlertTriangle, HelpCircle, Info, PencilLine, X } from 'lucide-react';

/**
 * Diálogos do sistema no lugar de alert/confirm/prompt do navegador.
 * Uso: const dialog = useDialog(); if (await dialog.confirm({ ... })) ...
 */
type Tone = 'default' | 'danger';

interface BaseOpts { title: string; message?: ReactNode; tone?: Tone }
interface ConfirmOpts extends BaseOpts { confirmLabel?: string; cancelLabel?: string }
interface PromptOpts extends ConfirmOpts {
  label?: string; defaultValue?: string; placeholder?: string; maxLength?: number; required?: boolean;
}
interface AlertOpts extends BaseOpts { okLabel?: string }

type Request = { id: number } & (
  | { kind: 'confirm'; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOpts; resolve: (v: string | null) => void }
  | { kind: 'alert'; opts: AlertOpts; resolve: () => void }
);

interface DialogApi {
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  prompt: (o: PromptOpts) => Promise<string | null>;
  alert: (o: AlertOpts) => Promise<void>;
}

const Ctx = createContext<DialogApi | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<Request | null>(null);
  const seq = useRef(0);

  // Estável: componentes podem usar o diálogo em efeitos sem re-render em cascata
  const api = useMemo<DialogApi>(() => ({
    confirm: o => new Promise<boolean>(resolve => setReq({ id: ++seq.current, kind: 'confirm', opts: o, resolve })),
    prompt: o => new Promise<string | null>(resolve => setReq({ id: ++seq.current, kind: 'prompt', opts: o, resolve })),
    alert: o => new Promise<void>(resolve => setReq({ id: ++seq.current, kind: 'alert', opts: o, resolve })),
  }), []);

  return (
    <Ctx.Provider value={api}>
      {children}
      {req && <DialogView key={req.id} req={req} onDone={() => setReq(null)} />}
    </Ctx.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDialog precisa do DialogProvider');
  return ctx;
}

function DialogView({ req, onDone }: { req: Request; onDone: () => void }) {
  const { opts } = req;
  const danger = opts.tone === 'danger';
  const [value, setValue] = useState(req.kind === 'prompt' ? req.opts.defaultValue ?? '' : '');
  const inputRef = useRef<HTMLInputElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const cancel = () => {
    if (req.kind === 'confirm') req.resolve(false);
    else if (req.kind === 'prompt') req.resolve(null);
    else req.resolve();
    onDone();
  };
  const ok = () => {
    if (req.kind === 'prompt') {
      if (req.opts.required && !value.trim()) { inputRef.current?.focus(); return; }
      req.resolve(value);
    } else if (req.kind === 'confirm') req.resolve(true);
    else req.resolve();
    onDone();
  };

  useEffect(() => {
    // Ação destrutiva: Cancelar já selecionado (um Enter sem querer não bloqueia/exclui nada)
    (req.kind === 'prompt' ? inputRef.current : danger ? cancelRef.current : okRef.current)?.focus();
    if (req.kind === 'prompt') inputRef.current?.select();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Icon = danger ? AlertTriangle : req.kind === 'prompt' ? PencilLine : req.kind === 'alert' ? Info : HelpCircle;
  const accent = danger ? '#DC2626' : '#1447E6';
  const okLabel = req.kind === 'alert' ? (req.opts as AlertOpts).okLabel ?? 'Entendi' : (req.opts as ConfirmOpts).confirmLabel ?? 'Confirmar';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
         style={{ background: 'rgba(11,18,32,0.45)', backdropFilter: 'blur(2px)' }}
         onMouseDown={e => { if (e.target === e.currentTarget) cancel(); }}>
      <div role={req.kind === 'alert' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="dlg-title"
           className="w-full max-w-md bg-white rounded-2xl overflow-hidden animate-[dlgIn_.14s_ease-out]"
           style={{ boxShadow: '0 20px 50px rgba(15,23,42,0.25)', border: '1px solid rgba(15,23,42,0.08)' }}>
        <style>{`@keyframes dlgIn{from{opacity:0;transform:translateY(6px) scale(.98)}to{opacity:1;transform:none}}
          .dlg-btn:focus{outline:none}.dlg-btn:focus-visible{box-shadow:0 0 0 3px rgba(20,71,230,.22)}`}</style>
        <form onSubmit={e => { e.preventDefault(); ok(); }}>
          <div className="flex items-start gap-3.5 px-5 pt-5">
            <span className="flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ width: 40, height: 40, background: danger ? 'rgba(220,38,38,0.1)' : 'rgba(20,71,230,0.08)', color: accent }}>
              <Icon size={19} />
            </span>
            <div className="flex-1 min-w-0 pt-0.5">
              <h2 id="dlg-title" className="text-[16px] font-semibold leading-snug" style={{ color: '#0B1220' }}>{opts.title}</h2>
              {opts.message && <div className="text-sm mt-1.5 leading-relaxed" style={{ color: '#4B5563' }}>{opts.message}</div>}
            </div>
            <button type="button" onClick={cancel} aria-label="Fechar" className="p-1 -mr-1 rounded-lg hover:bg-gray-100" style={{ color: '#8A94A2' }}>
              <X size={16} />
            </button>
          </div>

          {req.kind === 'prompt' && (
            <div className="px-5 pt-4">
              {req.opts.label && <label className="block text-xs font-semibold mb-1.5" style={{ color: '#4B5563' }}>{req.opts.label}</label>}
              <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
                     placeholder={req.opts.placeholder} maxLength={req.opts.maxLength ?? 100}
                     className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-colors"
                     style={{ border: '1px solid rgba(15,23,42,0.15)', color: '#0B1220' }}
                     onFocus={e => (e.target.style.borderColor = '#1447E6')}
                     onBlur={e => (e.target.style.borderColor = 'rgba(15,23,42,0.15)')} />
            </div>
          )}

          <div className="flex justify-end gap-2 px-5 py-4 mt-4" style={{ background: '#F8FAFC', borderTop: '1px solid rgba(15,23,42,0.06)' }}>
            {req.kind !== 'alert' && (
              <button ref={cancelRef} type="button" onClick={cancel}
                      className="dlg-btn px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white transition-colors"
                      style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563' }}>
                {(opts as ConfirmOpts).cancelLabel ?? 'Cancelar'}
              </button>
            )}
            <button ref={okRef} type="submit"
                    className="dlg-btn px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: accent }}>
              {okLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
