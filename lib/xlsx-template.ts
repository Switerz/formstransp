import ExcelJS from "exceljs";
import { BRAZILIAN_UFS } from "@/lib/ufs";
import { formatDateInput } from "@/lib/dates";

export const XLSX_TEMPLATE_VERSION = "1";

type PreviousDayMetrics = {
  totalPedidos: number;
  totalNoPrazo: number;
  totalForaDoPrazo: number;
  totalEntregue: number;
  totalEmAberto: number;
  totalTentativaInsucesso: number;
  totalDevolucao: number;
  totalCancelado: number;
} | null | undefined;

type CurrentDayPreviewMetrics = {
  totalPedidos: number;
  totalFinalizado: number;
  totalEmAberto: number;
  totalEntregue: number;
  totalTentativaInsucesso: number;
  totalDevolucao: number;
  totalCancelado: number;
  finalizadosNoPrazo: number;
  finalizadosForaDoPrazo: number;
} | null | undefined;

type UfMetric = { uf: string; dentroDoPrazo: number; foraDoPrazo: number };

export type DailyReportTemplateInput = {
  transportadoraId: string;
  transportadoraNome: string;
  dataReport: Date;
  dataResultadoDiaAnterior: Date;
  dataPreviaDiaAtual: Date;
  responsavelNome: string;
  responsavelEmail: string;
  observacoes: string;
  previousDayMetrics: PreviousDayMetrics;
  currentDayPreviewMetrics: CurrentDayPreviewMetrics;
  ufMetrics: UfMetric[];
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFEEF4FB" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FF0F2742" } };

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = { bottom: { style: "thin", color: { argb: "FFD8DEE8" } } };
  });
}

function autoWidth(sheet: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

export async function buildDailyReportTemplate(input: DailyReportTemplateInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FormsTransp";
  workbook.created = new Date();

  const identidade = workbook.addWorksheet("Identificação");
  identidade.addRow([
    "Data do relatório",
    "Data do resultado anterior",
    "Data da prévia atual",
    "Responsável",
    "E-mail do responsável",
    "Observações",
  ]);
  styleHeaderRow(identidade.getRow(1));
  identidade.addRow([
    formatDateInput(input.dataReport),
    formatDateInput(input.dataResultadoDiaAnterior),
    formatDateInput(input.dataPreviaDiaAtual),
    input.responsavelNome,
    input.responsavelEmail,
    input.observacoes,
  ]);
  autoWidth(identidade, [16, 20, 18, 24, 28, 40]);

  const anterior = workbook.addWorksheet("Dia anterior");
  anterior.addRow([
    "Total de pedidos",
    "No prazo",
    "Fora do prazo",
    "Entregue",
    "Em aberto",
    "Tentativa sem sucesso",
    "Devolução",
    "Cancelado",
  ]);
  styleHeaderRow(anterior.getRow(1));
  anterior.addRow([
    input.previousDayMetrics?.totalPedidos ?? 0,
    input.previousDayMetrics?.totalNoPrazo ?? 0,
    input.previousDayMetrics?.totalForaDoPrazo ?? 0,
    input.previousDayMetrics?.totalEntregue ?? 0,
    input.previousDayMetrics?.totalEmAberto ?? 0,
    input.previousDayMetrics?.totalTentativaInsucesso ?? 0,
    input.previousDayMetrics?.totalDevolucao ?? 0,
    input.previousDayMetrics?.totalCancelado ?? 0,
  ]);
  autoWidth(anterior, [16, 12, 14, 12, 12, 20, 12, 12]);

  const atual = workbook.addWorksheet("Prévia atual");
  atual.addRow([
    "Total de pedidos",
    "Finalizado",
    "Em aberto",
    "Entregue",
    "Tentativa sem sucesso",
    "Devolução",
    "Cancelado",
    "Finalizados no prazo",
    "Finalizados fora do prazo",
  ]);
  styleHeaderRow(atual.getRow(1));
  atual.addRow([
    input.currentDayPreviewMetrics?.totalPedidos ?? 0,
    input.currentDayPreviewMetrics?.totalFinalizado ?? 0,
    input.currentDayPreviewMetrics?.totalEmAberto ?? 0,
    input.currentDayPreviewMetrics?.totalEntregue ?? 0,
    input.currentDayPreviewMetrics?.totalTentativaInsucesso ?? 0,
    input.currentDayPreviewMetrics?.totalDevolucao ?? 0,
    input.currentDayPreviewMetrics?.totalCancelado ?? 0,
    input.currentDayPreviewMetrics?.finalizadosNoPrazo ?? 0,
    input.currentDayPreviewMetrics?.finalizadosForaDoPrazo ?? 0,
  ]);
  autoWidth(atual, [16, 12, 12, 12, 20, 12, 12, 18, 20]);

  const uf = workbook.addWorksheet("UF - Dia anterior");
  uf.addRow(["UF", "Dentro do prazo", "Fora do prazo"]);
  styleHeaderRow(uf.getRow(1));
  for (const code of BRAZILIAN_UFS) {
    const metric = input.ufMetrics.find((item) => item.uf === code);
    uf.addRow([code, metric?.dentroDoPrazo ?? 0, metric?.foraDoPrazo ?? 0]);
  }
  autoWidth(uf, [8, 16, 14]);

  const meta = workbook.addWorksheet("_meta", { state: "veryHidden" });
  meta.addRow(["template_version", XLSX_TEMPLATE_VERSION]);
  meta.addRow(["transportadora_id", input.transportadoraId]);
  meta.addRow(["transportadora_nome", input.transportadoraNome]);
  meta.addRow(["gerado_em", new Date().toISOString()]);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
