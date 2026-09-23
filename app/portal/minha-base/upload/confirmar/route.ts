import { NextResponse } from "next/server";

import { requireCarrierUser } from "@/lib/auth";
import { obterGoogleDriveAccessToken } from "@/lib/google-drive";

export const runtime = "nodejs";

type ConfirmarUploadBody = {
  fileId?: string;
};

type DriveFile = {
  id: string;
  name: string;
  size?: string;
  md5Checksum?: string;
  appProperties?: Record<string, string>;
};

export async function POST(request: Request) {
  try {
    const user = await requireCarrierUser("/portal/minha-base");

    const transportadoraId = user.transportadoraId;

    if (!transportadoraId) {
      return NextResponse.json(
        { erro: "Transportadora não identificada." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as ConfirmarUploadBody;
    const fileId = body.fileId?.trim();

    if (!fileId) {
      return NextResponse.json(
        { erro: "Arquivo não informado." },
        { status: 400 },
      );
    }

    const accessToken = await obterGoogleDriveAccessToken();

    const resposta = await fetch(
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

    if (!resposta.ok) {
      return NextResponse.json(
        { erro: "O arquivo enviado não foi encontrado no Google Drive." },
        { status: 400 },
      );
    }

    const arquivo = (await resposta.json()) as DriveFile & {
      trashed?: boolean;
    };

    if (
      arquivo.trashed ||
      arquivo.appProperties?.formsTranspTipo !==
        "devolucao_transportadora" ||
      arquivo.appProperties?.transportadoraId !== transportadoraId
    ) {
      return NextResponse.json(
        { erro: "O arquivo não pertence a esta transportadora." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      ok: true,
      status: "RECEBIDO",
      arquivo: {
        id: arquivo.id,
        nome: arquivo.name,
        tamanhoBytes: arquivo.size ?? null,
        md5: arquivo.md5Checksum ?? null,
      },
    });
  } catch (error) {
    console.error("[upload-devolucao] Falha ao confirmar upload:", error);

    return NextResponse.json(
      { erro: "Não foi possível confirmar o recebimento do arquivo." },
      { status: 500 },
    );
  }
}
