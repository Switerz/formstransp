import { formatDateInput } from "@/lib/dates";
import { rowFillStatus, type FillStatus, type PedidoOperacional } from "@/lib/pedidos-kpis";
import { getStatusPadrao } from "@/lib/pedidos-status-de-para";

function decimalToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  const maybeDecimal = value as { toString?: () => string };
  return typeof maybeDecimal.toString === "function" ? maybeDecimal.toString() : String(value);
}

function dateToString(value: Date | null): string {
  return value ? formatDateInput(value) : "";
}

export interface PedidoParaTabela extends PedidoOperacional {
  id: string;
  pedido: string;
  nomeDestinatario: string;
  canalVendas: string;
  cidadeDestinatario: string;
  uf: string;
  cepDestinatario: string;
  pedidoDeVenda: string;
  codigoRastreio: string | null;
  notaFiscal: string | null;
  metodoEnvio: string | null;
  transportadora: { nome: string };
  valorNota: unknown;
  pesoFisico: unknown;
  chaveNota: string | null;
  dataCriacaoPedido: Date;
  dataEntregaOrigem: Date | null;
  previsaoEntregaClienteOrigem: Date | null;
  previsaoEntregaTransportadoraOrigem: Date | null;
}

export interface LinhaTabela {
  id: string;
  fillStatus: FillStatus;
  ofensorGb: string | null;
  colunas: Record<string, string>;
}

/** Ordem completa: 18 campos de origem + 11 operacionais. */
export const ORDEM_COLUNAS_TABELA = [
  "Pedido",
  "Nota Fiscal",
  "Nome do Destinatário",
  "Canal de Vendas",
  "Cidade do Destinatário",
  "UF",
  "CEP do destinatário",
  "Pedido de Venda",
  "Código de rastreio",
  "Método de envio",
  "Transportadora",
  "Valor da Nota",
  "Peso fisico",
  "Chave da Nota",
  "Data Criação",
  "Data Entrega Origem",
  "Previsão Entrega Cliente",
  "Previsão Entrega Transportadora",
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

export function pedidoParaLinhaTabela(pedido: PedidoParaTabela): LinhaTabela {  return {
    id: pedido.id,
    fillStatus: rowFillStatus(pedido),
    ofensorGb: getStatusPadrao(pedido.statusAtual),
    colunas: {
      Pedido: pedido.pedido,
      "Nota Fiscal": pedido.notaFiscal ?? "",
      "Nome do Destinatário": pedido.nomeDestinatario,
      "Canal de Vendas": pedido.canalVendas,
      "Cidade do Destinatário": pedido.cidadeDestinatario,
      UF: pedido.uf,
      "CEP do destinatário": pedido.cepDestinatario,
      "Pedido de Venda": pedido.pedidoDeVenda,
      "Código de rastreio": pedido.codigoRastreio ?? "",
      "Método de envio": pedido.metodoEnvio ?? "",
      Transportadora: pedido.transportadora.nome,
      "Valor da Nota": decimalToString(pedido.valorNota),
      "Peso fisico": decimalToString(pedido.pesoFisico),
      "Chave da Nota": pedido.chaveNota ?? "",
      "Data Criação": dateToString(pedido.dataCriacaoPedido),
      "Data Entrega Origem": dateToString(pedido.dataEntregaOrigem),
      "Previsão Entrega Cliente": dateToString(pedido.previsaoEntregaClienteOrigem),
      "Previsão Entrega Transportadora": dateToString(pedido.previsaoEntregaTransportadoraOrigem),
      "DATA COLETA/PROCESSAMENTO": dateToString(pedido.dataColetaProcessamento),
      "DATA DE PREVISÃO": dateToString(pedido.dataPrevisao),
      "PRAZO DE ENTREGA (DIAS ÚTEIS)": pedido.prazoEntregaDiasUteis?.toString() ?? "",
      "DATA DE ENTREGA": dateToString(pedido.dataEntrega),
      "STATUS ATUAL": pedido.statusAtual ?? "",
      OCORRÊNCIA: pedido.ocorrencia ?? "",
      "MOTIVO DEVOLUÇÃO": pedido.motivoDevolucao ?? "",
      "SLA (NO PRAZO/ATRASADO)": pedido.slaStatus ?? "",
      "JUSTIFICATIVA DE ATRASO": pedido.justificativaAtraso ?? "",
      "NOVA DATA DE PREVISÃO (SE ATRASADO)": dateToString(pedido.novaDataPrevisao),
      "DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO": dateToString(pedido.dataResolucaoDevolucao),
    },
  };
}

/** Busca em qualquer coluna visível/dados carregados - mesma lógica do HTML oficial. */
export function linhaCorrespondeABusca(linha: LinhaTabela, busca: string): boolean {
  const q = busca.trim().toLowerCase();
  if (!q) return true;
  return Object.values(linha.colunas).some((v) => v.toLowerCase().includes(q));
}
