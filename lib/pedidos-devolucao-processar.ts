import {
  DATE_ONLY_COLUMNS,
  FILL_COLUMNS,
  PROTECTED_COLUMNS,
  validarLinhaDevolucao,
  type ValidationError,
} from "@/lib/pedidos-devolucao-validation";

function normHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isBlank(value: unknown): boolean {
  return String(value ?? "").trim() === "";
}

/** Compara valores como texto "canônico" - datas viram YYYY-MM-DD, o resto vira trim(). */
function toComparable(value: unknown, isDateColumn: boolean): string {
  if (value === null || value === undefined) return "";
  if (isDateColumn) {
    const date = value instanceof Date ? value : new Date(String(value));
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    return String(value).trim();
  }
  return String(value).trim();
}

/**
 * Remapeia as chaves de uma linha lida do XLSX (cabeçalhos podem vir com
 * variação de caixa/acento/espaço) para os nomes canônicos das colunas
 * protegidas/preenchíveis conhecidas. Colunas desconhecidas são ignoradas.
 */
export function normalizarColunasLinha(rawRow: Record<string, unknown>): Record<string, unknown> {
  const conhecidas = [...PROTECTED_COLUMNS, ...FILL_COLUMNS, "Pedido"];
  const porNomeNormalizado = new Map(conhecidas.map((c) => [normHeader(c), c]));

  const out: Record<string, unknown> = {};
  for (const [chaveOriginal, valor] of Object.entries(rawRow)) {
    const canonico = porNomeNormalizado.get(normHeader(chaveOriginal));
    if (canonico) out[canonico] = valor;
  }
  return out;
}

export interface PedidoAtualDevolucao {
  id: string;
  pedido: string;
  transportadoraId: string;
  /** Valores ATUAIS dos 14 campos protegidos, chave = nome canônico da coluna. */
  protegidosAtuais: Record<string, unknown>;
  dataColetaProcessamento: Date | null;
  dataPrevisao: Date | null;
  prazoEntregaDiasUteis: number | null;
  dataEntrega: Date | null;
  statusAtual: string | null;
  ocorrencia: string | null;
  motivoDevolucao: string | null;
  slaStatus: string | null;
  justificativaAtraso: string | null;
  novaDataPrevisao: Date | null;
  dataResolucaoDevolucao: Date | null;
}

const FILL_COLUMN_TO_FIELD: Record<string, keyof PedidoAtualDevolucao> = {
  "DATA COLETA/PROCESSAMENTO": "dataColetaProcessamento",
  "DATA DE PREVISÃO": "dataPrevisao",
  "PRAZO DE ENTREGA (DIAS ÚTEIS)": "prazoEntregaDiasUteis",
  "DATA DE ENTREGA": "dataEntrega",
  "STATUS ATUAL": "statusAtual",
  OCORRÊNCIA: "ocorrencia",
  "MOTIVO DEVOLUÇÃO": "motivoDevolucao",
  "SLA (NO PRAZO/ATRASADO)": "slaStatus",
  "JUSTIFICATIVA DE ATRASO": "justificativaAtraso",
  "NOVA DATA DE PREVISÃO (SE ATRASADO)": "novaDataPrevisao",
  "DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO": "dataResolucaoDevolucao",
};

export interface DiffCampo {
  campo: string;
  antes: unknown;
  depois: unknown;
}

export interface ResultadoLinha {
  linha: number;
  pedido: string;
  status: "aplicado" | "sem_alteracao" | "erro_validacao" | "pedido_nao_encontrado" | "pedido_de_outra_transportadora";
  errosValidacao: ValidationError[];
  violacoesProtegidas: DiffCampo[];
  tentativasBloqueadas: DiffCampo[];
  alteracoesAplicadas: DiffCampo[];
  /** Valores prontos para prisma.pedido.update (só os campos genuinamente novos/alterados e permitidos). */
  updateData: Record<string, unknown>;
}

/**
 * Processa UMA linha de devolução já normalizada (colunas canônicas) contra
 * o estado atual real do pedido (já carregado do banco pelo chamador).
 * Função pura - não toca em IO/Prisma.
 *
 * Regra por linha (documentada explicitamente):
 * - Se houver erro de validação de formato OU violação de campo protegido,
 *   a linha inteira é rejeitada (nenhum campo é aplicado).
 * - Se a linha for válida, cada campo operacional é avaliado individualmente:
 *   - vazio no upload -> ignorado (não altera o que já existe);
 *   - igual ao valor atual -> sem alteração (idempotente);
 *   - valor atual vazio e upload preenchido -> aplica (1º preenchimento);
 *   - valor atual preenchido e upload diferente -> BLOQUEADO (preserva o
 *     valor atual, registra a tentativa - item 7 do design original).
 */
export function processarLinhaDevolucao(
  rawRow: Record<string, unknown>,
  pedidoAtual: PedidoAtualDevolucao,
  linha: number,
): ResultadoLinha {
  const row = normalizarColunasLinha(rawRow);
  const pedido = String(row["Pedido"] ?? pedidoAtual.pedido).trim();

  const base: Omit<ResultadoLinha, "status"> = {
    linha,
    pedido,
    errosValidacao: [],
    violacoesProtegidas: [],
    tentativasBloqueadas: [],
    alteracoesAplicadas: [],
    updateData: {},
  };

  // 1) Violação de campo protegido: qualquer coluna protegida presente no
  // upload cujo valor difere do que está persistido é tratada como
  // tentativa de integridade - nunca aplicada, sempre reportada.
  const violacoesProtegidas: DiffCampo[] = [];
  for (const coluna of PROTECTED_COLUMNS) {
    if (!(coluna in row)) continue; // coluna protegida ausente no upload: ok, não é violação
    const enviado = toComparable(row[coluna], false);
    const atual = toComparable(pedidoAtual.protegidosAtuais[coluna], false);
    if (enviado !== atual) {
      violacoesProtegidas.push({ campo: coluna, antes: pedidoAtual.protegidosAtuais[coluna] ?? "", depois: row[coluna] });
    }
  }

  // 2) Validação de formato dos campos operacionais.
  const errosValidacao = validarLinhaDevolucao(row, linha);

  if (violacoesProtegidas.length > 0 || errosValidacao.length > 0) {
    return { ...base, violacoesProtegidas, errosValidacao, status: "erro_validacao" };
  }

  // 3) Campo a campo: aplica, bloqueia ou ignora.
  const tentativasBloqueadas: DiffCampo[] = [];
  const alteracoesAplicadas: DiffCampo[] = [];
  const updateData: Record<string, unknown> = {};

  for (const coluna of FILL_COLUMNS) {
    if (!(coluna in row)) continue;
    const enviadoRaw = row[coluna];
    if (isBlank(enviadoRaw)) continue; // vazio no upload = não mexe

    const campoPrisma = FILL_COLUMN_TO_FIELD[coluna];
    const valorAtualRaw = pedidoAtual[campoPrisma];
    const isDateColumn = (DATE_ONLY_COLUMNS as readonly string[]).includes(coluna);

    const enviadoComparavel = toComparable(enviadoRaw, isDateColumn);
    const atualComparavel = toComparable(valorAtualRaw, isDateColumn);

    if (enviadoComparavel === atualComparavel) continue; // já é isso, no-op

    if (!isBlank(valorAtualRaw as string | null)) {
      // já tinha resposta diferente -> bloqueado, preserva o valor atual.
      tentativasBloqueadas.push({ campo: coluna, antes: valorAtualRaw, depois: enviadoRaw });
      continue;
    }

    // 1º preenchimento deste campo.
    alteracoesAplicadas.push({ campo: coluna, antes: valorAtualRaw ?? "", depois: enviadoRaw });
    updateData[campoPrisma] = isDateColumn
      ? new Date(enviadoComparavel)
      : coluna === "PRAZO DE ENTREGA (DIAS ÚTEIS)"
        ? Number(enviadoRaw)
        : String(enviadoRaw).trim();
  }

  const status: ResultadoLinha["status"] = alteracoesAplicadas.length > 0 ? "aplicado" : "sem_alteracao";

  return { ...base, violacoesProtegidas, errosValidacao, tentativasBloqueadas, alteracoesAplicadas, updateData, status };
}
