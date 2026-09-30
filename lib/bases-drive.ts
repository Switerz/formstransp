import "server-only";

import * as XLSX from "xlsx";
import { obterGoogleDriveAccessToken } from "@/lib/google-drive";
import type { FillStatus } from "@/lib/pedidos-kpis";
import type { LinhaTabela } from "@/lib/pedidos-table-row";

const CAMPOS_OPERACIONAIS = [
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

type DriveFile = {
  id: string;
  name: string;
  modifiedTime?: string;
  appProperties?: Record<string, string>;
};

export interface BaseDriveResumo {
  linhas: LinhaTabela[];
  total: number;
  pending: number;
  partial: number;
  done: number;
  slaNoPrazo: number;
  slaAtrasado: number;
  ultimaAtualizacao: string | null;
  ultimaDevolucao: string | null;
  totalVisivel: number;
  arquivos: number;
}

function escaparDriveQuery(valor: string) {
  return valor.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";

  if (valor instanceof Date) {
    return valor.toLocaleDateString("pt-BR");
  }

  return String(valor).trim();
}

function normalizarCabecalho(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function valorDaLinha(
  linha: Record<string, unknown>,
  cabecalho: string,
): string {
  const alvo = normalizarCabecalho(cabecalho);

  for (const [chave, valor] of Object.entries(linha)) {
    if (normalizarCabecalho(chave) === alvo) {
      return texto(valor);
    }
  }

  return "";
}

function fillStatus(
  linha: Record<string, unknown>,
): FillStatus {
  const preenchidos = CAMPOS_OPERACIONAIS.filter(
    (campo) => valorDaLinha(linha, campo) !== "",
  ).length;

  if (preenchidos === 0) return "pending";
  if (preenchidos === CAMPOS_OPERACIONAIS.length) return "done";
  return "partial";
}

async function listarArquivos(
  accessToken: string,
  transportadoraId?: string | null,
): Promise<DriveFile[]> {
  const query = transportadoraId
    ? `trashed = false and appProperties has { key='formsTranspTipo' and value='base_transportadora' } and appProperties has { key='formsTranspKey' and value='${escaparDriveQuery(
        `transportadora:${transportadoraId}`,
      )}' }`
    : `trashed = false and appProperties has { key='formsTranspTipo' and value='base_transportadora' }`;

  const url = new URL(
    "https://www.googleapis.com/drive/v3/files",
  );

  url.searchParams.set("q", query);
  url.searchParams.set("spaces", "drive");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set(
    "fields",
    "files(id,name,modifiedTime,appProperties)",
  );
  url.searchParams.set("orderBy", "modifiedTime desc");

  const resposta = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!resposta.ok) {
    throw new Error(
      `Falha ao consultar Google Drive: ${resposta.status}`,
    );
  }

  const dados = (await resposta.json()) as {
    files?: DriveFile[];
  };

  const arquivos = dados.files ?? [];

  if (transportadoraId) {
    return arquivos.slice(0, 1);
  }

  // Mantém apenas o arquivo mais recente de cada transportadora.
  const atuais = new Map<string, DriveFile>();

  for (const arquivo of arquivos) {
    const id =
      arquivo.appProperties?.transportadoraId ??
      arquivo.appProperties?.formsTranspKey ??
      arquivo.name;

    if (!atuais.has(id)) {
      atuais.set(id, arquivo);
    }
  }

  return [...atuais.values()];
}

async function baixarXlsx(
  accessToken: string,
  arquivoId: string,
) {
  const resposta = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      arquivoId,
    )}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  if (!resposta.ok) {
    throw new Error(
      `Falha ao baixar XLSX ${arquivoId}: ${resposta.status}`,
    );
  }

  return Buffer.from(await resposta.arrayBuffer());
}

function converterLinha(
  linha: Record<string, unknown>,
  indice: number,
  arquivoId: string,
): LinhaTabela {
  const colunas: Record<string, string> = {};

  for (const [chave, valor] of Object.entries(linha)) {
    colunas[chave] = texto(valor);
  }

  const status = fillStatus(linha);

  return {
    id:
      valorDaLinha(linha, "Pedido") ||
      valorDaLinha(linha, "Pedido de Venda") ||
      `${arquivoId}-${indice}`,
    fillStatus: status,
    ofensorGb: valorDaLinha(linha, "STATUS ATUAL") || null,
    colunas,
  };
}

export async function carregarBasesDrive({
  transportadoraId,
  somentePreenchidas = false,
  limiteLinhas = 500,
  pagina = 1,
}: {
  transportadoraId?: string | null;
  somentePreenchidas?: boolean;
  limiteLinhas?: number;
  pagina?: number;
}): Promise<BaseDriveResumo> {
  const accessToken = await obterGoogleDriveAccessToken();
  const arquivos = await listarArquivos(
    accessToken,
    transportadoraId,
  );

  let total = 0;
  let pending = 0;
  let partial = 0;
  let done = 0;
  let slaNoPrazo = 0;
  let slaAtrasado = 0;
  let totalVisivel = 0;

  const paginaSegura = Math.max(1, Math.trunc(pagina || 1));
  const inicioPagina = (paginaSegura - 1) * limiteLinhas;
  const fimPagina = inicioPagina + limiteLinhas;

  const linhasVisiveis: LinhaTabela[] = [];

  for (const arquivo of arquivos) {
    const buffer = await baixarXlsx(
      accessToken,
      arquivo.id,
    );

    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
    });

    const primeiraAba = workbook.SheetNames[0];
    if (!primeiraAba) continue;

    const worksheet = workbook.Sheets[primeiraAba];

    const registros =
      XLSX.utils.sheet_to_json<Record<string, unknown>>(
        worksheet,
        {
          defval: "",
          raw: false,
        },
      );

    for (let i = 0; i < registros.length; i++) {
      const registro = registros[i];
      const status = fillStatus(registro);

      total += 1;

      if (status === "pending") pending += 1;
      if (status === "partial") partial += 1;
      if (status === "done") done += 1;

      const sla = valorDaLinha(
        registro,
        "SLA (NO PRAZO/ATRASADO)",
      )
        .toUpperCase()
        .trim();

      if (sla.includes("NO PRAZO")) {
        slaNoPrazo += 1;
      } else if (sla.includes("ATRAS")) {
        slaAtrasado += 1;
      }

      const podeMostrar =
        !somentePreenchidas || status !== "pending";

      if (podeMostrar) {
        const indiceVisivel = totalVisivel;
        totalVisivel += 1;

        if (
          indiceVisivel >= inicioPagina &&
          indiceVisivel < fimPagina
        ) {
          linhasVisiveis.push(
            converterLinha(registro, i, arquivo.id),
          );
        }
      }
    }
  }

  const ultimaAtualizacao =
    arquivos
      .map((arquivo) => arquivo.modifiedTime)
      .filter((valor): valor is string => Boolean(valor))
      .sort()
      .at(-1) ?? null;

  const ultimaDevolucao =
    transportadoraId
      ? arquivos[0]?.appProperties?.formsTranspUltimaDevolucaoEm ?? null
      : null;

  return {
    linhas: linhasVisiveis,
    total,
    pending,
    partial,
    done,
    slaNoPrazo,
    slaAtrasado,
    ultimaAtualizacao,
    ultimaDevolucao,
    totalVisivel,
    arquivos: arquivos.length,
  };
}
