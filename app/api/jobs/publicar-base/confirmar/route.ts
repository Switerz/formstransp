import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obterGoogleDriveAccessToken } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const SIGNED_URL_SECONDS = 60 * 60 * 24 * 30;

function autorizado(request: NextRequest) {
  const secret = request.headers.get("x-pedidos-import-secret");
  const expectedSecret = process.env.PEDIDOS_IMPORT_SECRET;

  return Boolean(
    expectedSecret &&
      secret &&
      secret === expectedSecret,
  );
}

function escaparDriveQuery(valor: string) {
  return valor
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

async function buscarArquivosAnteriores(
  chave: string,
  fileIdNovo: string,
  accessToken: string,
) {
  const query =
    `trashed = false and ` +
    `appProperties has { key='formsTranspKey' and value='${escaparDriveQuery(chave)}' }`;

  const url = new URL(
    "https://www.googleapis.com/drive/v3/files",
  );

  url.searchParams.set("q", query);
  url.searchParams.set("spaces", "drive");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("fields", "files(id,name)");

  const resposta = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();

    throw new Error(
      `Falha ao buscar versões anteriores no Drive (${resposta.status}): ${detalhe}`,
    );
  }

  const dados = (await resposta.json()) as {
    files?: Array<{
      id: string;
      name: string;
    }>;
  };

  return (dados.files ?? []).filter(
    (arquivo) => arquivo.id !== fileIdNovo,
  );
}

async function tornarArquivoAcessivel(
  fileId: string,
  accessToken: string,
) {
  const resposta = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId,
    )}/permissions?sendNotificationEmail=false`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "anyone",
        role: "reader",
        allowFileDiscovery: false,
      }),
      cache: "no-store",
    },
  );

  if (!resposta.ok && resposta.status !== 409) {
    const detalhe = await resposta.text();

    throw new Error(
      `Falha ao liberar arquivo para download (${resposta.status}): ${detalhe}`,
    );
  }
}

async function enviarParaLixeira(
  fileIds: string[],
  accessToken: string,
) {
  for (const fileId of fileIds) {
    const resposta = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        fileId,
      )}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trashed: true,
        }),
        cache: "no-store",
      },
    );

    if (!resposta.ok) {
      const detalhe = await resposta.text();

      console.warn(
        `[publicar-base/confirmar] Não foi possível enviar arquivo antigo ${fileId} para a lixeira: ${resposta.status} ${detalhe}`,
      );
    }
  }
}

export async function POST(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "corpo da requisição não é um JSON válido" },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "corpo inválido" },
      { status: 400 },
    );
  }

  const dados = body as Record<string, unknown>;

  const fileId =
    typeof dados.fileId === "string"
      ? dados.fileId.trim()
      : "";

  const transportadoraId =
    typeof dados.transportadoraId === "string"
      ? dados.transportadoraId.trim()
      : "";

  const totalLinhas =
    typeof dados.totalLinhas === "number"
      ? dados.totalLinhas
      : Number(dados.totalLinhas);

  if (!fileId || !transportadoraId) {
    return NextResponse.json(
      {
        error:
          "fileId e transportadoraId são obrigatórios",
      },
      { status: 400 },
    );
  }

  if (
    !Number.isSafeInteger(totalLinhas) ||
    totalLinhas < 0
  ) {
    return NextResponse.json(
      { error: "totalLinhas inválido" },
      { status: 400 },
    );
  }

  const transportadora =
    await prisma.transportadora.findUnique({
      where: {
        id: transportadoraId,
      },
      select: {
        id: true,
        nome: true,
      },
    });

  if (!transportadora) {
    return NextResponse.json(
      { error: "transportadora não encontrada" },
      { status: 404 },
    );
  }

  const accessToken =
    await obterGoogleDriveAccessToken();

  const respostaArquivo = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId,
    )}?fields=id,name,size,md5Checksum,appProperties,trashed`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  if (!respostaArquivo.ok) {
    return NextResponse.json(
      { error: "arquivo não encontrado no Google Drive" },
      { status: 404 },
    );
  }

  const arquivo = (await respostaArquivo.json()) as {
    id: string;
    name: string;
    size?: string;
    md5Checksum?: string;
    trashed?: boolean;
    appProperties?: Record<string, string>;
  };

  if (arquivo.trashed) {
    return NextResponse.json(
      { error: "o arquivo enviado está na lixeira" },
      { status: 400 },
    );
  }

  const chave =
    `transportadora:${transportadora.id}`;

  if (
    arquivo.appProperties?.formsTranspTipo !==
      "base_transportadora" ||
    arquivo.appProperties?.transportadoraId !==
      transportadora.id ||
    arquivo.appProperties?.formsTranspKey !== chave
  ) {
    return NextResponse.json(
      {
        error:
          "o arquivo não pertence à publicação informada",
      },
      { status: 403 },
    );
  }

  /*
   * Só procuramos versões antigas depois que o arquivo novo
   * foi validado.
   */
  const anteriores =
    await buscarArquivosAnteriores(
      chave,
      arquivo.id,
      accessToken,
    );

  /*
   * Mantém, por enquanto, o mesmo modelo de download que o
   * Forms Transp já utilizava para arquivos publicados no Drive.
   */
  await tornarArquivoAcessivel(
    arquivo.id,
    accessToken,
  );

  const downloadUrl =
    `https://drive.usercontent.google.com/download` +
    `?id=${encodeURIComponent(arquivo.id)}` +
    `&export=download&confirm=t`;

  const expiresAt = new Date(
    Date.now() + SIGNED_URL_SECONDS * 1000,
  );

  /*
   * Ponto de troca:
   * primeiro o banco passa a apontar para o arquivo NOVO.
   */
  await prisma.exportacaoArquivo.upsert({
    where: {
      chave,
    },
    create: {
      chave,
      escopo: "transportadora",
      transportadoraId: transportadora.id,
      nomeArquivo: arquivo.name,
      storagePath: `drive:${arquivo.id}`,
      signedUrl: downloadUrl,
      expiresAt,
      totalLinhas,
      totalPartes: 1,
      status: "ready",
      geradoEm: new Date(),
    },
    update: {
      escopo: "transportadora",
      transportadoraId: transportadora.id,
      nomeArquivo: arquivo.name,
      storagePath: `drive:${arquivo.id}`,
      signedUrl: downloadUrl,
      expiresAt,
      totalLinhas,
      totalPartes: 1,
      status: "ready",
      geradoEm: new Date(),
    },
  });

  /*
   * Só depois do upsert bem-sucedido retiramos versões antigas.
   * Se a lixeira falhar, a base NOVA continua publicada.
   */
  await enviarParaLixeira(
    anteriores.map((item) => item.id),
    accessToken,
  );

  return NextResponse.json({
    ok: true,
    status: "ready",
    transportadora: {
      id: transportadora.id,
      nome: transportadora.nome,
    },
    arquivo: {
      id: arquivo.id,
      nome: arquivo.name,
      tamanhoBytes: Number(arquivo.size ?? 0),
      md5: arquivo.md5Checksum ?? null,
      contentType: XLSX_CONTENT_TYPE,
    },
    totalLinhas,
    versoesAnterioresRemovidas: anteriores.length,
  });
}