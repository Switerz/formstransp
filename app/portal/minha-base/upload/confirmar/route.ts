import { NextResponse } from "next/server";

import { requireCarrierUser } from "@/lib/auth";
import { obterGoogleDriveAccessToken } from "@/lib/google-drive";
import { prisma } from "@/lib/prisma";
import { readXlsxTable } from "@/lib/xlsx-table-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 30;

function intervaloHojeSaoPaulo() {
  const agora = new Date();
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(agora);
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  const inicio = new Date(Date.UTC(valor("year"), valor("month") - 1, valor("day"), 3, 0, 0));
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  return { inicio, fim };
}

async function jaAtualizouHoje(transportadoraId: string) {
  const { inicio, fim } = intervaloHojeSaoPaulo();
  return prisma.automationLog.findFirst({
    where: {
      transportadoraId,
      tipo: "devolucao_drive_auditoria",
      status: "success",
      dataReport: { gte: inicio, lt: fim },
    },
    select: { id: true, dataReport: true },
    orderBy: { dataReport: "desc" },
  });
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
    console.warn(`[upload-devolucao] Não foi possível remover base anterior ${fileId}.`);
  }
}

function validarDevolucao(
  atual: Awaited<ReturnType<typeof readXlsxTable>>,
  devolucao: Awaited<ReturnType<typeof readXlsxTable>>,
) {
  const obrigatorias = [...COLUNAS_PROTEGIDAS, ...COLUNAS_OPERACIONAIS];
  const ausentes = obrigatorias.filter((c) => !devolucao.headers.includes(c));
  if (ausentes.length) {
    throw new Error(`Layout inválido. Colunas ausentes: ${ausentes.join(", ")}`);
  }

  const cabecalhosDuplicados = devolucao.headers.filter(
    (cabecalho, indice) => cabecalho && devolucao.headers.indexOf(cabecalho) !== indice,
  );
  if (cabecalhosDuplicados.length) {
    throw new Error(`Layout inválido. Colunas duplicadas: ${[...new Set(cabecalhosDuplicados)].join(", ")}`);
  }

  const extras = devolucao.headers.filter(
    (cabecalho) => cabecalho && !obrigatorias.includes(cabecalho as (typeof obrigatorias)[number]),
  );
  if (extras.length) {
    throw new Error(`Layout inválido. Colunas não reconhecidas: ${extras.join(", ")}`);
  }

  if (devolucao.headers.filter(Boolean).length !== obrigatorias.length) {
    throw new Error("Layout inválido. A planilha deve manter exatamente as 25 colunas oficiais.");
  }
  if (atual.rows.length !== devolucao.rows.length) {
    throw new Error(
      `A quantidade de pedidos foi alterada (${atual.rows.length} → ${devolucao.rows.length}). Baixe uma base nova e preencha novamente.`,
    );
  }

  const atualPorChave = new Map<string, Record<string, unknown>>();
  for (const linha of atual.rows) {
    const k = chave(linha);
    if (!k || atualPorChave.has(k)) throw new Error("A base atual possui chave de pedido duplicada/inválida.");
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
    if (!k || chavesRecebidas.has(k)) throw new Error("A devolução possui chave de pedido duplicada/inválida.");
    chavesRecebidas.add(k);

    const anterior = atualPorChave.get(k);
    if (!anterior) throw new Error("A devolução contém pedido que não pertence à base atual da transportadora.");

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

async function registrarHistoricoDevolucao(params: {
  transportadoraId: string;
  userId: string;
  fileId: string;
  nomeArquivo: string;
  totalLinhas: number;
  alteracoes: Array<{ pedido: string; chave: string; campo: string; valorAnterior: string; valorNovo: string }>;
}) {
  // Mantemos os logs pequenos para não depender de uma única linha gigante no banco.
  // É somente auditoria: as bases pesadas continuam fora do Supabase.
  const TAMANHO_LOTE = 200;
  const totalLotes = Math.max(1, Math.ceil(params.alteracoes.length / TAMANHO_LOTE));

  for (let indice = 0; indice < totalLotes; indice += 1) {
    const inicio = indice * TAMANHO_LOTE;
    const lote = params.alteracoes.slice(inicio, inicio + TAMANHO_LOTE);
    await prisma.automationLog.create({
      data: {
        transportadoraId: params.transportadoraId,
        dataReport: new Date(),
        tipo: "devolucao_drive_auditoria",
        status: "success",
        mensagem: `Devolução processada: ${params.alteracoes.length} alteração(ões) operacional(is). Lote ${indice + 1}/${totalLotes}.`,
        payload: JSON.stringify({
          userId: params.userId,
          fileId: params.fileId,
          nomeArquivo: params.nomeArquivo,
          totalLinhas: params.totalLinhas,
          totalAlteracoes: params.alteracoes.length,
          lote: indice + 1,
          totalLotes,
          alteracoes: lote,
        }),
      },
    });
  }
}


export async function POST(request: Request) {
  try {
    const user = await requireCarrierUser("/portal/minha-base");
    const transportadoraId = user.transportadoraId;
    if (!transportadoraId) {
      return NextResponse.json({ erro: "Transportadora não identificada." }, { status: 403 });
    }

    // Revalida o limite também na confirmação para evitar que duas abas/sessões
    // consigam concluir duas devoluções no mesmo dia. Upload com falha não cria
    // log de sucesso e, portanto, não consome o limite diário.
    const atualizacaoHoje = await jaAtualizouHoje(transportadoraId);
    if (atualizacaoHoje) {
      return NextResponse.json(
        {
          erro: "A atualização de hoje já foi recebida com sucesso. Uma nova atualização poderá ser enviada amanhã.",
          codigo: "LIMITE_DIARIO_ATINGIDO",
        },
        { status: 409 },
      );
    }

    const body = (await request.json()) as ConfirmarUploadBody;
    const fileId = body.fileId?.trim();
    if (!fileId) return NextResponse.json({ erro: "Arquivo não informado." }, { status: 400 });

    const accessToken = await obterGoogleDriveAccessToken();
    const resposta = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,size,md5Checksum,appProperties,trashed`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
    );
    if (!resposta.ok) return NextResponse.json({ erro: "O arquivo enviado não foi encontrado no Google Drive." }, { status: 400 });

    const arquivo = (await resposta.json()) as DriveFile;
    if (
      arquivo.trashed ||
      arquivo.appProperties?.formsTranspTipo !== "devolucao_transportadora" ||
      arquivo.appProperties?.transportadoraId !== transportadoraId
    ) {
      return NextResponse.json({ erro: "O arquivo não pertence a esta transportadora." }, { status: 403 });
    }

    const chaveExportacao = `transportadora:${transportadoraId}`;
    const exportacaoAtual = await prisma.exportacaoArquivo.findUnique({
      where: { chave: chaveExportacao },
      select: { storagePath: true, nomeArquivo: true },
    });
    const fileIdAtual = exportacaoAtual?.storagePath?.startsWith("drive:")
      ? exportacaoAtual.storagePath.slice("drive:".length)
      : "";
    if (!fileIdAtual) throw new Error("A base atual da transportadora não está publicada no Drive.");

    // A devolução é validada contra a base que a transportadora realmente baixou.
    // Se qualquer campo de origem mudar, nada é publicado.
    const [bufferAtual, bufferDevolucao] = await Promise.all([
      baixarDrive(fileIdAtual, accessToken),
      baixarDrive(fileId, accessToken),
    ]);
    const [tabelaAtual, tabelaDevolucao] = await Promise.all([
      readXlsxTable(bufferAtual),
      readXlsxTable(bufferDevolucao),
    ]);
    const validacao = validarDevolucao(tabelaAtual, tabelaDevolucao);

    // O XLSX devolvido, já validado, vira a nova base oficial da transportadora.
    // Assim preservamos 100% do arquivo/estilos e o próximo download já traz a resposta.
    const nomeBase = exportacaoAtual?.nomeArquivo || `base_${transportadoraId}.xlsx`;
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
            ...(user.transportadora?.nome ? { transportadoraNome: user.transportadora.nome.slice(0, 120) } : {}),
          },
        }),
        cache: "no-store",
      },
    );
    if (!promover.ok) throw new Error(`Falha ao promover devolução para base atual (${promover.status}).`);
    const novaBase = (await promover.json()) as DriveFile;

    await tornarArquivoAcessivel(fileId, accessToken);
    const downloadUrl =
      `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
    const expiresAt = new Date(Date.now() + SIGNED_URL_SECONDS * 1000);

    // Concorrência: a troca do ponteiro é otimista e atômica no banco.
    // Só vence quem ainda estiver trabalhando sobre a mesma versão que foi validada.
    // Se outra devolução/publicação trocar a base enquanto este arquivo é processado,
    // updateMany retorna 0 e esta devolução NÃO sobrescreve a versão mais nova.
    const troca = await prisma.exportacaoArquivo.updateMany({
      where: {
        chave: chaveExportacao,
        storagePath: `drive:${fileIdAtual}`,
      },
      data: {
        nomeArquivo: novaBase.name || nomeBase,
        storagePath: `drive:${fileId}`,
        signedUrl: downloadUrl,
        expiresAt,
        totalLinhas: validacao.totalLinhas,
        totalPartes: 1,
        status: "ready",
        geradoEm: new Date(),
      },
    });

    if (troca.count !== 1) {
      // O arquivo continua preservado no Drive como devolução para recuperação;
      // não removemos nenhuma versão e não registramos sucesso/auditoria.
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
          erro: "A base foi atualizada por outro processo enquanto este arquivo era processado. Nada foi sobrescrito. Baixe a versão atual antes de tentar novamente.",
          codigo: "CONFLITO_DE_VERSAO",
        },
        { status: 409 },
      );
    }

    // Antes de remover a versão anterior, persistimos a auditoria das mudanças.
    // Se o log falhar, a base nova já está apontada no portal, mas a versão anterior
    // NÃO é removida: assim nenhuma informação fica sem possibilidade de recuperação.
    await registrarHistoricoDevolucao({
      transportadoraId,
      userId: user.id,
      fileId,
      nomeArquivo: novaBase.name || nomeBase,
      totalLinhas: validacao.totalLinhas,
      alteracoes: validacao.alteracoes,
    });

    // Só depois de base nova + histórico persistidos removemos a versão anterior.
    if (fileIdAtual !== fileId) await enviarParaLixeira(fileIdAtual, accessToken);

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
    console.error("[upload-devolucao] Falha ao processar devolução:", error);
    return NextResponse.json(
      { erro: error instanceof Error ? error.message : "Não foi possível processar a devolução." },
      { status: 500 },
    );
  }
}
