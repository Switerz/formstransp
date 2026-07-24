import ExcelJS from "exceljs";
import { BRAZILIAN_UFS } from "@/lib/ufs";
import { XLSX_TEMPLATE_VERSION } from "@/lib/xlsx-template";

export type XlsxParseResult = { ok: true; values: Record<string, string> } | { ok: false; errors: string[] };

const IDENTIDADE_SHEET = "Identificação";
const IDENTIDADE_HEADERS = [
  "Data do relatório",
  "Data do resultado anterior",
  "Data da prévia atual",
  "Responsável",
  "E-mail do responsável",
  "Observações",
];
const IDENTIDADE_FIELDS = [
  "dataReport",
  "dataResultadoDiaAnterior",
  "dataPreviaDiaAtual",
  "submittedByName",
  "submittedByEmail",
  "observacoes",
];
const IDENTIDADE_KINDS: Array<"date" | "text"> = ["date", "date", "date", "text", "text", "text"];

const ANTERIOR_SHEET = "Dia anterior";
const ANTERIOR_HEADERS = [
  "Total de pedidos",
  "No prazo",
  "Fora do prazo",
  "Entregue",
  "Em aberto",
  "Tentativa sem sucesso",
  "Devolução",
  "Cancelado",
];
const ANTERIOR_FIELDS = [
  "prev_totalPedidos",
  "prev_totalNoPrazo",
  "prev_totalForaDoPrazo",
  "prev_totalEntregue",
  "prev_totalEmAberto",
  "prev_totalTentativaInsucesso",
  "prev_totalDevolucao",
  "prev_totalCancelado",
];

const ATUAL_SHEET = "Prévia atual";
const ATUAL_HEADERS = [
  "Total de pedidos",
  "Finalizado",
  "Em aberto",
  "Entregue",
  "Tentativa sem sucesso",
  "Devolução",
  "Cancelado",
  "Finalizados no prazo",
  "Finalizados fora do prazo",
];
const ATUAL_FIELDS = [
  "cur_totalPedidos",
  "cur_totalFinalizado",
  "cur_totalEmAberto",
  "cur_totalEntregue",
  "cur_totalTentativaInsucesso",
  "cur_totalDevolucao",
  "cur_totalCancelado",
  "cur_finalizadosNoPrazo",
  "cur_finalizadosForaDoPrazo",
];

const UF_SHEET = "UF - Dia anterior";

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text ?? "");
  return String(value).trim();
}

function cellNumber(cell: ExcelJS.Cell, label: string, errors: string[]): string {
  const raw = cell.value;
  const num = typeof raw === "number" ? raw : Number(cellText(cell));
  if (raw === null || raw === undefined || cellText(cell) === "" || !Number.isFinite(num) || num < 0) {
    errors.push(`${label}: valor inválido (esperado número inteiro maior ou igual a zero, encontrado "${cellText(cell) || "(vazio)"}").`);
    return "0";
  }
  return String(Math.trunc(num));
}

function readTable(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  headers: string[],
  fields: string[],
  kinds: Array<"date" | "text" | "number">,
  values: Record<string, string>,
  errors: string[],
) {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    errors.push(`Aba "${sheetName}" não encontrada na planilha. Baixe um modelo novo antes de preencher.`);
    return;
  }
  const headerRow = sheet.getRow(1);
  headers.forEach((label, index) => {
    const actual = cellText(headerRow.getCell(index + 1));
    if (actual !== label) {
      errors.push(`Aba "${sheetName}": coluna ${index + 1} deveria ser "${label}", mas está "${actual || "(vazio)"}". Não reordene ou renomeie as colunas do modelo.`);
    }
  });
  const dataRow = sheet.getRow(2);
  fields.forEach((field, index) => {
    const cell = dataRow.getCell(index + 1);
    const kind = kinds[index];
    values[field] = kind === "number" ? cellNumber(cell, `Aba "${sheetName}", campo "${headers[index]}"`, errors) : cellText(cell);
  });
}

export async function parseDailyReportXlsx(buffer: Buffer, transportadoraId: string): Promise<XlsxParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs bundles its own (older, non-generic) Buffer typings, which TS treats as a distinct
    // type from this project's Buffer. The value is a real Buffer at runtime either way.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
  } catch {
    return { ok: false, errors: ["O arquivo enviado não é uma planilha .xlsx válida ou está corrompido."] };
  }

  const errors: string[] = [];
  const values: Record<string, string> = {};

  const meta = workbook.getWorksheet("_meta");
  if (!meta) {
    errors.push("A planilha não tem a identificação interna do modelo. Baixe um modelo novo e preencha nele.");
  } else {
    const version = cellText(meta.getRow(1).getCell(2));
    const metaTransportadoraId = cellText(meta.getRow(2).getCell(2));
    if (version !== XLSX_TEMPLATE_VERSION) {
      errors.push("Este modelo de planilha está desatualizado. Baixe um modelo novo antes de preencher.");
    }
    if (metaTransportadoraId && metaTransportadoraId !== transportadoraId) {
      errors.push("Esta planilha foi gerada para outra transportadora e não pode ser usada aqui.");
    }
  }

  readTable(workbook, IDENTIDADE_SHEET, IDENTIDADE_HEADERS, IDENTIDADE_FIELDS, IDENTIDADE_KINDS, values, errors);
  readTable(
    workbook,
    ANTERIOR_SHEET,
    ANTERIOR_HEADERS,
    ANTERIOR_FIELDS,
    ANTERIOR_FIELDS.map(() => "number"),
    values,
    errors,
  );
  readTable(
    workbook,
    ATUAL_SHEET,
    ATUAL_HEADERS,
    ATUAL_FIELDS,
    ATUAL_FIELDS.map(() => "number"),
    values,
    errors,
  );

  const ufSheet = workbook.getWorksheet(UF_SHEET);
  if (!ufSheet) {
    errors.push(`Aba "${UF_SHEET}" não encontrada na planilha. Baixe um modelo novo antes de preencher.`);
  } else {
    BRAZILIAN_UFS.forEach((expectedUf, index) => {
      const row = ufSheet.getRow(index + 2);
      const uf = cellText(row.getCell(1)).toUpperCase();
      if (uf !== expectedUf) {
        errors.push(
          `Aba "${UF_SHEET}", linha ${index + 2}: esperado o estado "${expectedUf}", encontrado "${uf || "(vazio)"}". Não reordene, apague ou adicione linhas nesta aba.`,
        );
        return;
      }
      values[`uf_${expectedUf}_dentro`] = cellNumber(row.getCell(2), `UF ${expectedUf}, dentro do prazo`, errors);
      values[`uf_${expectedUf}_fora`] = cellNumber(row.getCell(3), `UF ${expectedUf}, fora do prazo`, errors);
    });
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, values };
}
