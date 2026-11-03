'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, FileWarning } from 'lucide-react';

/**
 * Leitor de PDF usado DENTRO do app dos tablets (WebView): renderiza as páginas com pdf.js,
 * sem abrir navegador nem outro aplicativo. Só abre PDFs enviados ao próprio sistema
 * (/uploads/*.pdf da API) — não serve de visualizador para endereços de fora.
 */
const MEDIA = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');
const SAFE_PATH = /^\/uploads\/[\w.-]+\.pdf$/i;

export default function LeitorPdfPage() {
  return (
    <Suspense fallback={<Center><Loader2 className="animate-spin" color="#94A3B8" /></Center>}>
      <Leitor />
    </Suspense>
  );
}

function Leitor() {
  const params = useSearchParams();
  const src = params.get('src') ?? '';
  const valid = SAFE_PATH.test(src);
  const box = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);
  const [current, setCurrent] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    let doc: any = null;
    const observers: IntersectionObserver[] = [];

    (async () => {
      try {
        const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
        // Arquivos de até 20 MB: download inteiro (sem requisições parciais, que exigiriam mais CORS)
        doc = await pdfjs.getDocument({ url: `${MEDIA}${src}`, disableRange: true, disableStream: true }).promise;
        if (cancelled) return;
        setPages(doc.numPages);
        const host = box.current!;
        host.innerHTML = '';
        const width = host.clientWidth;
        // Nitidez também ao ampliar com os dedos (limitado para não pesar no tablet)
        const quality = Math.min((window.devicePixelRatio || 1) * 1.25, 2.5);

        const render = async (n: number, canvas: HTMLCanvasElement) => {
          if (canvas.dataset.state) return;
          canvas.dataset.state = 'loading';
          const page = await doc.getPage(n);
          if (canvas.dataset.state !== 'loading') return; // liberada enquanto carregava
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: (width / base.width) * quality });
          canvas.width = Math.floor(vp.width);
          canvas.height = Math.floor(vp.height);
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
          canvas.dataset.state = 'done';
        };
        // Página longe da tela devolve a memória (uma página nítida ocupa ~10–20 MB)
        const release = (canvas: HTMLCanvasElement) => {
          if (!canvas.dataset.state) return;
          delete canvas.dataset.state;
          canvas.width = 0;
          canvas.height = 0;
        };

        // 1º monta todas as páginas vazias (com a proporção certa), só depois observa:
        // senão cada página recém-criada "está na tela" e o documento inteiro seria desenhado.
        const canvases: HTMLCanvasElement[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const vp = (await doc.getPage(n)).getViewport({ scale: 1 });
          if (cancelled) return;
          const wrap = document.createElement('div');
          wrap.className = 'pdf-page';
          wrap.dataset.n = String(n);
          wrap.style.aspectRatio = `${vp.width} / ${vp.height}`;
          const canvas = document.createElement('canvas');
          wrap.appendChild(canvas);
          host.appendChild(wrap);
          canvases.push(canvas);
        }

        const near = new IntersectionObserver(entries => {
          for (const e of entries) {
            const n = Number((e.target as HTMLElement).dataset.n);
            const canvas = canvases[n - 1];
            if (e.isIntersecting) render(n, canvas).catch(() => { delete canvas.dataset.state; });
            else release(canvas);
          }
        }, { rootMargin: '1200px 0px' });
        const visible = new IntersectionObserver(entries => {
          for (const e of entries) if (e.isIntersecting) setCurrent(Number((e.target as HTMLElement).dataset.n));
        }, { threshold: 0.5 });
        for (const c of canvases) { near.observe(c.parentElement!); visible.observe(c.parentElement!); }
        observers.push(near, visible);
      } catch {
        if (!cancelled) setError('Não foi possível abrir o documento.');
      }
    })();

    return () => {
      cancelled = true;
      observers.forEach(o => o.disconnect());
      doc?.destroy?.();
    };
  }, [src, valid]);

  if (!valid) {
    return <Center><FileWarning color="#94A3B8" size={32} /><p>Documento inválido.</p></Center>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#E9EDF2' }}>
      <style>{`
        .pdf-page { position: relative; width: 100%; background: #fff; margin: 0 auto 12px; box-shadow: 0 1px 3px rgba(15,23,42,.12); }
        .pdf-page canvas { width: 100%; height: 100%; display: block; }
      `}</style>
      {pages > 0 && (
        <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
                      background: 'rgba(11,18,32,.82)', color: '#fff', fontSize: 13, fontWeight: 600,
                      padding: '6px 14px', borderRadius: 999, fontFamily: 'Inter, system-ui, sans-serif' }}>
          {current} / {pages}
        </div>
      )}
      {error ? (
        <Center><FileWarning color="#94A3B8" size={32} /><p>{error}</p></Center>
      ) : (
        <>
          {pages === 0 && <Center><Loader2 className="animate-spin" color="#94A3B8" /><p>Carregando documento…</p></Center>}
          <div ref={box} style={{ maxWidth: 900, margin: '0 auto', padding: 12 }} />
        </>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 10, color: '#64748B', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14 }}>
      {children}
    </div>
  );
}
