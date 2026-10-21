'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Check, ArrowUp, ArrowDown, Trash2, Plus, RotateCcw } from 'lucide-react';
import api from '@/lib/api';
import { MfaCard } from '@/components/auth/MfaCard';
import {
  DEFAULT_PHASES, TIPOS_PROJETO, MAJORITY_LABEL, MAJORITY_HELP, PRESIDENT_RULE_LABEL, requiredVotes, useChamberRules,
  type Majority, type PresidentVoteRule, type SessionPhase,
} from '@/lib/legislativo';


const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const { rules, setRules } = useChamberRules(user?.chamberId);
  const [seats, setSeats] = useState('');
  const [presidentRule, setPresidentRule] = useState<PresidentVoteRule>('always');
  const [quorum, setQuorum] = useState('');
  const [byType, setByType] = useState<Record<string, Majority>>({});
  const [requirePin, setRequirePin] = useState(false);
  const [autoMic, setAutoMic] = useState(false);
  const [phases, setPhases] = useState<SessionPhase[]>(DEFAULT_PHASES);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!rules) return;
    setSeats(rules.seatsConfigured ? String(rules.seats) : '');
    setPresidentRule(rules.presidentVoteRule);
    setQuorum(String(rules.defaultQuorum));
    setByType(rules.majorityByType ?? {});
    setRequirePin(rules.requirePinToVote);
    setAutoMic(rules.autoOpenMic);
    setPhases(rules.sessionPhases);
  }, [rules]);

  const effectiveSeats = Number(seats) || rules?.seats || 0;

  async function save() {
    if (!user?.chamberId) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      const { data } = await api.patch(`/chambers/${user.chamberId}/settings`, {
        totalSeats: seats ? Number(seats) : null,
        presidentVoteRule: presidentRule,
        defaultQuorum: quorum ? Number(quorum) : null,
        majorityByType: Object.fromEntries(Object.entries(byType).filter(([, m]) => m !== 'simples')),
        requirePinToVote: requirePin,
        autoOpenMic: autoMic,
        sessionPhases: phases.map(p => ({ key: p.key, label: p.label.trim() || p.key })),
      });
      setRules(data);
      setSaved(true);
    } catch (err: any) {
      const m = err.response?.data?.message;
      setError(Array.isArray(m) ? m.join(' · ') : m || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  function movePhase(i: number, d: -1 | 1) {
    setPhases(ps => {
      const n = [...ps]; const j = i + d;
      if (j < 0 || j >= n.length) return ps;
      [n[i], n[j]] = [n[j], n[i]]; return n;
    });
  }

  if (!rules) {
    return <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin" style={{ color: '#8A94A2' }} /></div>;
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      {user?.role === 'presidente' && <MfaCard />}
      <h2 className="font-tight font-semibold text-2xl" style={{ color: '#0B1220', letterSpacing: '-0.02em' }}>Regras do regimento</h2>
      <p className="text-sm mt-1 mb-6" style={{ color: '#8A94A2' }}>
        Ajuste conforme o Regimento Interno e a Lei Orgânica da câmara. As regras valem para as próximas votações.
      </p>

      <Card title="COMPOSIÇÃO E QUÓRUM">
        <div className="grid sm:grid-cols-2 gap-4">
          <Label text="Cadeiras da Casa" help={`Base da maioria absoluta e de 2/3. Em branco = membros ativos cadastrados (${rules.seatsConfigured ? '—' : rules.seats}).`}>
            <input type="number" min={3} max={99} value={seats} onChange={e => setSeats(e.target.value)} placeholder={String(rules.seats)} style={iStyle} className={iCls} />
          </Label>
          <Label text="Quórum padrão para votar" help="Mínimo de membros presentes para abrir uma votação (pode ser ajustado por matéria).">
            <input type="number" min={1} max={99} value={quorum} onChange={e => setQuorum(e.target.value)} style={iStyle} className={iCls} />
          </Label>
        </div>
        <p className="text-xs mt-3" style={{ color: '#4B5563' }}>
          Com {effectiveSeats} cadeiras: maioria absoluta = <b>{requiredVotes('absoluta', effectiveSeats)}</b> votos · dois terços = <b>{requiredVotes('dois_tercos', effectiveSeats)}</b> votos.
        </p>
      </Card>

      <Card title="VOTO DO PRESIDENTE">
        <div className="flex flex-col gap-2">
          {(Object.keys(PRESIDENT_RULE_LABEL) as PresidentVoteRule[]).map(r => (
            <label key={r} className="flex items-center gap-2.5 text-sm cursor-pointer" style={{ color: '#0B1220' }}>
              <input type="radio" name="prule" checked={presidentRule === r} onChange={() => setPresidentRule(r)} />
              {PRESIDENT_RULE_LABEL[r]}
            </label>
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: '#8A94A2' }}>
          Em caso de empate em maioria simples, o sistema só deixa encerrar depois que o presidente votar (exceto na opção “todas as matérias”).
        </p>
      </Card>

      <Card title="MAIORIA PADRÃO POR TIPO DE MATÉRIA">
        <p className="text-xs mb-3" style={{ color: '#8A94A2' }}>Preenche o formulário da pauta automaticamente; pode ser alterada em cada item.</p>
        <div className="flex flex-col divide-y" style={{ borderColor: 'rgba(15,23,42,0.06)' }}>
          {TIPOS_PROJETO.map(t => (
            <div key={t} className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm" style={{ color: '#0B1220' }}>{t}</span>
              <select value={byType[t] ?? 'simples'} onChange={e => setByType(b => ({ ...b, [t]: e.target.value as Majority }))}
                      style={iStyle} className="px-2.5 py-1.5 rounded-lg text-sm outline-none" title={MAJORITY_HELP[byType[t] ?? 'simples']}>
                {(Object.keys(MAJORITY_LABEL) as Majority[]).map(m => <option key={m} value={m}>{MAJORITY_LABEL[m]}</option>)}
              </select>
            </div>
          ))}
        </div>
      </Card>

      <Card title="SEGURANÇA E PLENÁRIO">
        <Toggle checked={requirePin} onChange={setRequirePin} label="Confirmar cada voto com o PIN do vereador"
                help="Ao tocar em SIM/NÃO/ABSTER, o vereador digita o PIN. Impede voto em tablet deixado aberto." />
        <Toggle checked={autoMic} onChange={setAutoMic} label="Microfone automático"
                help="Liberar o tempo de fala abre o canal do orador na mesa de som; encerrar fecha. Requer o bridge atualizado e canal cadastrado em Vereadores." />
      </Card>

      <Card title="ROTEIRO DA SESSÃO">
        <p className="text-xs mb-3" style={{ color: '#8A94A2' }}>Fases que o presidente percorre no painel. Ficam registradas com horário na ata.</p>
        <div className="flex flex-col gap-2">
          {phases.map((p, i) => (
            <div key={p.key} className="flex items-center gap-2">
              <span className="font-mono-jet text-xs w-6 text-right" style={{ color: '#8A94A2' }}>{i + 1}</span>
              <input value={p.label} onChange={e => setPhases(ps => ps.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                     style={iStyle} className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" maxLength={80} />
              <IconBtn onClick={() => movePhase(i, -1)} title="Subir"><ArrowUp size={14} /></IconBtn>
              <IconBtn onClick={() => movePhase(i, 1)} title="Descer"><ArrowDown size={14} /></IconBtn>
              <IconBtn onClick={() => setPhases(ps => ps.filter((_, j) => j !== i))} title="Remover"><Trash2 size={14} /></IconBtn>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-3">
          <button onClick={() => {
            const label = prompt('Nome da nova fase:');
            if (!label?.trim()) return;
            let key = slug(label) || 'fase'; while (phases.some(p => p.key === key)) key += '_2';
            setPhases(ps => [...ps, { key, label: label.trim() }]);
          }} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#1447E6' }}><Plus size={13} /> Adicionar fase</button>
          <button onClick={() => setPhases(DEFAULT_PHASES)} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#8A94A2' }}>
            <RotateCcw size={13} /> Restaurar padrão
          </button>
        </div>
      </Card>

      {error && <div className="px-4 py-3 rounded-xl mb-4 text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>{error}</div>}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: '#1447E6', opacity: saving ? 0.7 : 1, minHeight: 44 }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvar regras
        </button>
        {saved && <span className="text-sm font-semibold" style={{ color: '#059669' }}>Regras salvas.</span>}
      </div>
    </div>
  );
}

const iStyle: React.CSSProperties = { border: '1px solid rgba(15,23,42,0.12)', background: '#fff', color: '#0B1220' };
const iCls = 'w-full px-3.5 py-2.5 rounded-lg text-sm outline-none';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-5 mb-5" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
      <p className="font-mono-jet text-[10px] font-semibold mb-3" style={{ color: '#8A94A2', letterSpacing: '0.08em' }}>{title}</p>
      {children}
    </div>
  );
}

function Label({ text, help, children }: { text: string; help?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-1.5" style={{ color: '#0B1220' }}>{text}</span>
      {children}
      {help && <span className="block text-xs mt-1.5" style={{ color: '#8A94A2' }}>{help}</span>}
    </label>
  );
}

function Toggle({ checked, onChange, label, help }: { checked: boolean; onChange: (v: boolean) => void; label: string; help: string }) {
  return (
    <label className="flex items-start gap-3 py-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-1" style={{ width: 16, height: 16 }} />
      <span>
        <span className="block text-sm font-semibold" style={{ color: '#0B1220' }}>{label}</span>
        <span className="block text-xs mt-0.5" style={{ color: '#8A94A2' }}>{help}</span>
      </span>
    </label>
  );
}

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} className="flex items-center justify-center rounded-lg hover:opacity-70"
            style={{ width: 34, height: 34, border: '1px solid rgba(15,23,42,0.1)', color: '#4B5563' }}>
      {children}
    </button>
  );
}
