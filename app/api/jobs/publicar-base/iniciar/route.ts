import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  criarSessaoUploadBaseTransportadora,
} from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function autorizado(request: NextRequest) {
  const secret = request.headers.get("x-pedidos-import-secret");
  const expectedSecret = process.env.PEDIDOS_IMPORT_SECRET;

  return Boolean(
    expectedSecret &&
      secret &&
      secret === expectedSecret,
  );
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

  const transportadoraId =
    typeof dados.transportadoraId === "string"
      ? dados.transportadoraId.trim()
      : "";

  const nomeArquivo =
    typeof dados.nomeArquivo === "string"
      ? dados.nomeArquivo.trim()
      : "";

  const tamanhoBytes =
    typeof dados.tamanhoBytes === "number"
      ? dados.tamanhoBytes
      : Number(dados.tamanhoBytes);

  if (!transportadoraId) {
    return NextResponse.json(
      { error: "transportadoraId obrigatório" },
      { status: 400 },
    );
  }

  if (!nomeArquivo.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json(
      { error: "o arquivo deve ser XLSX" },
      { status: 400 },
    );
  }

  if (
    !Number.isSafeInteger(tamanhoBytes) ||
    tamanhoBytes <= 0
  ) {
    return NextResponse.json(
      { error: "tamanhoBytes inválido" },
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

  try {
    const uploadUrl =
      await criarSessaoUploadBaseTransportadora({
        transportadoraId: transportadora.id,
        transportadoraNome: transportadora.nome,
        nomeArquivo,
        tamanhoBytes,
      });

    return NextResponse.json({
      ok: true,
      uploadUrl,
      contentType: XLSX_CONTENT_TYPE,
      transportadora: {
        id: transportadora.id,
        nome: transportadora.nome,
      },
    });
  } catch (error) {
    console.error(
      "[publicar-base/iniciar] Erro ao criar sessão:",
      error,
    );

    return NextResponse.json(
      {
        error: "não foi possível iniciar o upload",
      },
      { status: 500 },
    );
  }
}