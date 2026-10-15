import { NextResponse } from "next/server";
import { requireCarrierUser } from "@/lib/auth";
import { obterGoogleDriveAccessToken } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escaparDriveQuery(valor: string) {
  return valor
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

export async function GET() {
  const user = await requireCarrierUser("/portal/minha-base");

  const transportadoraId = user.transportadoraId;

  if (!transportadoraId) {
    return NextResponse.json(
      { error: "Transportadora não identificada." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const accessToken = await obterGoogleDriveAccessToken();
    const chave = `transportadora:${transportadoraId}`;

    const query =
      `trashed = false and ` +
      `appProperties has { key='formsTranspKey' and value='${escaparDriveQuery(chave)}' }`;

    const url = new URL(
      "https://www.googleapis.com/drive/v3/files",
    );

    url.searchParams.set("q", query);
    url.searchParams.set("spaces", "drive");
    url.searchParams.set("pageSize", "10");
    url.searchParams.set(
      "fields",
      "files(id,name,createdTime,modifiedTime)",
    );
    url.searchParams.set(
      "orderBy",
      "modifiedTime desc",
    );

    const resposta = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      console.error(
        `[minha-base/download] Falha ao consultar Drive (${resposta.status}): ${detalhe}`,
      );

      return NextResponse.json(
        { error: "Não foi possível localizar a base no momento." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const dados = (await resposta.json()) as {
      files?: Array<{
        id: string;
        name: string;
        createdTime?: string;
        modifiedTime?: string;
      }>;
    };

    const arquivo = dados.files?.[0];

    if (!arquivo) {
      return NextResponse.json(
        {
          error:
            "A base está sendo preparada. Tente novamente em alguns minutos.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const downloadUrl =
      `https://drive.usercontent.google.com/download` +
      `?id=${encodeURIComponent(arquivo.id)}` +
      `&export=download&confirm=t`;

    return NextResponse.redirect(downloadUrl, 307);
  } catch (error) {
    console.error(
      "[minha-base/download] Erro ao localizar base:",
      error,
    );

    return NextResponse.json(
      { error: "Não foi possível baixar a base no momento." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
