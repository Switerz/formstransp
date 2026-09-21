import ExcelJS from "exceljs";
import path from "node:path";

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
  valorNota: unknown;
  pesoFisico: unknown;
  chaveNota: string | null;
  dataCriacaoPedido: Date;
  dataEntregaOrigem: Date | null;
  previsaoEntregaClienteOrigem: Date | null;
  previsaoEntregaTransportadoraOrigem: Date | null;
  dataDespacho: Date | null;
  previsaoEntregaTransportadoraOriginal: Date | null;
  microStatus: string | null;
  statusTransportador: string | null;
  quantidadeOcorrencias: number | null;
  ultimaOcorrenciaMicro: string | null;
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

const TEMPLATE_PATH = path.join(process.cwd(), "public", "templates", "Base Padrao.xlsx");
const FIRST_DATA_ROW = 2;
const LAST_COLUMN = 27;
const FIRST_EDITABLE_COLUMN = 17;

function cellDate(date: Date | null): Date | null {
  return date ? new Date(date) : null;
}

function cellDecimal(value: unknown): number | string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : value;
  }
  const maybeDecimal = value as { toNumber?: () => number };
  if (typeof maybeDecimal.toNumber === "function") return maybeDecimal.toNumber();
  return String(value);
}

export async function buildPedidosXlsx(pedidos: PedidoParaXlsx[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  const sheet = workbook.getWorksheet("BASE");
  if (!sheet) throw new Error('A planilha modelo não possui a aba obrigatória "BASE".');

  // Acrescenta datas de origem ao modelo homologado, antes dos campos editáveis.
  if (sheet.getCell("O1").value === "DATA COLETA/PROCESSAMENTO") {
    for (let column = 25; column >= 15; column -= 1) {
      const origem = sheet.getColumn(column);
      const destino = sheet.getColumn(column + 2);
      destino.width = origem.width;
      for (const linha of [1, FIRST_DATA_ROW]) {
        const anterior = sheet.getRow(linha).getCell(column);
        const proxima = sheet.getRow(linha).getCell(column + 2);
        proxima.value = anterior.value;
        proxima.style = { ...anterior.style };
      }
    }
    for (const [coluna, titulo] of [[15, "Data Despacho"], [16, "Previsão Entrega Transportadora"]] as const) {
      sheet.getColumn(coluna).width = coluna === 15 ? 19 : 31;
      const cabecalho = sheet.getRow(1).getCell(coluna);
      cabecalho.value = titulo;
      cabecalho.style = { ...sheet.getRow(1).getCell(14).style };
      const modelo = sheet.getRow(FIRST_DATA_ROW).getCell(coluna);
      modelo.value = null;
      modelo.style = { ...sheet.getRow(FIRST_DATA_ROW).getCell(14).style };
      modelo.numFmt = "dd/mm/yyyy";
      modelo.protection = { locked: true };
    }
  }
  if (sheet.getCell("O1").value !== "Data Despacho" ||
      sheet.getCell("Q1").value !== "DATA COLETA/PROCESSAMENTO") {
    throw new Error("O modelo BASE não contém as colunas esperadas para a exportação.");
  }

  const modelRow = sheet.getRow(FIRST_DATA_ROW);
  const modelHeight = modelRow.height;
  const modelStyles = Array.from({ length: LAST_COLUMN }, (_, index) => ({
    ...modelRow.getCell(index + 1).style,
  }));

  // Elimina as milhares de linhas físicas pré-formatadas do modelo. Manter
  // 100 mil linhas fazia o ExcelJS percorrer e serializar milhões de células.
  if (sheet.rowCount >= FIRST_DATA_ROW) {
    sheet.spliceRows(FIRST_DATA_ROW, sheet.rowCount - FIRST_DATA_ROW + 1);
  }

  pedidos.forEach((p, index) => {
    const row = sheet.getRow(FIRST_DATA_ROW + index);
    row.height = modelHeight;
    row.values = [
      p.nomeDestinatario, p.canalVendas, p.cidadeDestinatario, p.uf,
      String(p.cepDestinatario ?? ""), String(p.pedidoDeVenda ?? ""),
      String(p.pedido ?? ""), String(p.codigoRastreio ?? ""),
      String(p.notaFiscal ?? ""), p.metodoEnvio ?? "",
      p.transportadora?.nome ?? "", cellDecimal(p.valorNota),
      cellDecimal(p.pesoFisico), String(p.chaveNota ?? ""),
      cellDate(p.dataDespacho), cellDate(p.previsaoEntregaTransportadoraOrigem),
      cellDate(p.dataColetaProcessamento), cellDate(p.dataPrevisao),
      p.prazoEntregaDiasUteis ?? "", cellDate(p.dataEntrega),
      p.statusAtual ?? "", p.ocorrencia ?? "", p.motivoDevolucao ?? "",
      p.slaStatus ?? "", p.justificativaAtraso ?? "",
      cellDate(p.novaDataPrevisao), cellDate(p.dataResolucaoDevolucao),
    ];

    for (let column = 1; column <= LAST_COLUMN; column += 1) {
      row.getCell(column).style = { ...modelStyles[column - 1] };
      row.getCell(column).protection = { locked: column < FIRST_EDITABLE_COLUMN };
    }
    for (const column of [5, 6, 7, 8, 9, 14]) row.getCell(column).numFmt = "@";
    for (const column of [15, 16, 17, 18, 20, 26, 27]) row.getCell(column).numFmt = "dd/mm/yyyy";
  });

  const lastRow = Math.max(FIRST_DATA_ROW, pedidos.length + 1);
  sheet.autoFilter = `A1:AA${lastRow}`;

  const validations = (sheet as ExcelJS.Worksheet & {
    dataValidations: {
      model: Record<string, ExcelJS.DataValidation>;
      add(range: string, validation: ExcelJS.DataValidation): void;
    };
  }).dataValidations;

  // Descarta as validações antigas que cobriam 100 mil linhas antes de
  // registrar somente os intervalos realmente usados pelo arquivo atual.
  validations.model = {};

  validations.add(`V2:V${lastRow}`, {
    type: "list", allowBlank: true, formulae: ["ListaOcorrenciaFormsTransp"],
    showErrorMessage: true, errorTitle: "Valor inválido",
    error: "Selecione um valor válido da lista.",
  });
  validations.add(`W2:W${lastRow}`, {
    type: "list", allowBlank: true, formulae: ["ListaMotivoDevolucaoFormsTransp"],
    showErrorMessage: true, errorTitle: "Valor inválido",
    error: "Selecione um valor válido da lista.",
  });
  for (const column of ["Q", "R", "T", "Z", "AA"]) {
    validations.add(`${column}2:${column}${lastRow}`, {
      type: "date", operator: "between", allowBlank: true,
      formulae: [new Date(2000, 0, 1), new Date(2100, 11, 31)],
      showErrorMessage: true, errorTitle: "Data inválida",
      error: "Informe uma data válida ou deixe em branco.",
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
