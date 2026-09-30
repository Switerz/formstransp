import * as XLSX from "xlsx";

const HEADER_ALIASES: Record<string, string> = {
  "Nome do DestinatÃ¡rio": "Nome do Destinatário",
  "Cidade do DestinatÃ¡rio": "Cidade do Destinatário",
  "CEP do destinatÃ¡rio": "CEP do destinatário",
  "CÃ³digo de rastreio": "Código de rastreio",
  "MÃ©todo de envio": "Método de envio",
  "DATA DE PREVISÃƒO": "DATA DE PREVISÃO",
  "PRAZO DE ENTREGA (DIAS ÃšTEIS)": "PRAZO DE ENTREGA (DIAS ÚTEIS)",
  "OCORRÃŠNCIA": "OCORRÊNCIA",
  "MOTIVO DEVOLUÃ‡ÃƒO": "MOTIVO DEVOLUÇÃO",
  "NOVA DATA DE PREVISÃƒO (SE ATRASADO)": "NOVA DATA DE PREVISÃO (SE ATRASADO)",
  "DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÃ‡ÃƒO":
    "DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO",
};

function normalizarHeader(valor: unknown): string {
  const header = String(valor ?? "").trim().normalize("NFC");
  return HEADER_ALIASES[header] ?? header;
}

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
    normalizarHeader(valor)
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
