/**
 * Constantes e validação da devolução da transportadora ("Minha Base").
 *
 * PROTECTED_COLUMNS / ACCEPTED_* / DATE_ONLY_COLUMNS são portados do HTML
 * oficial. FILL_COLUMNS foi AJUSTADO conforme decisão explícita: o layout
 * O layout original tinha 25 colunas. A base enriquecida acrescenta 4 campos
 * de origem protegidos, totalizando 18 colunas de origem + 11 operacionais = 29.
 */

// ---------------------------------------------------------------------------
// Nomes de coluna (layout enriquecido de 29 colunas, mesma ordem do XLSX)
// ---------------------------------------------------------------------------

/** As três referências principais - sempre visíveis, nunca ocultadas. */
export const PRIMARY_COLUMNS = ["Pedido", "Nota Fiscal"] as const;

/**
 * Campos de origem/protegidos (Intelipost). Idênticos ao HTML oficial,
 * exceto "Peso físico" -> "Peso fisico" (grafia usada no schema/documentação
 * do projeto - mesma coluna, divergência só de acentuação, já documentada
 * na análise). A comparação usa normHeader (acento/caixa-insensível), então
 * isso não afeta nenhum matching.
 */
export const PROTECTED_COLUMNS = [
  "Nome do Destinatário",
  "Canal de Vendas",
  "Cidade do Destinatário",
  "UF",
  "CEP do destinatário",
  "Pedido de Venda",
  "Pedido",
  "Código de rastreio",
  "Nota Fiscal",
  "Método de envio",
  "Transportadora",
  "Valor da Nota",
  "Peso fisico",
  "Chave da Nota",
  "Data Criação",
  "Data Entrega Origem",
  "Previsão Entrega Cliente",
  "Previsão Entrega Transportadora",
] as const;

/**
 * Campos operacionais/preenchíveis pela transportadora - LAYOUT OFICIAL
 * (11 campos, decisão explícita: inclui "DATA EM QUE O PEDIDO FOI RESOLVIDO
 * PARA DEVOLUÇÃO", que o HTML antigo não tinha).
 */
export const FILL_COLUMNS = [
  "DATA COLETA/PROCESSAMENTO",
  "DATA DE PREVISÃO",
  "PRAZO DE ENTREGA (DIAS ÚTEIS)",
  "DATA DE ENTREGA",
  "STATUS ATUAL",
  "OCORRÊNCIA",
  "MOTIVO DEVOLUÇÃO",
  "SLA (NO PRAZO/ATRASADO)",
  "JUSTIFICATIVA DE ATRASO",
  "NOVA DATA DE PREVISÃO (SE ATRASADO)",
  "DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO",
] as const;

/** Campos que só aceitam data válida ou vazio - inclui o 11º campo (decisão explícita). */
export const DATE_ONLY_COLUMNS = [
  "DATA COLETA/PROCESSAMENTO",
  "DATA DE PREVISÃO",
  "DATA DE ENTREGA",
  "NOVA DATA DE PREVISÃO (SE ATRASADO)",
  "DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO",
] as const;

// Portado literalmente do HTML oficial - não alterar sem necessidade.
export const ACCEPTED_OCCURRENCES = [
  "Cliente Ausente",
  "Não Visitado",
  "Problemas De Endereço",
  "Destinatário Desconhecido",
  "Destinatário Mudou-se",
  "Estabelecimento Fechado",
  "Carga Recusada Pelo Destinatário",
  "Bloqueio De Entrega Pelo Remetente",
  "Retirada Correios",
  "Fatores Naturais",
];

export const ACCEPTED_RETURN_REASONS = [
  "Devolução Indevida – Sem Registro de Ocorrência",
  "Devolução por Solicitação do CX",
  "Devolução por Avaria",
  "Devolução por Falta de Retirada",
  "Devolução Automática",
  "Devolução Indevida por Quantidade Insuficiente de Tentativas de Entrega",
  "Devolução Indevida Antes do Prazo de Custódia",
  "Devolução por Falta de Tratativa do CX",
];

export const ACCEPTED_SLA = ["No prazo", "Atrasado"];

function normHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isFillColumn(col: string): boolean {
  return FILL_COLUMNS.some((c) => normHeader(c) === normHeader(col));
}

export function isPrimaryColumn(col: string): boolean {
  return PRIMARY_COLUMNS.some((c) => normHeader(c) === normHeader(col));
}

export function isProtectedColumn(col: string): boolean {
  return PROTECTED_COLUMNS.some((c) => normHeader(c) === normHeader(col));
}

function sameAllowedValue(value: unknown, allowed: string[]): boolean {
  const n = normHeader(value);
  return allowed.some((v) => normHeader(v) === n);
}

function isBlank(value: unknown): boolean {
  return String(value ?? "").trim() === "";
}

/** Mesma checagem de data do HTML oficial (aceita ISO/BR, vazio, ou Date). */
function isValidDateOrBlank(value: unknown): boolean {
  if (isBlank(value)) return true;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  const parsed = new Date(String(value));
  return !Number.isNaN(parsed.getTime());
}

function isValidBusinessDaysOrBlank(value: unknown): boolean {
  if (isBlank(value)) return true;
  const s = String(value).trim();
  return /^\d+$/.test(s) && Number(s) >= 0;
}

export interface ValidationError {
  linha: number;
  coluna: string;
  valor: unknown;
  mensagem: string;
}

/**
 * Valida os campos operacionais de uma linha de devolução (row já com as
 * chaves nos nomes de coluna oficiais). Não decide nada sobre pertencimento
 * de transportadora nem sobre campo protegido - isso é feito à parte, contra
 * o Pedido real do banco (ver lib/pedidos-devolucao-upload.ts).
 */
export function validarLinhaDevolucao(row: Record<string, unknown>, linha: number): ValidationError[] {
  const erros: ValidationError[] = [];

  for (const col of DATE_ONLY_COLUMNS) {
    if (col in row && !isValidDateOrBlank(row[col])) {
      erros.push({ linha, coluna: col, valor: row[col], mensagem: "Aceito somente data ou campo em branco." });
    }
  }

  const prazo = row["PRAZO DE ENTREGA (DIAS ÚTEIS)"];
  if ("PRAZO DE ENTREGA (DIAS ÚTEIS)" in row && !isValidBusinessDaysOrBlank(prazo)) {
    erros.push({
      linha,
      coluna: "PRAZO DE ENTREGA (DIAS ÚTEIS)",
      valor: prazo,
      mensagem: "Aceito somente número inteiro de dias úteis ou campo em branco.",
    });
  }

  const ocorrencia = row["OCORRÊNCIA"];
  if ("OCORRÊNCIA" in row && !isBlank(ocorrencia) && !sameAllowedValue(ocorrencia, ACCEPTED_OCCURRENCES)) {
    erros.push({ linha, coluna: "OCORRÊNCIA", valor: ocorrencia, mensagem: "Valor fora do de/para de ocorrência." });
  }

  const motivo = row["MOTIVO DEVOLUÇÃO"];
  if ("MOTIVO DEVOLUÇÃO" in row && !isBlank(motivo) && !sameAllowedValue(motivo, ACCEPTED_RETURN_REASONS)) {
    erros.push({ linha, coluna: "MOTIVO DEVOLUÇÃO", valor: motivo, mensagem: "Valor fora do de/para de motivo de devolução." });
  }

  const sla = row["SLA (NO PRAZO/ATRASADO)"];
  if ("SLA (NO PRAZO/ATRASADO)" in row && !isBlank(sla) && !sameAllowedValue(sla, ACCEPTED_SLA)) {
    erros.push({
      linha,
      coluna: "SLA (NO PRAZO/ATRASADO)",
      valor: sla,
      mensagem: 'Aceito somente "No prazo", "Atrasado" ou em branco.',
    });
  }

  return erros;
}
