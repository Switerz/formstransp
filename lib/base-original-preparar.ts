import type { Prisma } from "@prisma/client";
import { resolveTransportadora, type TransportadoraLookupEntry } from "@/lib/pedidos-parsing";
import { normalizarColunasLinha } from "@/lib/pedidos-devolucao-processar";
import { PROTECTED_COLUMNS } from "@/lib/pedidos-devolucao-validation";

/** Mesmo mapeamento de app/base-completa/actions.ts - fonte única, reaproveitada. */
export const CANONICAL_TO_ORIGEM_FIELD: Record<string, string> = {
  "Nome do Destinatário": "nomeDestinatario",
  "Canal de Vendas": "canalVendas",
  "Cidade do Destinatário": "cidadeDestinatario",
  UF: "uf",
  "CEP do destinatário": "cepDestinatario",
  "Pedido de Venda": "pedidoDeVenda",
  "Código de rastreio": "codigoRastreio",
  "Nota Fiscal": "notaFiscal",
  "Método de envio": "metodoEnvio",
  "Valor da Nota": "valorNota",
  "Peso fisico": "pesoFisico",
  "Chave da Nota": "chaveNota",
  "Data Criação": "dataCriacaoPedido",
  "Data Entrega Origem": "dataEntregaOrigem",
  "Previsão Entrega Cliente": "previsaoEntregaClienteOrigem",
  "Data Despacho": "dataDespacho",
  "Previsão Entrega Transportadora": "previsaoEntregaTransportadoraOrigem",
};

const COLUNAS_DATA = [
  "Data Criação",
  "Data Entrega Origem",
  "Previsão Entrega Cliente",
  "Data Despacho",
  "Previsão Entrega Transportadora",
];

export function textoOuNull(value: unknown): string | null {
  const texto = String(value ?? "").trim();
  return texto === "" ? null : texto;
}

export function decimalOuNull(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const numero = Number(String(value).replace(",", "."));
  return Number.isNaN(numero) ? null : numero;
}

export function dataOuNull(value: unknown): Date | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const texto = String(value).trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(texto);
  if (br) {
    const [, d, m, y, hh = "0", mm = "0", ss = "0"] = br;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(texto);
  if (iso) {
    const [, y, m, d, hh = "0", mm = "0", ss = "0"] = iso;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(texto);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export interface LinhaPreparada {
  linha: number;
  pedido: string;
  data: Prisma.PedidoCreateManyInput;
}

export interface ErroLinha {
  linha: number;
  pedido: string;
  motivo: string;
}

/**
 * Faz o parsing puro de todas as linhas de um arquivo já lido (readXlsxTable)
 * - não toca no banco. Reutilizado tanto pelo upload direto (arquivo
 * pequeno) quanto pelo processamento em cursor (arquivo grande, via Drive).
 */
export function prepararLinhasBaseOriginal(
  rows: Record<string, unknown>[],
  transportadoras: TransportadoraLookupEntry[],
): { preparados: LinhaPreparada[]; erros: ErroLinha[] } {
  const preparados: LinhaPreparada[] = [];
  const erros: ErroLinha[] = [];
  const pedidosVistos = new Set<string>();

  for (let index = 0; index < rows.length; index += 1) {
    const linha = index + 2; // linha 1 = cabeçalho
    const normalizado = normalizarColunasLinha(rows[index]);
    const pedidoChave = String(normalizado["Pedido"] ?? "").trim();

    if (!pedidoChave) {
      erros.push({ linha, pedido: "", motivo: "Coluna Pedido ausente ou vazia." });
      continue;
    }
    if (pedidosVistos.has(pedidoChave)) {
      erros.push({ linha, pedido: pedidoChave, motivo: "Pedido duplicado no mesmo arquivo." });
      continue;
    }
    pedidosVistos.add(pedidoChave);

    const nomeTransportadora = String(normalizado["Transportadora"] ?? "").trim();
    const transportadora = nomeTransportadora ? resolveTransportadora(nomeTransportadora, transportadoras) : null;
    if (!transportadora) {
      erros.push({
        linha,
        pedido: pedidoChave,
        motivo: `Transportadora "${nomeTransportadora}" não encontrada no cadastro (nome/código/alias).`,
      });
      continue;
    }

    const origemFields: Record<string, unknown> = { transportadoraId: transportadora.id, origemAtualizadoEm: new Date() };
    for (const coluna of PROTECTED_COLUMNS) {
      const campoPrisma = CANONICAL_TO_ORIGEM_FIELD[coluna];
      if (!campoPrisma || !(coluna in normalizado)) continue;
      const valor = normalizado[coluna];
      if (coluna === "Valor da Nota" || coluna === "Peso fisico") origemFields[campoPrisma] = decimalOuNull(valor);
      else if (COLUNAS_DATA.includes(coluna)) {
        const data = dataOuNull(valor);
        if (coluna !== "Data Criação" || data !== null) origemFields[campoPrisma] = data;
      } else origemFields[campoPrisma] = textoOuNull(valor);
    }

    const dataCriacaoPedido = origemFields.dataCriacaoPedido;
    if (!(dataCriacaoPedido instanceof Date) || Number.isNaN(dataCriacaoPedido.getTime())) {
      // Para existentes, a data poderá ser preservada; para novos, validamos
      // depois de descobrir em lote quais pedidos já existem.
      delete origemFields.dataCriacaoPedido;
    }

    preparados.push({
      linha,
      pedido: pedidoChave,
      data: { pedido: pedidoChave, ...origemFields } as Prisma.PedidoCreateManyInput,
    });
  }

  return { preparados, erros };
}
