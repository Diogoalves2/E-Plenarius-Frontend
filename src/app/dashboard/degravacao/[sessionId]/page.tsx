'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Upload, Loader2, Check, RotateCcw, Trash2, Play, ShieldCheck, AlertTriangle, FileText, RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { fullSessionTitle } from '@/lib/sessionTitle';

const MEDIA = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');

interface Segment {
  id: string; idx: number; startSec: number; endSec: number; speaker: string | null;
  text: string; editedText: string | null; confidence: number | null; needsReview: boolean; reviewed: boolean;
}
interface Recording {
  id: string; fileName: string; status: 'enviando' | 'na_fila' | 'processando' | 'transcrito' | 'aprovado' | 'erro';
  progress: number; error: string | null; audioUrl: string | null; durationSec: number | null; partsTotal: number;
  approvedAt: string | null; transcriptHash: string | null; recordedStartAt: string | null; segments?: Segment[];
}

const STATUS: Record<Recording['status'], { label: string; color: string; bg: string }> = {
  enviando:    { label: 'ENVIO INCOMPLETO', color: '#b45309', bg: 'rgba(245,158,11,0.12)' },
  na_fila:     { label: 'NA FILA',          color: '#1447E6', bg: 'rgba(20,71,230,0.08)' },
  processando: { label: 'TRANSCREVENDO',    color: '#1447E6', bg: 'rgba(20,71,230,0.08)' },
  transcrito:  { label: 'EM REVISÃO',       color: '#b45309', bg: 'rgba(245,158,11,0.12)' },
  aprovado:    { label: 'APROVADA',         color: '#059669', bg: 'rgba(16,185,129,0.10)' },
  erro:        { label: 'ERRO',             color: '#dc2626', bg: 'rgba(239,68,68,0.10)' },
};

const clock = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(ss).padStart(2, '0')}`;
};
const toLocalInput = (d: string | null) => {
  if (!d) return '';
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};

export default function DegravacaoPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const [session, setSession] = useState<any>(null);
  const [chamber, setChamber] = useState<any>(null);
  const [rec, setRec] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const [error, setError] = useState('');

  // envio
  const [file, setFile] = useState<File | null>(null);
  const [startAt, setStartAt] = useState('');
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);

  // revisão
  const audioRef = useRef<HTMLAudioElement>(null);
  const [onlyPending, setOnlyPending] = useState(false);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRecording = useCallback(async () => {
    const { data: list } = await api.get(`/sessions/${sessionId}/recordings`);
    const latest: Recording | undefined = list[0];
    if (!latest) { setRec(null); return; }
    const { data } = await api.get(`/recordings/${latest.id}`);
    setRec(data);
  }, [sessionId]);

  useEffect(() => {
    (async () => {
      try {
        const { data: s } = await api.get(`/sessions/${sessionId}`);
        setSession(s);
        setStartAt(toLocalInput(s.startedAt));
        api.get(`/chambers/${s.chamberId}`).then(r => setChamber(r.data)).catch(() => {});
        api.get(`/users/chamber/${s.chamberId}`).then(r => setMembers((r.data as any[]).map(u => u.name))).catch(() => {});
        const { data: me } = await api.get('/users/me');
        setCanManage(['superadmin', 'presidente', 'vice_presidente', 'secretaria'].includes(me.role)
          || /^[12]\s*[º°o.]?\s*secret/i.test((me.title ?? '').trim()));
        await loadRecording();
      } catch (e: any) {
        setError(e.response?.data?.message ?? 'Erro ao carregar');
      } finally { setLoading(false); }
    })();
  }, [sessionId, loadRecording]);

  // Acompanha o processamento
  useEffect(() => {
    if (!rec || !['na_fila', 'processando'].includes(rec.status)) return;
    const id = setInterval(() => loadRecording().catch(() => {}), 4000);
    return () => clearInterval(id);
  }, [rec?.status, loadRecording]);

  async function sendFile() {
    if (!file) return;
    setError(''); setUpload({ done: 0, total: 1 });
    try {
      let r = rec?.status === 'enviando' && rec.fileName === file.name ? rec : null;
      let partSize = 20 * 1024 * 1024;
      if (!r) {
        const { data } = await api.post(`/sessions/${sessionId}/recordings`, {
          fileName: file.name, sizeBytes: file.size,
          ...(startAt ? { recordedStartAt: new Date(startAt).toISOString() } : {}),
        });
        r = data; partSize = data.partSize;
      }
      const total = r!.partsTotal;
      setUpload({ done: 0, total });
      for (let n = 0; n < total; n++) {
        const blob = file.slice(n * partSize, (n + 1) * partSize);
        for (let attempt = 0; ; attempt++) {
          try {
            await api.put(`/recordings/${r!.id}/parts/${n}`, blob, {
              headers: { 'Content-Type': 'application/octet-stream' }, timeout: 180_000,
            });
            break;
          } catch (e) {
            if (attempt >= 4) throw e;
            await new Promise(res => setTimeout(res, 2000 * (attempt + 1)));
          }
        }
        setUpload({ done: n + 1, total });
      }
      await api.post(`/recordings/${r!.id}/complete`);
      setFile(null);
      await loadRecording();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Falha no envio. Verifique a conexão e tente de novo — o envio continua de onde parou.');
      await loadRecording().catch(() => {});
    } finally { setUpload(null); }
  }

  async function action(fn: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await fn(); await loadRecording(); }
    catch (e: any) { setError(e.response?.data?.message ?? 'Erro'); }
    finally { setBusy(false); }
  }

  async function saveSegment(seg: Segment, patch: { text?: string; speaker?: string | null; reviewed?: boolean }) {
    if (!rec) return;
    try {
      const { data } = await api.patch(`/recordings/${rec.id}/segments/${seg.id}`, patch);
      setRec(r => r && ({ ...r, segments: r.segments!.map(s => (s.id === seg.id ? data : s)) }));
    } catch (e: any) { setError(e.response?.data?.message ?? 'Erro ao salvar trecho'); }
  }

  function play(seg: Segment) {
    const a = audioRef.current; if (!a) return;
    a.currentTime = seg.startSec; a.play().catch(() => {});
  }

  const segments = rec?.segments ?? [];
  const pending = segments.filter(s => s.needsReview && !s.reviewed).length;
  const edited = segments.filter(s => s.editedText != null).length;
  const shown = useMemo(() => (onlyPending ? segments.filter(s => s.needsReview && !s.reviewed) : segments), [segments, onlyPending]);
  const editable = canManage && rec?.status === 'transcrito';

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin" style={{ color: '#8A94A2' }} /></div>;

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <Link href="/dashboard/degravacao" className="inline-flex items-center gap-1 text-sm mb-3" style={{ color: '#1447E6' }}>
        <ArrowLeft size={14} /> Degravações
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="font-tight font-semibold text-2xl" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>Degravação</h2>
          <p className="text-sm mt-1" style={{ color: '#8A94A2' }}>
            {session ? fullSessionTitle(session.number, session.type, chamber) : ''} — transcrição do áudio da sessão, revisada antes de ir para a ata.
          </p>
        </div>
        <Link href={`/ata/${sessionId}`} target="_blank" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
              style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563' }}>
          <FileText size={14} /> Ver ata
        </Link>
      </div>

      {error && <div className="px-4 py-3 rounded-xl mb-4 text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>{error}</div>}

      {/* ── Envio ── */}
      {(!rec || rec.status === 'erro' && !rec.audioUrl || rec.status === 'enviando') && (
        canManage ? (
          <div className="bg-white rounded-xl p-5 mb-5" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#0B1220' }}>
              {rec?.status === 'enviando' ? 'Envio incompleto — selecione o mesmo arquivo para continuar' : 'Enviar gravação da sessão'}
            </p>
            <p className="text-xs mb-4" style={{ color: '#8A94A2' }}>
              Arquivo da mesa de som (WAV/MP3) ou vídeo da transmissão. Arquivos grandes são enviados em partes e o envio pode ser retomado.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-xs font-semibold mb-1.5" style={{ color: '#4B5563' }}>Arquivo</span>
                <input type="file" accept="audio/*,video/*,.wav,.mp3,.m4a,.ogg,.flac,.mp4"
                       onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold mb-1.5" style={{ color: '#4B5563' }}>Início da gravação</span>
                <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)}
                       className="w-full px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid rgba(15,23,42,0.12)' }} />
                <span className="block text-[11px] mt-1" style={{ color: '#8A94A2' }}>Usado para sugerir quem estava falando em cada trecho.</span>
              </label>
            </div>
            {upload ? (
              <div className="mt-4">
                <div className="h-2 rounded-full" style={{ background: 'rgba(15,23,42,0.06)' }}>
                  <div className="h-2 rounded-full transition-all" style={{ width: `${(upload.done / upload.total) * 100}%`, background: '#1447E6' }} />
                </div>
                <p className="text-xs mt-1.5" style={{ color: '#4B5563' }}>Enviando parte {upload.done} de {upload.total}… não feche esta página.</p>
              </div>
            ) : (
              <button onClick={sendFile} disabled={!file}
                      className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
                      style={{ background: '#1447E6', opacity: file ? 1 : 0.5 }}>
                <Upload size={14} /> {rec?.status === 'enviando' ? 'Continuar envio' : 'Enviar e transcrever'}
              </button>
            )}
          </div>
        ) : !rec && (
          <p className="text-sm" style={{ color: '#8A94A2' }}>Nenhuma gravação enviada para esta sessão.</p>
        )
      )}

      {rec && rec.status !== 'enviando' && (
        <>
          {/* ── Situação ── */}
          <div className="bg-white rounded-xl p-5 mb-5" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono-jet text-[11px] font-semibold px-2 py-1 rounded" style={{ color: STATUS[rec.status].color, background: STATUS[rec.status].bg }}>
                {STATUS[rec.status].label}
              </span>
              <span className="text-sm" style={{ color: '#4B5563' }}>{rec.fileName}{rec.durationSec ? ` · ${clock(rec.durationSec)}` : ''}</span>
              {segments.length > 0 && (
                <span className="text-sm" style={{ color: '#4B5563' }}>
                  · {segments.length} trechos · <b style={{ color: pending ? '#b45309' : '#059669' }}>{pending} para conferir</b> · {edited} corrigidos
                </span>
              )}
              <div className="flex gap-2 ml-auto">
                {canManage && rec.status === 'transcrito' && (
                  <button disabled={busy || pending > 0} onClick={() => confirm('Aprovar a degravação? Ela será anexada à ata e protegida por hash.') && action(() => api.post(`/recordings/${rec.id}/approve`))}
                          title={pending ? 'Confira os trechos marcados antes de aprovar' : ''}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white"
                          style={{ background: '#059669', opacity: busy || pending ? 0.5 : 1 }}>
                    <Check size={13} /> Aprovar
                  </button>
                )}
                {canManage && rec.status === 'aprovado' && (
                  <button disabled={busy} onClick={() => confirm('Reabrir para correção? A aprovação será desfeita (fica registrado na auditoria).') && action(() => api.post(`/recordings/${rec.id}/reopen`))}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563' }}>
                    <RotateCcw size={13} /> Reabrir
                  </button>
                )}
                {canManage && ['erro', 'transcrito'].includes(rec.status) && (
                  <button disabled={busy} onClick={() => confirm('Transcrever novamente? As correções feitas serão perdidas.') && action(() => api.post(`/recordings/${rec.id}/reprocess`))}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563' }}>
                    <RefreshCw size={13} /> Reprocessar
                  </button>
                )}
                {canManage && ['erro', 'transcrito'].includes(rec.status) && (
                  <button disabled={busy} onClick={() => confirm('Excluir a gravação e a transcrição?') && action(() => api.delete(`/recordings/${rec.id}`))}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#dc2626' }}>
                    <Trash2 size={13} /> Excluir
                  </button>
                )}
              </div>
            </div>

            {['na_fila', 'processando'].includes(rec.status) && (
              <div className="mt-4">
                <div className="h-2 rounded-full" style={{ background: 'rgba(15,23,42,0.06)' }}>
                  <div className="h-2 rounded-full transition-all" style={{ width: `${Math.max(rec.progress, 2)}%`, background: '#1447E6' }} />
                </div>
                <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: '#4B5563' }}>
                  <Loader2 size={12} className="animate-spin" />
                  {rec.status === 'na_fila' ? 'Aguardando na fila…' : `Transcrevendo… ${rec.progress}%`} Pode fechar esta página; o processamento continua no servidor.
                </p>
              </div>
            )}
            {rec.status === 'erro' && (
              <p className="text-sm mt-3 flex items-start gap-2" style={{ color: '#dc2626' }}><AlertTriangle size={15} className="mt-0.5 flex-shrink-0" /> {rec.error}</p>
            )}
            {rec.status === 'aprovado' && (
              <p className="text-xs mt-3 flex items-center gap-1.5 font-mono-jet break-all" style={{ color: '#059669' }}>
                <ShieldCheck size={14} className="flex-shrink-0" /> Aprovada em {new Date(rec.approvedAt!).toLocaleString('pt-BR')} · hash {rec.transcriptHash}
              </p>
            )}
            {rec.audioUrl && (
              <audio ref={audioRef} src={`${MEDIA}${rec.audioUrl}`} controls preload="metadata" className="w-full mt-4"
                     onTimeUpdate={e => {
                       const t = (e.target as HTMLAudioElement).currentTime;
                       const cur = segments.find(s => t >= s.startSec && t < s.endSec);
                       setPlayingIdx(cur ? cur.idx : null);
                     }} />
            )}
          </div>

          {/* ── Trechos ── */}
          {segments.length > 0 && (
            <>
              <div className="flex items-center gap-3 mb-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#4B5563' }}>
                  <input type="checkbox" checked={onlyPending} onChange={e => setOnlyPending(e.target.checked)} />
                  Mostrar só trechos para conferir
                </label>
                <span className="text-xs ml-auto" style={{ color: '#8A94A2' }}>
                  Trechos amarelos têm números ou baixa confiança: confira ouvindo o áudio (clique no horário).
                </span>
              </div>
              <datalist id="oradores">{members.map(m => <option key={m} value={m} />)}</datalist>
              <div className="flex flex-col gap-2">
                {shown.map(s => {
                  const flag = s.needsReview && !s.reviewed;
                  return (
                    <div key={s.id} className="rounded-xl p-3 flex gap-3"
                         style={{
                           background: playingIdx === s.idx ? 'rgba(20,71,230,0.05)' : flag ? 'rgba(245,158,11,0.07)' : '#fff',
                           border: `1px solid ${playingIdx === s.idx ? 'rgba(20,71,230,0.35)' : flag ? 'rgba(245,158,11,0.35)' : 'rgba(15,23,42,0.08)'}`,
                         }}>
                      <button onClick={() => play(s)} title="Ouvir este trecho"
                              className="flex items-center gap-1 font-mono-jet text-xs font-semibold self-start px-2 py-1 rounded-lg flex-shrink-0"
                              style={{ background: 'rgba(20,71,230,0.08)', color: '#1447E6' }}>
                        <Play size={11} /> {clock(s.startSec)}
                      </button>
                      <div className="flex-1 min-w-0">
                        <input list="oradores" defaultValue={s.speaker ?? ''} placeholder="Orador" disabled={!editable}
                               onBlur={e => { const v = e.target.value.trim(); if (v !== (s.speaker ?? '')) saveSegment(s, { speaker: v || null }); }}
                               className="text-xs font-semibold mb-1 px-1.5 py-0.5 rounded outline-none w-64 max-w-full"
                               style={{ color: '#0B1220', background: 'transparent', border: '1px dashed rgba(15,23,42,0.15)' }} />
                        <textarea defaultValue={s.editedText ?? s.text} disabled={!editable} rows={Math.min(6, Math.ceil((s.editedText ?? s.text).length / 110) + 1)}
                                  onBlur={e => { if (e.target.value.trim() !== (s.editedText ?? s.text)) saveSegment(s, { text: e.target.value }); }}
                                  className="w-full text-sm leading-relaxed outline-none resize-y rounded px-1.5 py-1"
                                  style={{ color: '#1e293b', background: 'transparent', border: '1px solid transparent' }}
                                  onFocus={e => (e.target.style.borderColor = 'rgba(20,71,230,0.3)')} />
                        <div className="flex items-center gap-3 mt-1 text-[11px]" style={{ color: '#8A94A2' }}>
                          {s.editedText != null && <span style={{ color: '#1447E6' }}>corrigido</span>}
                          {s.confidence != null && <span>confiança {Math.round(s.confidence * 100)}%</span>}
                          {s.needsReview && (
                            <label className="flex items-center gap-1 cursor-pointer" style={{ color: s.reviewed ? '#059669' : '#b45309' }}>
                              <input type="checkbox" checked={s.reviewed} disabled={!editable}
                                     onChange={e => saveSegment(s, { reviewed: e.target.checked })} />
                              conferido
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
