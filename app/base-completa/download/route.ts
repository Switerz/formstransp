import { NextRequest, NextResponse } from "next/server";
import {
  requireInternalAdmin,
  requireInternalUser,
} from "@/lib/auth";
import { obterGoogleDriveAccessToken } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escaparDriveQuery(valor: string) {
  return valor
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

type DriveFile = {
  id: string;
  name: string;
  createdTime?: string;
  modifiedTime?: string;
};

async function consultarDrive(
  accessToken: string,
  query: string,
): Promise<DriveFile[]> {
  const url = new URL(
    "https://www.googleapis.com/drive/v3/files",
  );

  url.searchParams.set("q", query);
  url.searchParams.set("spaces", "drive");
  url.searchParams.set("pageSize", "20");
  url.searchParams.set(
    "fields",
    "files(id,name,createdTime,modifiedTime)",
  );
  url.searchParams.set("orderBy", "modifiedTime desc");

  const resposta = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();

    console.error(
      `[base-completa/download] Drive ${resposta.status}: ${detalhe}`,
    );

    throw new Error(
      `Falha ao consultar Google Drive (${resposta.status}).`,
    );
  }

  const dados = (await resposta.json()) as {
    files?: DriveFile[];
  };

  return dados.files ?? [];
}

export async function GET(request: NextRequest) {
  const transportadoraId =
    request.nextUrl.searchParams
      .get("transportadoraId")
      ?.trim() || null;

  if (transportadoraId) {
    await requireInternalUser("/base-completa");
  } else {
    await requireInternalAdmin("/base-completa");
  }

  try {
    const accessToken =
      await obterGoogleDriveAccessToken();

    let arquivos: DriveFile[];

    if (transportadoraId) {
      const chave =
        `transportadora:${transportadoraId}`;

      const query =
        `trashed = false and ` +
        `appProperties has { ` +
        `key='formsTranspKey' and ` +
        `value='${escaparDriveQuery(chave)}' }`;

      arquivos = await consultarDrive(
        accessToken,
        query,
      );
    } else {
      const folderId =
        process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();

      if (!folderId) {
        throw new Error(
          "GOOGLE_DRIVE_FOLDER_ID não configurado.",
        );
      }

      const query =
        `trashed = false and ` +
        `'${escaparDriveQuery(folderId)}' in parents and ` +
        `name = 'BASE_GERAL.xlsx'`;

      arquivos = await consultarDrive(
        accessToken,
        query,
      );
    }

    const arquivo = arquivos[0];

    if (!arquivo) {
      return NextResponse.json(
        {
          error: transportadoraId
            ? "A base desta transportadora ainda não está disponível."
            : "BASE_GERAL.xlsx não foi encontrada no Google Drive.",
        },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const downloadUrl =
      `https://drive.usercontent.google.com/download` +
      `?id=${encodeURIComponent(arquivo.id)}` +
      `&export=download&confirm=t`;

    return NextResponse.redirect(
      downloadUrl,
      307,
    );
  } catch (error) {
    console.error(
      "[base-completa/download] Erro:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível baixar a base no momento.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
