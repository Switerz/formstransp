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
      if (texto(anterior[coluna]) !== texto(linha[coluna])) alteracoesOperacionais += 1;
    }
  }

  return { totalLinhas: devolucao.rows.length, alteracoesOperacionais };
}

export async function POST(request: Request) {
  try {
    const user = await requireCarrierUser("/portal/minha-base");
    const transportadoraId = user.transportadoraId;
    if (!transportadoraId) {
      return NextResponse.json({ erro: "Transportadora não identificada." }, { status: 403 });
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

    // Ponto atômico do portal: primeiro troca o ponteiro para a nova base.
    await prisma.exportacaoArquivo.upsert({
      where: { chave: chaveExportacao },
      create: {
        chave: chaveExportacao,
        escopo: "transportadora",
        transportadoraId,
        nomeArquivo: novaBase.name || nomeBase,
        storagePath: `drive:${fileId}`,
        signedUrl: downloadUrl,
        expiresAt,
        totalLinhas: validacao.totalLinhas,
        totalPartes: 1,
        status: "ready",
        geradoEm: new Date(),
      },
      update: {
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

    // Só depois da nova base estar publicada removemos a anterior.
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
