'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Printer, Loader2, FileDown } from 'lucide-react';
import { fullSessionTitle } from '@/lib/sessionTitle';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Session {
  id: string; number: number; type: string; date: string;
  startedAt: string | null; endedAt: string | null; status: string;
  chamberId: string;
}

interface Chamber {
  id: string; name: string; city: string; state: string; logoUrl: string | null;
  bienioInicio?: number | null; bienioFim?: number | null; anoBienio?: number | null;
}

interface Presence {
  userId: string;
  user: { id: string; name: string; party: string | null; title: string | null; role: string };
}

interface AgendaItem {
  id: string; number: string; type: string; title: string; authorName: string;
  status: string; votingType: string; votesYes: number; votesNo: number; votesAbstain: number;
  votingOpenedAt: string | null; votingClosedAt: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  ordinaria: 'Ordinária', extraordinaria: 'Extraordinária', solene: 'Solene', especial: 'Especial',
};
const STATUS_LABEL: Record<string, string> = {
  aprovado: 'APROVADO', rejeitado: 'REPROVADO', pendente: 'Pendente', em_votacao: 'Em votação',
  retirado: 'Retirado',
};

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function exportDocx(session: Session, chamber: Chamber | null, presences: Presence[], agenda: AgendaItem[]) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } = await import('docx');
  const { saveAs } = await import('file-saver');

  const TYPE_LABEL: Record<string, string> = { ordinaria: 'Ordinária', extraordinaria: 'Extraordinária', solene: 'Solene', especial: 'Especial' };
  const vereadores = presences.filter(p => p.user.role === 'vereador' || p.user.role === 'presidente');

  const children: any[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: chamber?.name?.toUpperCase() ?? 'CÂMARA MUNICIPAL', bold: true, size: 28 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: chamber ? `${chamber.city} — ${chamber.state}` : '', size: 22, color: '64748b' })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({
        text: `ATA DA ${session.number}ª SESSÃO ${(TYPE_LABEL[session.type] ?? session.type).toUpperCase()}`,
        bold: true, size: 32,
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: new Date(session.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
        size: 24, color: '475569',
      })],
      spacing: { after: 400 },
    }),
    new Paragraph({ children: [new TextRun({ text: '1. VERIFICAÇÃO DE PRESENÇA', bold: true, size: 24 })], spacing: { after: 160 } }),
    ...vereadores.map((p, i) => new Paragraph({
      children: [new TextRun({
        text: `${i + 1}. ${p.user.name}${p.user.party ? ` (${p.user.party})` : ''}${p.user.role === 'presidente' ? ' — Presidente' : ''}`,
        size: 22,
      })],
    })),
    new Paragraph({ children: [], spacing: { after: 240 } }),
    new Paragraph({ children: [new TextRun({ text: '2. ORDEM DO DIA', bold: true, size: 24 })], spacing: { after: 160 } }),
    ...agenda.map((item, i) => new Paragraph({
      children: [new TextRun({
        text: `${i + 1}. ${item.number} — ${item.title} (${item.status === 'aprovado' ? 'APROVADO' : item.status === 'rejeitado' ? 'REPROVADO' : 'Pendente'})`,
        size: 22,
      })],
      spacing: { after: 120 },
    })),
    new Paragraph({ children: [], spacing: { after: 480 } }),
    new Paragraph({ children: [new TextRun({ text: 'Encerrada a sessão, eu, Secretário(a), lavrei a presente ata que, aprovada, vai por mim assinada.', size: 20, color: '64748b', italics: true })], spacing: { after: 960 } }),
    new Paragraph({ children: [new TextRun({ text: '________________________       ________________________', size: 22 })], alignment: AlignmentType.CENTER }),
    new Paragraph({ children: [new TextRun({ text: 'Presidente da Câmara                    Secretário(a)', size: 20, color: '64748b' })], alignment: AlignmentType.CENTER }),
    new Paragraph({ children: [], spacing: { after: 480 } }),
    new Paragraph({ children: [new TextRun({ text: `Gerado automaticamente pelo E-Plenarius em ${new Date().toLocaleString('pt-BR')}`, size: 18, color: 'cbd5e1' })], alignment: AlignmentType.CENTER }),
  ];

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `ata-sessao-${session.number}.docx`);
}

export default function AtaPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [chamber, setChamber] = useState<Chamber | null>(null);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingDocx, setExportingDocx] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sRes, pRes, aRes] = await Promise.all([
        fetch(`${API}/sessions/${id}`),
        fetch(`${API}/sessions/${id}/presences`),
        fetch(`${API}/agenda/session/${id}`),
      ]);
      if (sRes.ok) {
        const s: Session = await sRes.json();
        setSession(s);
        if (s.chamberId) {
          const cRes = await fetch(`${API}/chambers/${s.chamberId}`);
          if (cRes.ok) setChamber(await cRes.json());
        }
      }
      if (pRes.ok) setPresences(await pRes.json());
      if (aRes.ok) setAgenda(await aRes.json());
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!loading && session) {
      document.title = `Ata — ${fullSessionTitle(session.number, session.type, chamber)}`;
    }
  }, [loading, session]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!session) {
    return <div className="p-8 text-center text-gray-400">Sessão não encontrada</div>;
  }

  const vereadores = presences.filter(p => p.user.role === 'vereador' || p.user.role === 'presidente');
  const votacoesRealizadas = agenda.filter(i => i.status === 'aprovado' || i.status === 'rejeitado');

  return (
    <div style={{ fontFamily: 'Georgia, serif', minHeight: '100vh', background: '#fff' }}>

      {/* Botão imprimir — oculto na impressão */}
      <div className="print:hidden flex justify-end gap-2 p-4 border-b" style={{ borderColor: '#e5e7eb' }}>
        <button
          onClick={async () => {
            if (!session) return;
            setExportingDocx(true);
            try { await exportDocx(session, chamber, presences, agenda); }
            finally { setExportingDocx(false); }
          }}
          disabled={exportingDocx}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity"
          style={{ border: '1px solid rgba(15,23,42,0.12)', color: '#4B5563', opacity: exportingDocx ? 0.6 : 1 }}>
          {exportingDocx ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
          Exportar DOCX
        </button>
        <button onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: '#1447E6' }}>
          <Printer size={15} /> Imprimir / PDF
        </button>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 40px' }}>

        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', marginBottom: 40, borderBottom: '2px solid #1e293b', paddingBottom: 24 }}>
          {chamber?.logoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`${API.replace('/api', '')}${chamber.logoUrl}`}
              alt={chamber.name}
              style={{ height: 64, objectFit: 'contain', marginBottom: 12 }}
            />
          )}
          <p style={{ fontSize: 11, letterSpacing: '0.12em', color: '#64748b', marginBottom: 6 }}>
            {chamber ? `${chamber.name.toUpperCase()} — ${chamber.city.toUpperCase()}/${chamber.state.toUpperCase()}` : ''}
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
            ATA DA {fullSessionTitle(session.number, session.type, chamber).toUpperCase()}
          </h1>
          <p style={{ fontSize: 13, color: '#475569' }}>
            {new Date(session.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Informações da sessão */}
        <Section title="1. INFORMAÇÕES DA SESSÃO">
          <Row label="Número" value={`${session.number}ª Sessão`} />
          <Row label="Tipo" value={TYPE_LABEL[session.type] ?? session.type} />
          <Row label="Data" value={new Date(session.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
          <Row label="Início" value={fmt(session.startedAt)} />
          <Row label="Encerramento" value={fmt(session.endedAt)} />
          <Row label="Situação" value={session.status === 'encerrada' ? 'Encerrada' : session.status === 'em_andamento' ? 'Em andamento' : 'Agendada'} />
        </Section>

        {/* Presença */}
        <Section title={`2. VERIFICAÇÃO DE PRESENÇA (${vereadores.length} presente${vereadores.length !== 1 ? 's' : ''})`}>
          {vereadores.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>Nenhuma presença registrada</p>
          ) : (
            <ol style={{ margin: 0, padding: '0 0 0 18px', fontSize: 13, lineHeight: 2 }}>
              {vereadores.map((p, i) => (
                <li key={p.userId}>
                  <strong>{p.user.name}</strong>
                  {p.user.party ? ` (${p.user.party})` : ''}
                  {p.user.role === 'presidente' ? ' — Presidente' : ''}
                </li>
              ))}
            </ol>
          )}
        </Section>

        {/* Ordem do dia */}
        <Section title="3. ORDEM DO DIA">
          {agenda.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>Nenhum item na pauta</p>
          ) : (
            agenda.map((item, i) => (
              <div key={item.id} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: i < agenda.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  {i + 1}. {item.number} — {item.type}
                </p>
                <p style={{ fontSize: 13, color: '#1e293b', marginBottom: 4 }}>{item.title}</p>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Autoria: {item.authorName}</p>
                {(item.status === 'aprovado' || item.status === 'rejeitado') && (
                  <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6,
                                background: item.status === 'aprovado' ? '#f0fdf4' : '#fef2f2',
                                border: `1px solid ${item.status === 'aprovado' ? '#bbf7d0' : '#fecaca'}` }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: item.status === 'aprovado' ? '#15803d' : '#dc2626', margin: 0 }}>
                      Resultado: {STATUS_LABEL[item.status]}
                    </p>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
                      Votação {item.votingType === 'aberta' ? 'aberta' : 'secreta'} ·
                      Sim: {item.votesYes ?? 0} · Não: {item.votesNo ?? 0} · Abstenção: {item.votesAbstain ?? 0}
                    </p>
                  </div>
                )}
                {item.status === 'pendente' && (
                  <p style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Item não votado</p>
                )}
                {item.status === 'retirado' && (
                  <p style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Item retirado de pauta</p>
                )}
              </div>
            ))
          )}
        </Section>

        {/* Resumo das votações */}
        {votacoesRealizadas.length > 0 && (
          <Section title="4. RESUMO DAS DELIBERAÇÕES">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Nº', 'Título', 'Sim', 'Não', 'Abs.', 'Resultado'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {votacoesRealizadas.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 8px', color: '#64748b' }}>{item.number}</td>
                    <td style={{ padding: '6px 8px', color: '#1e293b', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</td>
                    <td style={{ padding: '6px 8px', color: '#15803d', fontWeight: 600 }}>{item.votesYes ?? 0}</td>
                    <td style={{ padding: '6px 8px', color: '#dc2626', fontWeight: 600 }}>{item.votesNo ?? 0}</td>
                    <td style={{ padding: '6px 8px', color: '#64748b' }}>{item.votesAbstain ?? 0}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: item.status === 'aprovado' ? '#15803d' : '#dc2626' }}>
                      {STATUS_LABEL[item.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Assinaturas */}
        <div style={{ marginTop: 60, paddingTop: 20, borderTop: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 48 }}>
            Encerrada a sessão, eu, Secretário(a), lavrei a presente ata que, aprovada, vai por mim assinada.
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <SignatureLine label="Presidente da Câmara" />
            <SignatureLine label="Secretário(a)" />
          </div>
        </div>

        <p style={{ fontSize: 10, color: '#cbd5e1', textAlign: 'center', marginTop: 40 }}>
          Gerado automaticamente pelo E-Plenarius em {new Date().toLocaleString('pt-BR')}
        </p>
      </div>

      <style>{`
        @media print {
          body { margin: 0; }
          .print\\:hidden { display: none !important; }
          @page { margin: 20mm; size: A4; }
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', letterSpacing: '0.04em', marginBottom: 12,
                   paddingBottom: 6, borderBottom: '1px solid #e2e8f0' }}>
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

function SignatureLine({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center', width: 200 }}>
      <div style={{ borderBottom: '1px solid #1e293b', height: 40, marginBottom: 8 }} />
      <p style={{ fontSize: 11, color: '#475569' }}>{label}</p>
    </div>
  );
}
