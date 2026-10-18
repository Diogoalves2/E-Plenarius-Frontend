'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Printer, Loader2, FileDown, ShieldCheck, ShieldAlert } from 'lucide-react';
import { fullSessionTitle } from '@/lib/sessionTitle';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const MEDIA = API.replace(/\/api\/?$/, '');

interface Ata {
  sessao: { id: string; number: number; type: string; date: string; status: string; startedAt: string | null; endedAt: string | null };
  camara: { id: string; name: string; city: string; state: string; logoUrl: string | null; bienioInicio?: number | null; bienioFim?: number | null; anoBienio?: number | null; cadeiras: number };
  presentes: { name: string; party: string | null; role: string; confirmedAt: string }[];
  ausentes: { name: string; party: string | null; role: string }[];
  roteiro: { at: string; evento: string; por: string | null }[];
  falas: { at: string; evento: string; orador: string | null; tipo: string | null; detalhe: Record<string, any> }[];
  votacoes: {
    id: string; number: string; type: string; title: string; author: string; status: string; votingType: string;
    majorityLabel: string; openedAt: string | null; closedAt: string | null;
    counts: { sim: number; nao: number; abstencao: number } | null; requiredVotes: number | null;
    explanation: string | null; resultHash: string | null; totalVotes: number;
    nominal: { name: string; party: string | null; choice: string }[] | null; votantes: string[] | null;
  }[];
  documentHash: string;
  auditoria: { cadeiaIntegra: boolean; registrosConferidos: number; motivo: string | null };
  geradoEm: string;
}

const TYPE_LABEL: Record<string, string> = { ordinaria: 'Ordinária', extraordinaria: 'Extraordinária', solene: 'Solene', especial: 'Especial' };
const STATUS_LABEL: Record<string, string> = { aprovado: 'APROVADO', rejeitado: 'REJEITADO', pendente: 'Não votado', em_votacao: 'Em votação', retirado: 'Retirado de pauta' };
const CHOICE_LABEL: Record<string, string> = { sim: 'Sim', nao: 'Não', abstencao: 'Abstenção' };
const TIPO_FALA: Record<string, string> = { grande: 'Grande Expediente', pequeno: 'Pequeno Expediente' };

const hm = (d: string | null) => d ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
const fmt = (d: string | null) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const dur = (s: number) => `${Math.floor(s / 60)}min${s % 60 ? ` ${s % 60}s` : ''}`;
const longDate = (d: string) => new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Texto de cada evento do expediente (usado na tela e no .docx). */
function falaText(f: Ata['falas'][number]): string {
  const d = f.detalhe ?? {};
  switch (f.evento) {
    case 'fala:iniciada':
      return `Concedida a palavra a ${f.orador ?? '—'}${d.convidado ? ' (convidado)' : ''} — ${TIPO_FALA[f.tipo ?? ''] ?? 'Expediente'}, ${dur(d.duracaoSeg ?? 0)}.`;
    case 'fala:encerrada':
      return `Encerrada a fala de ${f.orador ?? '—'} após ${dur(d.usadoSeg ?? 0)} (${d.motivo === 'tempo_esgotado' ? 'tempo esgotado' : 'encerrada pelo presidente'}).`;
    case 'fala:cortada':
      return `Microfone de ${f.orador ?? '—'} cortado pela presidência.`;
    case 'aparte:iniciado':
      return `Concedido aparte a ${d.aparteante ?? f.orador ?? '—'} durante a fala de ${d.orador ?? '—'}.`;
    case 'aparte:encerrado':
      return `Encerrado o aparte; retomada a palavra por ${d.orador ?? '—'}.`;
    default:
      return f.evento;
  }
}

async function exportDocx(ata: Ata) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');
  const { saveAs } = await import('file-saver');
  const P = (text: string, opts: any = {}) => new Paragraph({ children: [new TextRun({ text, size: 22, ...opts })], spacing: { after: 80 } });
  const H = (text: string) => new Paragraph({ children: [new TextRun({ text, bold: true, size: 24 })], spacing: { before: 240, after: 120 } });
  const s = ata.sessao, c = ata.camara;

  const children: any[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.name.toUpperCase(), bold: true, size: 28 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${c.city} — ${c.state}`, size: 22, color: '64748b' })], spacing: { after: 200 } }),
    new Paragraph({ alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: `ATA DA ${fullSessionTitle(s.number, s.type, c).toUpperCase()}`, bold: true, size: 30 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: longDate(s.date), size: 22, color: '475569' })], spacing: { after: 300 } }),
    H('1. ABERTURA E ROTEIRO'),
    P(`Sessão iniciada em ${fmt(s.startedAt)} e encerrada em ${fmt(s.endedAt)}.`),
    ...ata.roteiro.map(r => P(`${hm(r.at)} — ${r.evento}`)),
    H(`2. PRESENÇA (${ata.presentes.length} presentes de ${c.cadeiras} cadeiras)`),
    ...ata.presentes.map((p, i) => P(`${i + 1}. ${p.name}${p.party ? ` (${p.party})` : ''}${p.role === 'presidente' ? ' — Presidente' : ''} — ${hm(p.confirmedAt)}`)),
    ...(ata.ausentes.length ? [P(`Ausentes: ${ata.ausentes.map(a => a.name).join(', ')}.`, { italics: true })] : []),
    H('3. EXPEDIENTE'),
    ...(ata.falas.length ? ata.falas.map(f => P(`${hm(f.at)} — ${falaText(f)}`)) : [P('Não houve oradores inscritos.', { italics: true })]),
    H('4. ORDEM DO DIA'),
    ...ata.votacoes.flatMap((v, i) => [
      P(`${i + 1}. ${v.number} — ${v.type}: ${v.title} (autoria: ${v.author})`, { bold: true }),
      P(`${STATUS_LABEL[v.status] ?? v.status}. Votação ${v.votingType}, ${v.majorityLabel}.${v.explanation ? ` ${v.explanation}` : ''}`),
      ...(v.nominal ? [P(`Votos: ${v.nominal.map(n => `${n.name} — ${CHOICE_LABEL[n.choice] ?? n.choice}`).join('; ')}.`)] : []),
      ...(v.votantes ? [P(`Votaram (escrutínio secreto): ${v.votantes.join(', ')}.`)] : []),
      ...(v.resultHash ? [P(`Hash do resultado: ${v.resultHash}`, { size: 16, color: '64748b', font: 'Courier New' })] : []),
    ]),
    new Paragraph({ children: [], spacing: { after: 360 } }),
    P('Nada mais havendo a tratar, o Presidente encerrou a sessão. Eu, Secretário(a), lavrei a presente ata que, lida e aprovada, vai assinada.', { italics: true, color: '475569' }),
    new Paragraph({ children: [], spacing: { after: 720 } }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '________________________       ________________________', size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Presidente da Câmara                    Secretário(a)', size: 20, color: '64748b' })] }),
    new Paragraph({ children: [], spacing: { after: 360 } }),
    P(`Hash do documento (SHA-256): ${ata.documentHash}`, { size: 16, color: '64748b', font: 'Courier New' }),
    P(`Gerado pelo E-Plenarius em ${new Date(ata.geradoEm).toLocaleString('pt-BR')}. Conferência: ${API}/sessions/${s.id}/ata`, { size: 16, color: '94a3b8' }),
  ];
  const doc = new Document({ sections: [{ properties: {}, children }] });
  saveAs(await Packer.toBlob(doc), `ata-sessao-${s.number}.docx`);
}

export default function AtaPage() {
  const { id } = useParams<{ id: string }>();
  const [ata, setAta] = useState<Ata | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/sessions/${id}/ata`);
      if (r.ok) setAta(await r.json());
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (ata) document.title = `Ata — ${fullSessionTitle(ata.sessao.number, ata.sessao.type, ata.camara)}`;
  }, [ata]);

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 size={24} className="animate-spin text-gray-400" /></div>;
  if (!ata) return <div className="p-8 text-center text-gray-400">Sessão não encontrada</div>;

  const { sessao: s, camara: c } = ata;
  const realizadas = ata.votacoes.filter(v => v.counts);

  return (
    <div style={{ fontFamily: 'Georgia, serif', minHeight: '100vh', background: '#fff' }}>
      <div className="print:hidden flex flex-wrap items-center justify-end gap-2 p-4 border-b" style={{ borderColor: '#e5e7eb' }}>
        {s.status !== 'encerrada' && (
          <span className="mr-auto text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: '#FEF3C7', color: '#92400e' }}>
            Sessão em andamento — a ata ainda vai mudar
          </span>
        )}
        <button onClick={async () => { setExporting(true); try { await exportDocx(ata); } finally { setExporting(false); } }}
                disabled={exporting} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563', opacity: exporting ? 0.6 : 1 }}>
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} Exportar DOCX
        </button>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#1447E6' }}>
          <Printer size={15} /> Imprimir / PDF
        </button>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36, borderBottom: '2px solid #1e293b', paddingBottom: 24 }}>
          {c.logoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={`${MEDIA}${c.logoUrl}`} alt={c.name} style={{ height: 64, objectFit: 'contain', marginBottom: 12, display: 'inline-block' }} />
          )}
          <p style={{ fontSize: 11, letterSpacing: '0.12em', color: '#64748b', marginBottom: 6 }}>
            {`${c.name.toUpperCase()} — ${c.city.toUpperCase()}/${c.state.toUpperCase()}`}
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
            ATA DA {fullSessionTitle(s.number, s.type, c).toUpperCase()}
          </h1>
          <p style={{ fontSize: 13, color: '#475569' }}>{longDate(s.date)}</p>
        </div>

        <Section title="1. ABERTURA E ROTEIRO">
          <Row label="Sessão" value={`${s.number}ª ${TYPE_LABEL[s.type] ?? s.type}`} />
          <Row label="Início" value={fmt(s.startedAt)} />
          <Row label="Encerramento" value={fmt(s.endedAt)} />
          {ata.roteiro.length > 0 && (
            <table style={tableStyle}>
              <tbody>
                {ata.roteiro.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ ...td, width: 70, color: '#64748b' }}>{hm(r.at)}</td>
                    <td style={td}>{r.evento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title={`2. PRESENÇA (${ata.presentes.length} presente${ata.presentes.length !== 1 ? 's' : ''} de ${c.cadeiras} cadeiras)`}>
          {ata.presentes.length === 0 ? <Muted>Nenhuma presença registrada</Muted> : (
            <ol style={{ margin: 0, padding: '0 0 0 18px', fontSize: 13, lineHeight: 1.9 }}>
              {ata.presentes.map((p, i) => (
                <li key={i}>
                  <strong>{p.name}</strong>{p.party ? ` (${p.party})` : ''}{p.role === 'presidente' ? ' — Presidente' : ''}
                  <span style={{ color: '#94a3b8' }}> · {hm(p.confirmedAt)}</span>
                </li>
              ))}
            </ol>
          )}
          {ata.ausentes.length > 0 && (
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 10 }}>
              <strong>Ausentes:</strong> {ata.ausentes.map(a => `${a.name}${a.party ? ` (${a.party})` : ''}`).join(', ')}.
            </p>
          )}
        </Section>

        <Section title="3. EXPEDIENTE">
          {ata.falas.length === 0 ? <Muted>Não houve oradores inscritos.</Muted> : (
            <table style={tableStyle}>
              <tbody>
                {ata.falas.map((f, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ ...td, width: 70, color: '#64748b', verticalAlign: 'top' }}>{hm(f.at)}</td>
                    <td style={td}>{falaText(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="4. ORDEM DO DIA">
          {ata.votacoes.length === 0 ? <Muted>Nenhum item na pauta</Muted> : ata.votacoes.map((v, i) => (
            <div key={v.id} style={{ marginBottom: 22, paddingBottom: 18, borderBottom: i < ata.votacoes.length - 1 ? '1px solid #f1f5f9' : 'none', breakInside: 'avoid' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>{i + 1}. {v.number} — {v.type}</p>
              <p style={{ fontSize: 13, color: '#1e293b', marginBottom: 3 }}>{v.title}</p>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                Autoria: {v.author} · Votação {v.votingType} · {v.majorityLabel}
                {v.openedAt ? ` · ${hm(v.openedAt)}–${hm(v.closedAt)}` : ''}
              </p>
              {v.counts ? (
                <div style={{ padding: '8px 12px', borderRadius: 6, background: v.status === 'aprovado' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${v.status === 'aprovado' ? '#bbf7d0' : '#fecaca'}` }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: v.status === 'aprovado' ? '#15803d' : '#dc2626', margin: 0 }}>
                    {STATUS_LABEL[v.status]}
                  </p>
                  <p style={{ fontSize: 12, color: '#475569', margin: '4px 0 0' }}>
                    {v.explanation ?? `Sim: ${v.counts.sim} · Não: ${v.counts.nao} · Abstenção: ${v.counts.abstencao}`}
                  </p>
                  {v.nominal && v.nominal.length > 0 && (
                    <table style={{ ...tableStyle, marginTop: 8 }}>
                      <tbody>
                        {v.nominal.map((n, j) => (
                          <tr key={j} style={{ borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
                            <td style={td}>{n.name}{n.party ? ` (${n.party})` : ''}</td>
                            <td style={{ ...td, width: 90, fontWeight: 700, color: n.choice === 'sim' ? '#15803d' : n.choice === 'nao' ? '#dc2626' : '#64748b' }}>
                              {CHOICE_LABEL[n.choice] ?? n.choice}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {v.votantes && (
                    <p style={{ fontSize: 11, color: '#64748b', margin: '6px 0 0' }}>
                      Escrutínio secreto — votaram ({v.votantes.length}): {v.votantes.join(', ')}.
                    </p>
                  )}
                  {v.resultHash && (
                    <p style={{ fontSize: 10, color: '#94a3b8', margin: '6px 0 0', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      Hash do resultado: {v.resultHash}
                    </p>
                  )}
                </div>
              ) : <Muted>{STATUS_LABEL[v.status] ?? v.status}</Muted>}
            </div>
          ))}
        </Section>

        {realizadas.length > 0 && (
          <Section title="5. RESUMO DAS DELIBERAÇÕES">
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Nº', 'Matéria', 'Maioria', 'Sim', 'Não', 'Abs.', 'Resultado'].map(h => (
                    <th key={h} style={{ ...td, textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {realizadas.map(v => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ ...td, color: '#64748b' }}>{v.number}</td>
                    <td style={{ ...td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</td>
                    <td style={{ ...td, color: '#64748b' }}>{v.majorityLabel}</td>
                    <td style={{ ...td, color: '#15803d', fontWeight: 600 }}>{v.counts!.sim}</td>
                    <td style={{ ...td, color: '#dc2626', fontWeight: 600 }}>{v.counts!.nao}</td>
                    <td style={{ ...td, color: '#64748b' }}>{v.counts!.abstencao}</td>
                    <td style={{ ...td, fontWeight: 700, color: v.status === 'aprovado' ? '#15803d' : '#dc2626' }}>{STATUS_LABEL[v.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        <div style={{ marginTop: 50, paddingTop: 20, borderTop: '1px solid #e2e8f0', breakInside: 'avoid' }}>
          <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 48 }}>
            Nada mais havendo a tratar, o Presidente encerrou a sessão. Eu, Secretário(a), lavrei a presente ata que, lida e aprovada, vai assinada.
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <SignatureLine label="Presidente da Câmara" />
            <SignatureLine label="Secretário(a)" />
          </div>
        </div>

        <div style={{ marginTop: 36, padding: '12px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', breakInside: 'avoid' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            {ata.auditoria.cadeiaIntegra
              ? <><ShieldCheck size={14} color="#059669" /> Registro íntegro — {ata.auditoria.registrosConferidos} eventos de auditoria conferidos</>
              : <><ShieldAlert size={14} color="#dc2626" /> Alerta: auditoria com inconsistência ({ata.auditoria.motivo})</>}
          </p>
          <p style={{ fontSize: 10, color: '#64748b', margin: '6px 0 0', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            Hash do documento (SHA-256): {ata.documentHash}
          </p>
          <p style={{ fontSize: 10, color: '#94a3b8', margin: '4px 0 0' }}>
            Gerado pelo E-Plenarius em {new Date(ata.geradoEm).toLocaleString('pt-BR')}. Conferência pública: {API}/sessions/{s.id}/ata
          </p>
        </div>
        <p className="print:hidden" style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 16 }}>
          Para assinatura digital: salve como PDF e assine em assinador.iti.br (gov.br) ou com certificado ICP-Brasil.
        </p>
      </div>

      <style>{`
        @media print {
          body { margin: 0; }
          .print\\:hidden { display: none !important; }
          @page { margin: 18mm; size: A4; }
        }
      `}</style>
    </div>
  );
}

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 8 };
const td: React.CSSProperties = { padding: '5px 8px', color: '#1e293b' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', letterSpacing: '0.04em', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #e2e8f0' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: '#64748b', minWidth: 120, flexShrink: 0 }}>{label}:</span>
      <span style={{ color: '#1e293b', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>{children}</p>;
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center', width: 200 }}>
      <div style={{ borderBottom: '1px solid #1e293b', height: 40, marginBottom: 8 }} />
      <p style={{ fontSize: 11, color: '#475569' }}>{label}</p>
    </div>
  );
}
