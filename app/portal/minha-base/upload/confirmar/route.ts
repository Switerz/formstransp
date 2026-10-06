import { NextResponse } from "next/server";

import { requireCarrierUser } from "@/lib/auth";
import { obterGoogleDriveAccessToken } from "@/lib/google-drive";
import { readXlsxTable } from "@/lib/xlsx-table-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 30;

function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function escaparDriveQuery(valor: string): string {
  return valor.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function localizarBaseAtual(
  transportadoraId: string,
  accessToken: string,
): Promise<DriveFile | null> {
  const chaveExportacao = `transportadora:${transportadoraId}`;
  const q = [
    "trashed = false",
    `appProperties has { key='formsTranspKey' and value='${escaparDriveQuery(chaveExportacao)}' }`,
    "appProperties has { key='formsTranspTipo' and value='base_transportadora' }",
  ].join(" and ");

  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set(
    "fields",
    "files(id,name,size,md5Checksum,appProperties,trashed,modifiedTime)",
  );
  url.searchParams.set("orderBy", "modifiedTime desc");
  url.searchParams.set("pageSize", "2");

  const resposta = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!resposta.ok) {
    throw new Error(`Falha ao localizar base atual no Drive (${resposta.status}).`);
  }

  const dados = (await resposta.json()) as { files?: DriveFile[] };
  return dados.files?.[0] ?? null;
}


async function localizarBasesAnteriores(
  transportadoraId: string,
  accessToken: string,
): Promise<DriveFile[]> {
  const q = [
    "trashed = false",
    `appProperties has { key='transportadoraId' and value='${escaparDriveQuery(transportadoraId)}' }`,
    "appProperties has { key='formsTranspTipo' and value='base_transportadora_anterior' }",
  ].join(" and ");

  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set(
    "fields",
    "files(id,name,size,md5Checksum,appProperties,trashed,modifiedTime)",
  );
  url.searchParams.set("orderBy", "modifiedTime desc");
  url.searchParams.set("pageSize", "10");

  const resposta = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!resposta.ok) {
    throw new Error(
      `Falha ao localizar hist?rico da transportadora (${resposta.status}).`,
    );
  }

  const dados = (await resposta.json()) as {
    files?: DriveFile[];
  };

  return dados.files ?? [];
}

const COLUNAS_PROTEGIDAS = [
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
  "Data Cria??o",
  "Data Entrega Intelipost",
  "Previs?o Entrega Cliente",
  "Previs?o Entrega Transportadora",
  "Data Despacho",
  "Previs?o Entrega Transportadora Original",
  "MicroStatus",
  "Status Transportador",
  "Quantidade de Ocorr?ncias",
  "?ltima Ocorr?ncia (Micro)",
  "Status Intelipost",

] as const;

const COLUNAS_OPERACIONAIS = [
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

const COLUNAS_CHAVE = [
  "Transportadora",
  "Pedido",
  "Nota Fiscal",
  "Pedido de Venda",
] as const;

type ConfirmarUploadBody = { fileId?: string };
type DriveFile = {
  id: string;
  name: string;
  size?: string;
  md5Checksum?: string;
  trashed?: boolean;
  appProperties?: Record<string, string>;
  modifiedTime?: string;
};

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toISOString();
  const s = String(valor).trim();
  return /^\d+\.0$/.test(s) ? s.slice(0, -2) : s;
}

function chave(linha: Record<string, unknown>): string {
  return COLUNAS_CHAVE.map((c) => texto(linha[c])).join("|");
}

async function baixarDrive(fileId: string, accessToken: string): Promise<Buffer> {
  const resposta = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  if (!resposta.ok) {
    throw new Error(`Falha ao baixar arquivo do Drive (${resposta.status}).`);
  }
  return Buffer.from(await resposta.arrayBuffer());
}

async function tornarArquivoAcessivel(fileId: string, accessToken: string) {
  const resposta = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=false`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "anyone", role: "reader", allowFileDiscovery: false }),
      cache: "no-store",
    },
  );
  if (!resposta.ok && resposta.status !== 409) {
    throw new Error(`Falha ao liberar nova base para download (${resposta.status}).`);
  }
}


async function tornarArquivoPrivado(
  fileId: string,
  accessToken: string,
) {
  const listar = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?fields=permissions(id,type,role)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  if (!listar.ok) {
    throw new Error(
      `Falha ao consultar permiss?es da base anterior (${listar.status}).`,
    );
  }

  const dados = (await listar.json()) as {
    permissions?: Array<{
      id: string;
      type?: string;
      role?: string;
    }>;
  };

  for (const permissao of dados.permissions ?? []) {
    if (permissao.type !== "anyone") continue;

    const remover = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permissao.id)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      },
    );

    if (!remover.ok && remover.status !== 404) {
      throw new Error(
        `Falha ao tornar a base anterior privada (${remover.status}).`,
      );
    }
  }
}

async function arquivarBaseAnterior(
  arquivo: DriveFile,
  transportadoraId: string,
  accessToken: string,
) {
  const resposta = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(arquivo.id)}?fields=id,appProperties`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        appProperties: {
          ...(arquivo.appProperties ?? {}),
          formsTranspTipo: "base_transportadora_anterior",
          formsTranspKey: `transportadora-anterior:${transportadoraId}`,
          transportadoraId,
          formsTranspArquivadaEm: new Date().toISOString(),
        },
      }),
      cache: "no-store",
    },
  );

  if (!resposta.ok) {
    throw new Error(
      `Falha ao preservar a base anterior (${resposta.status}).`,
    );
  }

  await tornarArquivoPrivado(arquivo.id, accessToken);
}

async function enviarParaLixeira(fileId: string, accessToken: string) {
  const resposta = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trashed: true }),
      cache: "no-store",
    },
  );
  if (!resposta.ok) {
    console.warn(`[upload-devolucao] NÃ£o foi possÃ­vel remover base anterior ${fileId}.`);
  }
}

function validarDevolucao(
  atual: Awaited<ReturnType<typeof readXlsxTable>>,
  devolucao: Awaited<ReturnType<typeof readXlsxTable>>,
) {
  const obrigatorias = [...COLUNAS_PROTEGIDAS, ...COLUNAS_OPERACIONAIS];
  const ausentes = obrigatorias.filter((c) => !devolucao.headers.includes(c));
  if (ausentes.length) {
    throw new Error(`Layout invÃ¡lido. Colunas ausentes: ${ausentes.join(", ")}`);
  }

  const cabecalhosDuplicados = devolucao.headers.filter(
    (cabecalho, indice) => cabecalho && devolucao.headers.indexOf(cabecalho) !== indice,
  );
  if (cabecalhosDuplicados.length) {
    throw new Error(`Layout invÃ¡lido. Colunas duplicadas: ${[...new Set(cabecalhosDuplicados)].join(", ")}`);
  }

  const extras = devolucao.headers.filter(
    (cabecalho) => cabecalho && !obrigatorias.includes(cabecalho as (typeof obrigatorias)[number]),
  );
  if (extras.length) {
    throw new Error(`Layout invÃ¡lido. Colunas nÃ£o reconhecidas: ${extras.join(", ")}`);
  }

  if (devolucao.headers.filter(Boolean).length !== obrigatorias.length) {
    throw new Error("Layout invÃ¡lido. A planilha deve manter exatamente as 36 colunas oficiais.");
  }
  if (atual.rows.length !== devolucao.rows.length) {
    throw new Error(
      `A quantidade de pedidos foi alterada (${atual.rows.length} â†’ ${devolucao.rows.length}). Baixe uma base nova e preencha novamente.`,
    );
  }

  const atualPorChave = new Map<string, Record<string, unknown>>();
  for (const linha of atual.rows) {
    const k = chave(linha);
    if (!k || atualPorChave.has(k)) throw new Error("A base atual possui chave de pedido duplicada/invÃ¡lida.");
    atualPorChave.set(k, linha);
  }

  let alteracoesOperacionais = 0;
  const alteracoes: Array<{
    pedido: string;
    chave: string;
    campo: string;
    valorAnterior: string;
    valorNovo: string;
  }> = [];
  const chavesRecebidas = new Set<string>();

  for (const linha of devolucao.rows) {
    const k = chave(linha);
    if (!k || chavesRecebidas.has(k)) throw new Error("A devoluÃ§Ã£o possui chave de pedido duplicada/invÃ¡lida.");
    chavesRecebidas.add(k);

    const anterior = atualPorChave.get(k);
    if (!anterior) throw new Error("A devoluÃ§Ã£o contÃ©m pedido que nÃ£o pertence Ã  base atual da transportadora.");

    for (const coluna of COLUNAS_PROTEGIDAS) {
      if (texto(anterior[coluna]) !== texto(linha[coluna])) {
        throw new Error(`Campo protegido alterado: ${coluna}. O upload foi cancelado.`);
      }
    }
    for (const coluna of COLUNAS_OPERACIONAIS) {
      const valorAnterior = texto(anterior[coluna]);
      const valorNovo = texto(linha[coluna]);
      if (valorAnterior !== valorNovo) {
        alteracoesOperacionais += 1;
        alteracoes.push({
          pedido: texto(linha["Pedido"]),
          chave: k,
          campo: coluna,
          valorAnterior,
          valorNovo,
        });
      }
    }
  }

  return { totalLinhas: devolucao.rows.length, alteracoesOperacionais, alteracoes };
}

export async function POST(request: Request) {
  try {
    const user = await requireCarrierUser("/portal/minha-base");
    const transportadoraId = user.transportadoraId;
    if (!transportadoraId) {
      return NextResponse.json({ erro: "Transportadora nÃ£o identificada." }, { status: 403 });
    }

    const body = (await request.json()) as ConfirmarUploadBody;
    const fileId = body.fileId?.trim();
    if (!fileId) return NextResponse.json({ erro: "Arquivo nÃ£o informado." }, { status: 400 });

    const accessToken = await obterGoogleDriveAccessToken();
    const resposta = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,size,md5Checksum,appProperties,trashed`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
    );
    if (!resposta.ok) return NextResponse.json({ erro: "O arquivo enviado nÃ£o foi encontrado no Google Drive." }, { status: 400 });

    const arquivo = (await resposta.json()) as DriveFile;
    if (
      arquivo.trashed ||
      arquivo.appProperties?.formsTranspTipo !== "devolucao_transportadora" ||
      arquivo.appProperties?.transportadoraId !== transportadoraId
    ) {
      return NextResponse.json({ erro: "O arquivo nÃ£o pertence a esta transportadora." }, { status: 403 });
    }

    const chaveExportacao = `transportadora:${transportadoraId}`;
    const baseAtual = await localizarBaseAtual(transportadoraId, accessToken);
    if (!baseAtual?.id) {
      throw new Error("A base atual da transportadora nÃ£o estÃ¡ publicada no Drive.");
    }

    const diaHoje = hojeSaoPaulo();
    if (false) {
      return NextResponse.json(
        {
          erro: "A atualizaÃ§Ã£o de hoje jÃ¡ foi recebida com sucesso. Uma nova atualizaÃ§Ã£o poderÃ¡ ser enviada amanhÃ£.",
          codigo: "LIMITE_DIARIO_ATINGIDO",
        },
        { status: 409 },
      );
    }

    const fileIdAtual = baseAtual.id;

    // A devoluÃ§Ã£o Ã© validada contra a base que a transportadora realmente baixou.
    // Se qualquer campo de origem mudar, nada Ã© publicado.
    const [bufferAtual, bufferDevolucao] = await Promise.all([
      baixarDrive(fileIdAtual, accessToken),
      baixarDrive(fileId, accessToken),
    ]);
    const [tabelaAtual, tabelaDevolucao] = await Promise.all([
      readXlsxTable(bufferAtual),
      readXlsxTable(bufferDevolucao),
    ]);
    const validacao = validarDevolucao(tabelaAtual, tabelaDevolucao);

    // ConcorrÃªncia sem banco: antes de finalizar, confirma que a base atual
    // continua sendo exatamente a mesma versÃ£o usada na validaÃ§Ã£o.
    const baseAntesDaTroca = await localizarBaseAtual(transportadoraId, accessToken);
    if (!baseAntesDaTroca?.id || baseAntesDaTroca.id !== fileIdAtual) {
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            appProperties: {
              formsTranspTipo: "devolucao_transportadora",
              transportadoraId,
              formsTranspConflito: "versao_desatualizada",
            },
          }),
          cache: "no-store",
        },
      );

      return NextResponse.json(
        {
          erro: "A base foi atualizada por outro processo enquanto este arquivo era processado. Nada foi sobrescrito. Baixe a versÃ£o atual antes de tentar novamente.",
          codigo: "CONFLITO_DE_VERSAO",
        },
        { status: 409 },
      );
    }

    // O XLSX devolvido, jÃ¡ validado, vira a nova base oficial da transportadora.
    // Assim preservamos 100% do arquivo/estilos e o prÃ³ximo download jÃ¡ traz a resposta.
    const nomeBase = baseAtual.name || `base_${transportadoraId}.xlsx`;
    const promover = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,size,md5Checksum,appProperties`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: nomeBase,
          appProperties: {
            formsTranspTipo: "base_transportadora",
            formsTranspKey: chaveExportacao,
            transportadoraId,
            formsTranspUltimaDevolucaoDia: diaHoje,
            formsTranspUltimaDevolucaoEm: new Date().toISOString(),
            formsTranspUltimaDevolucaoUserId: user.id.slice(0, 120),
            formsTranspUltimaDevolucaoAlteracoes: String(validacao.alteracoesOperacionais),
            formsTranspUltimaDevolucaoLinhas: String(validacao.totalLinhas),
            ...(user.transportadora?.nome ? { transportadoraNome: user.transportadora.nome.slice(0, 120) } : {}),
          },
        }),
        cache: "no-store",
      },
    );
    if (!promover.ok) throw new Error(`Falha ao promover devoluÃ§Ã£o para base atual (${promover.status}).`);
    const novaBase = (await promover.json()) as DriveFile;

    await tornarArquivoAcessivel(fileId, accessToken);
    const downloadUrl =
      `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
    const expiresAt = new Date(Date.now() + SIGNED_URL_SECONDS * 1000);

    // A auditoria resumida fica nas appProperties da nova base no Drive.
    // SÃ³ depois da nova base validada/promovida removemos a versÃ£o anterior.
    if (fileIdAtual !== fileId) {
      // Busca o hist?rico ANTES de arquivar a base atual.
      // Assim mantemos exatamente uma vers?o anterior.
      const anteriores = await localizarBasesAnteriores(
        transportadoraId,
        accessToken,
      );

      await arquivarBaseAnterior(
        baseAtual,
        transportadoraId,
        accessToken,
      );

      // Qualquer hist?rico mais antigo deixa de ser necess?rio.
      for (const anterior of anteriores) {
        await enviarParaLixeira(anterior.id, accessToken);
      }
    }

    return NextResponse.json({
      ok: true,
      status: "PROCESSADO",
      alteracoesOperacionais: validacao.alteracoesOperacionais,
      totalLinhas: validacao.totalLinhas,
      arquivo: {
        id: fileId,
        nome: novaBase.name || nomeBase,
        tamanhoBytes: novaBase.size ?? arquivo.size ?? null,
        md5: novaBase.md5Checksum ?? arquivo.md5Checksum ?? null,
        contentType: XLSX_CONTENT_TYPE,
      },
      mensagem: `Base atualizada. ${validacao.alteracoesOperacionais} campo(s) operacional(is) alterado(s).`,
    });
  } catch (error) {
    console.error("[upload-devolucao] Falha ao processar devoluÃ§Ã£o:", error);
    return NextResponse.json(
      { erro: error instanceof Error ? error.message : "NÃ£o foi possÃ­vel processar a devoluÃ§Ã£o." },
      { status: 500 },
    );
  }
}


