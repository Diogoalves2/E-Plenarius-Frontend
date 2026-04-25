export interface ChamberBienio {
  bienioInicio?: number | null;
  bienioFim?: number | null;
  anoBienio?: number | null;
}

const TYPE_LABEL: Record<string, string> = {
  ordinaria: 'Ordinária',
  extraordinaria: 'Extraordinária',
  solene: 'Solene',
  especial: 'Especial',
};

export function fullSessionTitle(
  number: number,
  type: string,
  chamber?: ChamberBienio | null,
): string {
  const tipo = TYPE_LABEL[type] ?? type;
  const base = `${number}ª Sessão ${tipo}`;
  if (!chamber?.bienioInicio || !chamber?.bienioFim || !chamber?.anoBienio) return base;
  const ord = chamber.anoBienio === 1 ? '1º' : '2º';
  return `${base} do ${ord} Ano do Biênio ${chamber.bienioInicio}-${chamber.bienioFim}`;
}
