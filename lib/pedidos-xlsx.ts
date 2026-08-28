import ExcelJS from "exceljs";
import { formatDateInput } from "@/lib/dates";

// Formato de entrada desacoplado do tipo exato gerado pelo Prisma (que não
// está disponível neste ambiente de edição) - mas corresponde 1:1 aos campos
// de Pedido (prisma/schema.prisma) + o nome da transportadora relacionada.
export interface PedidoParaXlsx {
  nomeDestinatario: string;
  canalVendas: string;
  cidadeDestinatario: string;
  uf: string;
  cepDestinatario: string;
  pedidoDeVenda: string;
  pedido: string;
  codigoRastreio: string | null;
  notaFiscal: string | null;
  metodoEnvio: string | null;
  transportadora: { nome: string } | null;
  valorNota: unknown; // Prisma.Decimal | null
  pesoFisico: unknown; // Prisma.Decimal | null
  chaveNota: string | null;
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

// Ordem EXATA das 25 colunas, conforme layout padrão Forms Transp.
const HEADERS = [
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

const COLUMN_WIDTHS = [
  26, 18, 20, 6, 14, 16, 20, 20, 16, 14, 18, 12, 10, 24, 22, 22, 16, 18, 16, 16, 20, 20, 24, 26, 32,
];

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF4FB" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FF0F2742" } };

function cellDate(date: Date | null): string {
  return date ? formatDateInput(date) : "";
}

function cellDecimal(value: unknown): number | string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : value;
  }
  // Prisma.Decimal (decimal.js) tem toNumber()
  const maybeDecimal = value as { toNumber?: () => number };
  if (typeof maybeDecimal.toNumber === "function") return maybeDecimal.toNumber();
  return String(value);
}

/** Gera o XLSX no layout padrão Forms Transp a partir de uma lista de Pedido. */
export async function buildPedidosXlsx(pedidos: PedidoParaXlsx[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FormsTransp";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Base");
  sheet.addRow([...HEADERS]);
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = { bottom: { style: "thin", color: { argb: "FFD8DEE8" } } };
  });

  for (const p of pedidos) {
    sheet.addRow([
      p.nomeDestinatario,
      p.canalVendas,
      p.cidadeDestinatario,
      p.uf,
      p.cepDestinatario,
      p.pedidoDeVenda,
      p.pedido,
      p.codigoRastreio ?? "",
      p.notaFiscal ?? "",
      p.metodoEnvio ?? "",
      p.transportadora?.nome ?? "",
      cellDecimal(p.valorNota),
      cellDecimal(p.pesoFisico),
      p.chaveNota ?? "",
      cellDate(p.dataColetaProcessamento),
      cellDate(p.dataPrevisao),
      p.prazoEntregaDiasUteis ?? "",
      cellDate(p.dataEntrega),
      p.statusAtual ?? "",
      p.ocorrencia ?? "",
      p.motivoDevolucao ?? "",
      p.slaStatus ?? "",
      p.justificativaAtraso ?? "",
      cellDate(p.novaDataPrevisao),
      cellDate(p.dataResolucaoDevolucao),
    ]);
  }

  COLUMN_WIDTHS.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
