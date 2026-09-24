import { NextResponse } from "next/server";

import { requireCarrierUser } from "@/lib/auth";
import { criarSessaoUploadDevolucao } from "@/lib/google-drive";

export const runtime = "nodejs";
export const maxDuration = 300;

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function POST(request: Request) {
  try {
    const user = await requireCarrierUser("/portal/minha-base");

    if (!user.transportadoraId) {
      return NextResponse.json(
        { erro: "Transportadora não identificada." },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const arquivo = formData.get("arquivo");

    if (!(arquivo instanceof File) || arquivo.size === 0) {
      return NextResponse.json(
        { erro: "Selecione um arquivo XLSX válido." },
        { status: 400 },
      );
    }

    if (!arquivo.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { erro: "O arquivo precisa estar no formato XLSX." },
        { status: 400 },
      );
    }

    const nomeSeguro = arquivo.name
      .replace(/[^\p{L}\p{N}._ -]/gu, "_")
      .slice(0, 180);

    const nomeDrive =
      `devolucao_${user.transportadoraId}_${Date.now()}_${nomeSeguro}`;

    const uploadUrl = await criarSessaoUploadDevolucao({
      nomeArquivo: nomeDrive,
      tamanhoBytes: arquivo.size,
      transportadoraId: user.transportadoraId,
      transportadoraNome: user.transportadora?.nome ?? null,
    });

    const bytes = await arquivo.arrayBuffer();

    const respostaDrive = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Length": String(arquivo.size),
      },
      body: bytes,
    });

    if (!respostaDrive.ok) {
      const detalhe = await respostaDrive.text();

      console.error(
        "[upload-devolucao] Google Drive recusou upload:",
        respostaDrive.status,
        detalhe,
      );

      return NextResponse.json(
        { erro: `O Google Drive recusou o arquivo (${respostaDrive.status}).` },
        { status: 502 },
      );
    }

    const drive = (await respostaDrive.json()) as {
      id?: string;
      name?: string;
      size?: string;
      md5Checksum?: string;
    };

    if (!drive.id) {
      return NextResponse.json(
        { erro: "Google Drive recebeu o arquivo, mas não retornou o ID." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      status: "RECEBIDO",
      arquivo: {
        id: drive.id,
        nome: drive.name ?? nomeDrive,
        tamanhoBytes: drive.size ?? String(arquivo.size),
        md5: drive.md5Checksum ?? null,
      },
    });
  } catch (error) {
    console.error("[upload-devolucao] Falha no envio:", error);

    return NextResponse.json(
      {
        erro:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar o arquivo.",
      },
      { status: 500 },
    );
  }
}
