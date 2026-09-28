import { NextResponse } from "next/server";

import { requireCarrierUser } from "@/lib/auth";
import { criarSessaoUploadDevolucao } from "@/lib/google-drive";

export const runtime = "nodejs";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type IniciarUploadBody = {
  nomeArquivo?: string;
  tamanhoBytes?: number;
};

export async function POST(request: Request) {
  try {
    const user = await requireCarrierUser("/portal/minha-base");
    const body = (await request.json()) as IniciarUploadBody;

    const nomeArquivo = body.nomeArquivo?.trim();
    const tamanhoBytes = Number(body.tamanhoBytes);

    if (!nomeArquivo || !nomeArquivo.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { erro: "Selecione um arquivo XLSX vÃ¡lido." },
        { status: 400 },
      );
    }

    if (!Number.isSafeInteger(tamanhoBytes) || tamanhoBytes <= 0) {
      return NextResponse.json(
        { erro: "Tamanho do arquivo invÃ¡lido." },
        { status: 400 },
      );
    }

    const transportadoraId = user.transportadoraId;
    if (!transportadoraId) {
      return NextResponse.json(
        { erro: "Transportadora nÃ£o identificada para este usuÃ¡rio." },
        { status: 403 },
      );
    }

    // O limite diÃ¡rio Ã© validado na confirmaÃ§Ã£o, diretamente contra
    // a base oficial do Drive. Aqui apenas abrimos a sessÃ£o de upload.
    const transportadoraNome = user.transportadora?.nome ?? null;
    const nomeSeguro = nomeArquivo
      .replace(/[^\p{L}\p{N}._ -]/gu, "_")
      .slice(0, 180);

    const nomeDrive =
      `devolucao_${transportadoraId}_${Date.now()}_${nomeSeguro}`;

    const uploadUrl = await criarSessaoUploadDevolucao({
      nomeArquivo: nomeDrive,
      tamanhoBytes,
      transportadoraId,
      transportadoraNome,
    });

    return NextResponse.json({
      uploadUrl,
      contentType: XLSX_MIME,
    });
  } catch (error) {
    console.error("[upload-devolucao] Falha ao iniciar upload:", error);

    return NextResponse.json(
      { erro: "NÃ£o foi possÃ­vel iniciar o envio do arquivo." },
      { status: 500 },
    );
  }
}

