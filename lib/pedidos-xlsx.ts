import ExcelJS from "exceljs";
import path from "node:path";

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

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "public",
  "templates",
  "Base Padrao.xlsx",
);

const FIRST_DATA_ROW = 2;
const LAST_COLUMN = 25; // Y
const FIRST_EDITABLE_COLUMN = 15; // O

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
  // Prisma.Decimal (decimal.js) tem toNumber()
  const maybeDecimal = value as { toNumber?: () => number };
  if (typeof maybeDecimal.toNumber === "function") return maybeDecimal.toNumber();
  return String(value);
}

/** Gera o XLSX no layout padrão Forms Transp a partir de uma lista de Pedido. */
export async function buildPedidosXlsx(pedidos: PedidoParaXlsx[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  const sheet = workbook.getWorksheet("BASE");
  if (!sheet) {
    throw new Error('A planilha modelo não possui a aba obrigatória "BASE".');
  }

  // Preserva o estilo oficial da primeira linha de dados para replicá-lo
  // quando o download tiver mais registros do que as linhas do template.
  const modelRow = sheet.getRow(FIRST_DATA_ROW);
  const modelHeight = modelRow.height;
  const modelStyles = Array.from({ length: LAST_COLUMN }, (_, index) =>
    modelRow.getCell(index + 1).style,
  );

  // Remove somente valores antigos. Formatação, comentários, validações,
  // proteção e as abas DE/PARA permanecem exatamente como no modelo.
  for (let rowNumber = FIRST_DATA_ROW; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    for (let column = 1; column <= LAST_COLUMN; column += 1) {
      row.getCell(column).value = null;
    }
  }

  pedidos.forEach((p, index) => {
    const rowNumber = FIRST_DATA_ROW + index;
    const row = sheet.getRow(rowNumber);

    if (rowNumber > modelRow.number) {
      row.height = modelHeight;
      for (let column = 1; column <= LAST_COLUMN; column += 1) {
        row.getCell(column).style = modelStyles[column - 1];
      }
    }

    row.values = [
      p.nomeDestinatario,
      p.canalVendas,
      p.cidadeDestinatario,
      p.uf,
      String(p.cepDestinatario ?? ""),
      String(p.pedidoDeVenda ?? ""),
      String(p.pedido ?? ""),
      String(p.codigoRastreio ?? ""),
      String(p.notaFiscal ?? ""),
      p.metodoEnvio ?? "",
      p.transportadora?.nome ?? "",
      cellDecimal(p.valorNota),
      cellDecimal(p.pesoFisico),
      String(p.chaveNota ?? ""),
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
    ];

    // Identificadores devem permanecer TEXTO no Excel.
    // Evita perda de zeros à esquerda e arredondamento de números longos.
    for (const columnIndex of [5, 6, 7, 8, 9, 14]) {
      row.getCell(columnIndex).numFmt = "@";
    }
    for (const columnIndex of [15, 16, 18, 24, 25]) {
      row.getCell(columnIndex).numFmt = "dd/mm/yyyy";
    }

    // A:N são dados de origem bloqueados; O:Y são campos operacionais.
    for (let column = 1; column <= LAST_COLUMN; column += 1) {
      row.getCell(column).protection = {
        locked: column < FIRST_EDITABLE_COLUMN,
      };
    }
  });

  const lastRow = Math.max(FIRST_DATA_ROW, pedidos.length + 1);
  sheet.autoFilter = `A1:Y${lastRow}`;

  // O template cobre 100 mil linhas nas listas principais. Estende as
  // validações apenas quando uma transportadora exceder esse volume.
  if (lastRow > 100000) {
    const dataValidations = (
      sheet as ExcelJS.Worksheet & {
        dataValidations: {
          add(range: string, validation: ExcelJS.DataValidation): void;
        };
      }
    ).dataValidations;

    dataValidations.add(`T100001:T${lastRow}`, {
      type: "list",
      allowBlank: true,
      formulae: ["ListaOcorrenciaFormsTransp"],
      showErrorMessage: true,
      errorTitle: "Valor inválido",
      error: "Selecione um valor válido da lista.",
    });
    dataValidations.add(`U100001:U${lastRow}`, {
      type: "list",
      allowBlank: true,
      formulae: ["ListaMotivoDevolucaoFormsTransp"],
      showErrorMessage: true,
      errorTitle: "Valor inválido",
      error: "Selecione um valor válido da lista.",
    });

    for (const column of ["O", "P", "R", "X", "Y"]) {
      dataValidations.add(`${column}100001:${column}${lastRow}`, {
        type: "date",
        operator: "between",
        allowBlank: true,
        formulae: [new Date(2000, 0, 1), new Date(2100, 11, 31)],
        showErrorMessage: true,
        errorTitle: "Data inválida",
        error: "Informe uma data válida ou deixe em branco.",
      });
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
