import * as XLSX from "xlsx";

export async function readXlsxTable(
  buffer: Buffer
): Promise<{
  headers: string[];
  rows: Record<string, unknown>[];
}> {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    raw: true,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { headers: [], rows: [] };

  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  if (matriz.length === 0) return { headers: [], rows: [] };

  const primeiraLinha = matriz[0] ?? [];
  const headers = primeiraLinha.map((valor) =>
    String(valor ?? "").trim()
  );

  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < matriz.length; i++) {
    const linha = matriz[i] ?? [];
    const obj: Record<string, unknown> = {};
    let hasValue = false;

    headers.forEach((header, index) => {
      if (!header) return;

      const valor = linha[index] ?? "";
      obj[header] = valor;

      if (String(valor).trim() !== "") {
        hasValue = true;
      }
    });

    if (hasValue) rows.push(obj);
  }

  return { headers, rows };
}
