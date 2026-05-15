'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Video, Copy, Check, ExternalLink, Monitor, AlertCircle,
  Youtube, Save, Loader2, Trash2, Upload, Link,
} from 'lucide-react';
import api from '@/lib/api';

interface ActiveSession {
  id: string;
  number: number;
  type: string;
  status: string;
  youtubeUrl?: string | null;
  youtubeThumbnailUrl?: string | null;
}

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000';
const MEDIA = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/live/')) return u.pathname.split('/live/')[1].split('?')[0];
      return u.searchParams.get('v');
    }
  } catch {}
  return null;
}

function youtubeThumbnail(url: string): string | null {
  const id = extractYoutubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : null;
}

export default function TransmissaoPage() {
  const { user } = useAuth();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Stream form
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [customThumb, setCustomThumb] = useState('');   // URL (digitada ou retornada do upload)
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreviewLocal, setThumbPreviewLocal] = useState<string | null>(null); // blob preview
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [thumbMode, setThumbMode] = useState<'url' | 'upload'>('url');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSession = useCallback(async () => {
    if (!user?.chamberId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/sessions/active/${user.chamberId}`);
      setSession(data);
      setYoutubeUrl(data?.youtubeUrl ?? '');
      setCustomThumb(data?.youtubeThumbnailUrl ?? '');
    } catch { setSession(null); }
    finally { setLoading(false); }
  }, [user?.chamberId]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  const telaoUrl = session ? `${FRONTEND_URL}/telao?sessionId=${session.id}` : '';

  function copyLink() {
    navigator.clipboard.writeText(telaoUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Thumbnail preview: local blob (antes do upload) > customThumb URL > auto-derived from YouTube
  const autoThumb = youtubeUrl ? youtubeThumbnail(youtubeUrl) : null;
  const thumbPreview = thumbPreviewLocal
    || (customThumb ? (customThumb.startsWith('http') ? customThumb : `${MEDIA}${customThumb}`) : null)
    || autoThumb;

  const thumbSource = thumbPreviewLocal ? 'arquivo selecionado'
    : customThumb ? (thumbMode === 'upload' ? 'upload enviado' : 'URL personalizada')
    : autoThumb ? 'gerada automaticamente via YouTube'
    : null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbFile(file);
    setThumbPreviewLocal(URL.createObjectURL(file));
    setCustomThumb(''); // será preenchido após o upload
  }

  function removeThumb() {
    setThumbFile(null);
    setThumbPreviewLocal(null);
    setCustomThumb('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function saveStream() {
    if (!session) return;
    setSaving(true);
    setError('');
    try {
      let finalThumbUrl = customThumb || null;

      // Se há arquivo selecionado, faz upload primeiro
      if (thumbFile) {
        setUploadingThumb(true);
        const fd = new FormData();
        fd.append('file', thumbFile);
        const { data } = await api.post('/upload/avatar', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        finalThumbUrl = data.url;
        setCustomThumb(data.url);
        setThumbFile(null);
        setThumbPreviewLocal(null);
        setUploadingThumb(false);
      }

      await api.patch(`/sessions/${session.id}/stream`, {
        youtubeUrl: youtubeUrl || null,
        youtubeThumbnailUrl: finalThumbUrl,
      });

      setSession(s => s ? { ...s, youtubeUrl: youtubeUrl || null, youtubeThumbnailUrl: finalThumbUrl } : s);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setUploadingThumb(false);
      setError(e.response?.data?.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function clearStream() {
    setYoutubeUrl('');
    setCustomThumb('');
    setThumbFile(null);
    setThumbPreviewLocal(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  if (loading) return (
    <div className="p-8 flex justify-center py-20">
      <div className="text-sm" style={{ color: '#8A94A2' }}>Carregando…</div>
    </div>
  );

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h2 className="font-tight font-semibold text-2xl" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>Transmissão</h2>
        <p className="text-sm mt-1" style={{ color: '#8A94A2' }}>Links e dados da transmissão para o telão do plenário</p>
      </div>

      {!session ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle size={36} style={{ color: '#D1D5DB' }} />
          <p className="mt-4 font-semibold" style={{ color: '#0B1220' }}>Nenhuma sessão em andamento</p>
          <p className="text-sm mt-1" style={{ color: '#8A94A2' }}>Inicie uma sessão para configurar a transmissão.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">

          {/* Session info */}
          <div className="bg-white rounded-xl p-5" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
            <p className="font-mono-jet text-xs font-semibold mb-2" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>SESSÃO ATIVA</p>
            <p className="font-semibold" style={{ color: '#0B1220' }}>{session.number}ª Sessão</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: '#10b981' }} />
              <span className="text-sm font-semibold" style={{ color: '#059669' }}>Em andamento</span>
            </div>
          </div>

          {/* YouTube stream config */}
          <div className="bg-white rounded-xl p-5 flex flex-col gap-4" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
            <div className="flex items-center gap-2">
              <Youtube size={16} style={{ color: '#dc2626' }} />
              <p className="font-semibold text-sm" style={{ color: '#0B1220' }}>Transmissão YouTube</p>
              <span className="ml-auto text-xs font-mono-jet px-2 py-0.5 rounded"
                    style={{ background: session.youtubeUrl ? 'rgba(16,185,129,0.1)' : 'rgba(15,23,42,0.05)',
                             color: session.youtubeUrl ? '#059669' : '#8A94A2' }}>
                {session.youtubeUrl ? 'CONFIGURADO' : 'NÃO CONFIGURADO'}
              </span>
            </div>

            {/* YouTube URL */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold font-mono-jet" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>
                LINK DA LIVE
              </label>
              <input
                type="url"
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: 'white', border: '1px solid rgba(15,23,42,0.12)', color: '#0B1220' }}
                onFocus={e => (e.target.style.borderColor = '#1447E6')}
                onBlur={e => (e.target.style.borderColor = 'rgba(15,23,42,0.12)')}
              />
            </div>

            {/* Thumbnail section */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold font-mono-jet" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>
                  THUMBNAIL <span className="font-normal normal-case" style={{ letterSpacing: 0 }}>(opcional — sobrepõe a do YouTube)</span>
                </label>
                {/* Toggle URL / Upload */}
                <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(15,23,42,0.10)' }}>
                  {(['url', 'upload'] as const).map(mode => (
                    <button key={mode} type="button"
                            onClick={() => setThumbMode(mode)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors"
                            style={{
                              background: thumbMode === mode ? '#1447E6' : 'white',
                              color: thumbMode === mode ? '#fff' : '#8A94A2',
                            }}>
                      {mode === 'url' ? <><Link size={11} /> URL</> : <><Upload size={11} /> Upload</>}
                    </button>
                  ))}
                </div>
              </div>

              {thumbMode === 'url' ? (
                <input
                  type="url"
                  value={customThumb.startsWith('/uploads') ? '' : customThumb}
                  onChange={e => { setCustomThumb(e.target.value); setThumbFile(null); setThumbPreviewLocal(null); }}
                  placeholder="https://… (deixe em branco para usar a do YouTube)"
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'white', border: '1px solid rgba(15,23,42,0.12)', color: '#0B1220' }}
                  onFocus={e => (e.target.style.borderColor = '#1447E6')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(15,23,42,0.12)')}
                />
              ) : (
                <div>
                  {thumbFile ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg"
                         style={{ background: '#F6F7F9', border: '1px solid rgba(15,23,42,0.08)' }}>
                      <div className="rounded-lg overflow-hidden flex-shrink-0"
                           style={{ width: 72, height: 40, background: '#E2E8F0' }}>
                        {thumbPreviewLocal && (
                          <img src={thumbPreviewLocal} alt="preview"
                               style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#0B1220' }}>{thumbFile.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#8A94A2' }}>{(thumbFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button type="button" onClick={removeThumb}
                              className="p-1.5 rounded-lg flex-shrink-0"
                              style={{ color: '#8A94A2' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm transition-all"
                            style={{ border: '2px dashed rgba(15,23,42,0.12)', color: '#8A94A2' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#1447E6'; e.currentTarget.style.color = '#1447E6'; e.currentTarget.style.background = 'rgba(82,130,255,0.04)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(15,23,42,0.12)'; e.currentTarget.style.color = '#8A94A2'; e.currentTarget.style.background = 'transparent'; }}>
                      <Upload size={15} />
                      Clique para selecionar imagem
                      <span className="text-xs opacity-70">(JPG, PNG, WebP · 10 MB)</span>
                    </button>
                  )}
                  <input ref={fileInputRef} type="file"
                         accept="image/jpeg,image/png,image/webp"
                         onChange={handleFileChange} className="hidden" />
                </div>
              )}
            </div>

            {/* Preview */}
            {thumbPreview && (
              <div className="flex items-center gap-3 p-3 rounded-xl"
                   style={{ background: '#F6F7F9', border: '1px solid rgba(15,23,42,0.06)' }}>
                <div className="rounded-lg overflow-hidden flex-shrink-0"
                     style={{ width: 112, height: 63, background: '#E2E8F0' }}>
                  <img src={thumbPreview} alt="thumbnail"
                       style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                       onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold" style={{ color: '#0B1220' }}>Prévia da thumbnail</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#8A94A2' }}>
                    {thumbSource}
                  </p>
                  {youtubeUrl && !thumbPreviewLocal && !customThumb && (
                    <a href={youtubeUrl} target="_blank" rel="noreferrer"
                       className="text-[11px] font-semibold mt-1 inline-flex items-center gap-1"
                       style={{ color: '#1447E6' }}>
                      <ExternalLink size={10} /> Abrir no YouTube
                    </a>
                  )}
                </div>
                {(thumbPreviewLocal || customThumb) && (
                  <button type="button" onClick={removeThumb}
                          className="p-1.5 rounded-lg flex-shrink-0"
                          style={{ color: '#8A94A2' }}
                          title="Remover thumbnail personalizada">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )}

            {error && (
              <p className="text-xs px-3 py-2 rounded-lg"
                 style={{ background: '#FEF2F2', color: '#dc2626', border: '1px solid #FECACA' }}>
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              {(youtubeUrl || customThumb || thumbFile) && (
                <button onClick={clearStream}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
                        style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#8A94A2' }}>
                  <Trash2 size={13} /> Limpar
                </button>
              )}
              <button onClick={saveStream} disabled={saving || uploadingThumb}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white ml-auto"
                      style={{ background: saved ? '#059669' : '#1447E6',
                               opacity: (saving || uploadingThumb) ? 0.7 : 1 }}>
                {uploadingThumb
                  ? <><Loader2 size={13} className="animate-spin" /> Enviando imagem…</>
                  : saving
                    ? <><Loader2 size={13} className="animate-spin" /> Salvando…</>
                    : saved
                      ? <><Check size={13} /> Salvo no telão!</>
                      : <><Save size={13} /> Salvar no telão</>}
              </button>
            </div>
          </div>

          {/* Telão link */}
          <div className="bg-white rounded-xl p-5" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Monitor size={16} style={{ color: '#1447E6' }} />
              <p className="font-semibold text-sm" style={{ color: '#0B1220' }}>Link do Telão</p>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg mb-3"
                 style={{ background: '#F6F7F9', border: '1px solid rgba(15,23,42,0.08)' }}>
              <code className="flex-1 font-mono-jet text-xs truncate" style={{ color: '#0B1220' }}>{telaoUrl}</code>
              <button onClick={copyLink} className="flex-shrink-0 p-1.5 rounded transition-colors hover:bg-white"
                      style={{ color: copied ? '#059669' : '#8A94A2' }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <div className="flex gap-2">
              <a href={telaoUrl} target="_blank" rel="noreferrer"
                 className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
                 style={{ background: '#1447E6' }}>
                <ExternalLink size={14} /> Abrir Telão
              </a>
              <button onClick={copyLink}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold"
                      style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563' }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado!' : 'Copiar Link'}
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(82,130,255,0.05)', border: '1px solid rgba(82,130,255,0.12)' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: '#1447E6' }}>COMO USAR O TELÃO</p>
            <ol className="text-xs flex flex-col gap-1.5" style={{ color: '#4B5563' }}>
              {[
                'Preencha o link da live do YouTube e clique em "Salvar no telão".',
                'A thumbnail é gerada automaticamente ou você pode enviar uma imagem personalizada.',
                'Copie o link do telão e abra em um navegador no computador do projetor.',
                'Para tela cheia, pressione F11 no navegador do telão.',
              ].map((tip, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono-jet font-bold flex-shrink-0"
                        style={{ color: '#1447E6' }}>{i + 1}.</span>
                  {tip}
                </li>
              ))}
            </ol>
          </div>

        </div>
      )}
    </div>
  );
}
