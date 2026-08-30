import ExcelJS from "exceljs";

/**
 * Lê a primeira planilha de um XLSX como tabela genérica: primeira linha =
 * cabeçalho, demais linhas = dados. Diferente de lib/xlsx-parse.ts (que lê
 * um template de células fixas do relatório diário) - aqui o formato é uma
 * tabela normal, uma linha por pedido, como o layout de 25 colunas.
 */
export async function readXlsxTable(buffer: Buffer): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "").trim();
  });

  const rows: Record<string, unknown>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((header, index) => {
      if (!header) return;
      const cell = row.getCell(index + 1);
      let value: unknown = cell.value;
      if (value && typeof value === "object" && "text" in (value as Record<string, unknown>)) {
        value = (value as { text: unknown }).text;
      }
      if (value && typeof value === "object" && "result" in (value as Record<string, unknown>)) {
        value = (value as { result: unknown }).result;
      }
      obj[header] = value ?? "";
      if (String(value ?? "").trim() !== "") hasValue = true;
    });
    if (hasValue) rows.push(obj);
  });

  return { headers, rows };
}
