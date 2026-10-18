import { useCallback, useEffect, useState } from 'react';
import api from './api';

export type Majority = 'simples' | 'absoluta' | 'dois_tercos';
export type PresidentVoteRule = 'always' | 'tie_only' | 'tie_and_qualified';
export interface SessionPhase { key: string; label: string }

export interface ChamberRules {
  chamberId: string;
  seats: number;
  seatsConfigured: boolean;
  presidentVoteRule: PresidentVoteRule;
  majorityByType: Record<string, Majority>;
  defaultQuorum: number;
  requirePinToVote: boolean;
  autoOpenMic: boolean;
  sessionPhases: SessionPhase[];
}

export const DEFAULT_PHASES: SessionPhase[] = [
  { key: 'abertura', label: 'Abertura' },
  { key: 'leitura_ata', label: 'Leitura e votação da ata anterior' },
  { key: 'pequeno_expediente', label: 'Pequeno Expediente' },
  { key: 'grande_expediente', label: 'Grande Expediente' },
  { key: 'ordem_do_dia', label: 'Ordem do Dia' },
  { key: 'explicacoes_pessoais', label: 'Explicações Pessoais' },
  { key: 'encerramento', label: 'Encerramento' },
];

export const TIPOS_PROJETO = [
  'Projeto de Emenda à Lei Orgânica',
  'Projeto de Lei Complementar',
  'Projeto de Lei',
  'Projeto de Decreto Legislativo',
  'Projeto de Resolução',
  'Indicação',
  'Requerimento',
  'Pedido de Informação',
  'Recurso',
  'Emenda',
  'Subemenda',
  'Substitutivo',
  'Veto',
  'Moção',
  'Ata',
];

export const MAJORITY_LABEL: Record<Majority, string> = {
  simples: 'Maioria simples',
  absoluta: 'Maioria absoluta',
  dois_tercos: 'Dois terços',
};

export const MAJORITY_HELP: Record<Majority, string> = {
  simples: 'Mais votos SIM que NÃO entre os presentes (abstenção não conta).',
  absoluta: 'Metade + 1 do total de cadeiras da Casa.',
  dois_tercos: '2/3 do total de cadeiras da Casa.',
};

export const PRESIDENT_RULE_LABEL: Record<PresidentVoteRule, string> = {
  always: 'Vota em todas as matérias',
  tie_only: 'Vota só para desempatar',
  tie_and_qualified: 'Vota para desempatar e em matérias de maioria absoluta / 2/3',
};

/** Votos SIM necessários (mesmo cálculo do backend). */
export function requiredVotes(majority: Majority, seats: number): number | null {
  if (majority === 'absoluta') return Math.floor(seats / 2) + 1;
  if (majority === 'dois_tercos') return Math.ceil((seats * 2) / 3);
  return null;
}

export function useChamberRules(chamberId: string | null | undefined) {
  const [rules, setRules] = useState<ChamberRules | null>(null);
  const reload = useCallback(async () => {
    if (!chamberId) return;
    try {
      const { data } = await api.get(`/chambers/${chamberId}/settings`);
      setRules(data);
    } catch { /* sem permissão/rede: telas usam defaults */ }
  }, [chamberId]);
  useEffect(() => { reload(); }, [reload]);
  return { rules, setRules, reload };
}
