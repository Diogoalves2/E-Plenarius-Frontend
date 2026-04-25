'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import {
  Upload, FileText, Trash2, Check, Loader2,
  BookOpen, Download, History, ChevronDown, ChevronUp,
} from 'lucide-react';

interface Regimento {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileSize: number | null;
  version: string | null;
  isActive: boolean;
  createdAt: string;
}

const MEDIA = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace('/api', '');

export default function RegimentoPage() {
  const { user } = useAuth();
  const [active, setActive] = useState<Regimento | null>(null);
  const [all, setAll] = useState<Regimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // Formulário de upload
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const isPresidente = user?.role === 'presidente' || user?.role === 'superadmin';

  const reload = useCallback(async () => {
    if (!user?.chamberId) return;
    setLoading(true);
    try {
      const [activeRes, allRes] = await Promise.all([
        api.get(`/regimento/chamber/${user.chamberId}`).catch(() => ({ data: null })),
        isPresidente
          ? api.get(`/regimento/chamber/${user.chamberId}/all`).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
      ]);
      setActive(activeRes.data);
      setAll(allRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [user?.chamberId, isPresidente]);

  useEffect(() => { reload(); }, [reload]);

  async function handleSave() {
    if (!file || !title.trim() || !user?.chamberId) return;
    setSaving(true);
    setError('');
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      const { data: uploadData } = await api.post('/upload/pdf', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploading(false);

      await api.post(`/regimento/chamber/${user.chamberId}`, {
        title: title.trim(),
        version: version.trim() || undefined,
        description: description.trim() || undefined,
        fileUrl: uploadData.url,
        fileSize: file.size,
      });

      setTitle('');
      setVersion('');
      setDescription('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setShowUpload(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await reload();
    } catch (e: any) {
      setUploading(false);
      setError(e.response?.data?.message ?? 'Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(id: string) {
    if (!user?.chamberId) return;
    try {
      await api.patch(`/regimento/${id}/activate`, { chamberId: user.chamberId });
      await reload();
    } catch { /* silently ignore */ }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta versão do regimento interno?')) return;
    try {
      await api.delete(`/regimento/${id}`);
      await reload();
    } catch { /* silently ignore */ }
  }

  const pdfUrl = active ? `${MEDIA}${active.fileUrl}` : null;

  if (loading) return (
    <div className="p-8 flex justify-center py-24">
      <Loader2 className="animate-spin" style={{ color: '#8A94A2', width: 28, height: 28 }} />
    </div>
  );

  return (
    <div className="p-5 md:p-8 max-w-6xl">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-tight font-semibold text-gray-900"
              style={{ fontSize: 24, letterSpacing: '-0.02em' }}>
            Regimento Interno
          </h1>
          <p className="text-sm text-gray-500 mt-1">Regulamento interno da câmara municipal</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isPresidente && all.length > 1 && (
            <button
              onClick={() => setShowHistory(h => !h)}
              className="flex items-center gap-2 rounded-xl text-sm font-medium"
              style={{ padding: '10px 16px', border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563', minHeight: 44 }}>
              <History size={15} />
              Histórico ({all.length})
              {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          {isPresidente && (
            <button
              onClick={() => setShowUpload(u => !u)}
              className="flex items-center gap-2 rounded-xl text-sm font-semibold text-white"
              style={{
                padding: '10px 18px',
                background: saved ? '#059669' : 'oklch(0.52 0.16 255)',
                minHeight: 44,
              }}>
              {saved ? <><Check size={15} /> Salvo!</> : <><Upload size={15} /> {active ? 'Atualizar' : 'Cadastrar'}</>}
            </button>
          )}
        </div>
      </div>

      {/* Formulário de upload (presidente, expansível) */}
      {isPresidente && showUpload && (
        <div className="rounded-2xl p-5 mb-5 flex flex-col gap-4"
             style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
          <p className="font-semibold text-gray-800">
            {active ? 'Nova versão do Regimento' : 'Cadastrar Regimento Interno'}
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-[11px] font-semibold font-mono-jet" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>TÍTULO *</label>
              <input
                type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Regimento Interno da Câmara Municipal"
                className="rounded-xl text-sm outline-none"
                style={{ padding: '12px 14px', background: '#F6F7F9', border: '1px solid rgba(15,23,42,0.10)', color: '#0B1220' }}
                onFocus={e => e.target.style.borderColor = 'oklch(0.52 0.16 255)'}
                onBlur={e => e.target.style.borderColor = 'rgba(15,23,42,0.10)'}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold font-mono-jet" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>VERSÃO</label>
              <input
                type="text" value={version} onChange={e => setVersion(e.target.value)}
                placeholder="Ex: 2024.1"
                className="rounded-xl text-sm outline-none"
                style={{ padding: '12px 14px', background: '#F6F7F9', border: '1px solid rgba(15,23,42,0.10)', color: '#0B1220' }}
                onFocus={e => e.target.style.borderColor = 'oklch(0.52 0.16 255)'}
                onBlur={e => e.target.style.borderColor = 'rgba(15,23,42,0.10)'}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold font-mono-jet" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>OBSERVAÇÕES</label>
              <input
                type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Resumo das alterações..."
                className="rounded-xl text-sm outline-none"
                style={{ padding: '12px 14px', background: '#F6F7F9', border: '1px solid rgba(15,23,42,0.10)', color: '#0B1220' }}
                onFocus={e => e.target.style.borderColor = 'oklch(0.52 0.16 255)'}
                onBlur={e => e.target.style.borderColor = 'rgba(15,23,42,0.10)'}
              />
            </div>
          </div>

          {/* Seletor de arquivo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold font-mono-jet" style={{ color: '#8A94A2', letterSpacing: '0.06em' }}>ARQUIVO PDF *</label>
            {file ? (
              <div className="flex items-center gap-3 p-4 rounded-xl"
                   style={{ background: 'rgba(82,130,255,0.05)', border: '1px solid rgba(82,130,255,0.2)' }}>
                <FileText size={22} style={{ color: 'oklch(0.52 0.16 255)', flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{file.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button
                  onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                  style={{ padding: 8, color: '#8A94A2' }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-xl transition-colors"
                style={{ padding: '24px 16px', border: '2px dashed rgba(15,23,42,0.12)', color: '#8A94A2', minHeight: 100 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'oklch(0.52 0.16 255)'; e.currentTarget.style.color = 'oklch(0.52 0.16 255)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(15,23,42,0.12)'; e.currentTarget.style.color = '#8A94A2'; }}>
                <Upload size={24} />
                <span className="text-sm font-medium">Selecionar arquivo PDF</span>
                <span className="text-xs opacity-60">máximo 20 MB</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="application/pdf"
                   onChange={e => setFile(e.target.files?.[0] ?? null)} className="hidden" />
          </div>

          {error && (
            <p className="text-sm px-4 py-3 rounded-xl"
               style={{ background: '#FEF2F2', color: '#dc2626', border: '1px solid #FECACA' }}>{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => { setShowUpload(false); setError(''); }}
              className="flex-1 rounded-xl text-sm font-medium"
              style={{ padding: '12px', border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563', minHeight: 48 }}>
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!file || !title.trim() || saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white"
              style={{
                padding: '12px',
                background: 'oklch(0.52 0.16 255)',
                opacity: (!file || !title.trim() || saving) ? 0.5 : 1,
                minHeight: 48,
              }}>
              {uploading
                ? <><Loader2 size={15} className="animate-spin" /> Enviando PDF…</>
                : saving
                  ? <><Loader2 size={15} className="animate-spin" /> Salvando…</>
                  : <><Upload size={15} /> Salvar Regimento</>}
            </button>
          </div>
        </div>
      )}

      {/* Histórico de versões */}
      {isPresidente && showHistory && all.length > 0 && (
        <div className="rounded-2xl overflow-hidden mb-5"
             style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
            <p className="font-semibold text-gray-800 text-sm">Histórico de versões</p>
          </div>
          {all.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3 px-5"
                 style={{ padding: '14px 20px', borderBottom: i < all.length - 1 ? '1px solid rgba(15,23,42,0.06)' : 'none' }}>
              <FileText size={16} style={{ color: '#8A94A2', flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{r.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {r.version && `v${r.version} · `}
                  {new Date(r.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {r.fileSize && ` · ${(r.fileSize / 1024 / 1024).toFixed(1)} MB`}
                </p>
              </div>
              {r.isActive ? (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}>ATIVO</span>
              ) : (
                <button
                  onClick={() => handleActivate(r.id)}
                  className="text-xs rounded-lg flex-shrink-0"
                  style={{ padding: '8px 14px', border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563', minHeight: 36 }}>
                  Ativar
                </button>
              )}
              <a href={`${MEDIA}${r.fileUrl}`} target="_blank" rel="noreferrer" download
                 className="flex-shrink-0 rounded-lg flex items-center justify-center"
                 style={{ width: 36, height: 36, border: '1px solid rgba(15,23,42,0.08)', color: '#8A94A2' }}>
                <Download size={14} />
              </a>
              <button
                onClick={() => handleDelete(r.id)}
                className="flex-shrink-0 rounded-lg flex items-center justify-center"
                style={{ width: 36, height: 36, color: '#8A94A2' }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Visualizador de PDF */}
      {active ? (
        <div className="rounded-2xl overflow-hidden"
             style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
          {/* Cabeçalho do documento */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
               style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
            <div className="flex items-center gap-3">
              <BookOpen size={18} style={{ color: 'oklch(0.52 0.16 255)', flexShrink: 0 }} />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{active.title}</span>
                  {active.version && (
                    <span className="text-[11px] font-mono-jet px-2 py-0.5 rounded"
                          style={{ background: '#F0F4FF', color: 'oklch(0.52 0.16 255)' }}>
                      v{active.version}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Atualizado em {new Date(active.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {active.fileSize && ` · ${(active.fileSize / 1024 / 1024).toFixed(1)} MB`}
                  {active.description && ` · ${active.description}`}
                </p>
              </div>
            </div>
            <a
              href={pdfUrl!}
              target="_blank"
              rel="noreferrer"
              download
              className="flex items-center gap-2 rounded-xl text-sm font-semibold text-white flex-shrink-0"
              style={{ padding: '10px 18px', background: 'oklch(0.52 0.16 255)', minHeight: 44 }}>
              <Download size={15} /> Baixar PDF
            </a>
          </div>

          {/* PDF embed */}
          <div style={{ height: '72vh', minHeight: 480 }}>
            <iframe
              src={pdfUrl!}
              title={active.title}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 rounded-2xl"
             style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}>
          <FileText size={52} style={{ color: '#D1D5DB', marginBottom: 16 }} />
          <p className="font-semibold text-gray-600 text-lg">Nenhum regimento cadastrado</p>
          <p className="text-sm text-gray-400 mt-1 text-center max-w-xs">
            {isPresidente
              ? 'Clique em "Cadastrar" para fazer o upload do regimento interno em PDF.'
              : 'Aguarde o presidente cadastrar o regimento interno da câmara.'}
          </p>
        </div>
      )}
    </div>
  );
}
