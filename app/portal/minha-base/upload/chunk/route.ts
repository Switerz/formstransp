import { NextResponse } from "next/server";

import { requireCarrierUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    await requireCarrierUser("/portal/minha-base");

    const url = new URL(request.url);
    const uploadUrlRaw = url.searchParams.get("uploadUrl");
    const inicio = Number(url.searchParams.get("inicio"));
    const fim = Number(url.searchParams.get("fim"));
    const total = Number(url.searchParams.get("total"));

    if (!uploadUrlRaw || !Number.isSafeInteger(inicio) || !Number.isSafeInteger(fim) ||
        !Number.isSafeInteger(total) || inicio < 0 || fim < inicio || total <= fim) {
      return NextResponse.json({ erro: "Parâmetros do bloco inválidos." }, { status: 400 });
    }

    const uploadUrl = new URL(uploadUrlRaw);
    if (uploadUrl.protocol !== "https:" ||
        uploadUrl.hostname !== "www.googleapis.com" ||
        uploadUrl.pathname !== "/upload/drive/v3/files" ||
        uploadUrl.searchParams.get("uploadType") !== "resumable" ||
        !uploadUrl.searchParams.get("upload_id")) {
      return NextResponse.json({ erro: "Sessão de upload inválida." }, { status: 400 });
    }

    const bytes = await request.arrayBuffer();
    if (bytes.byteLength !== fim - inicio + 1) {
      return NextResponse.json({ erro: "Tamanho do bloco recebido não confere." }, { status: 400 });
    }

    const respostaDrive = await fetch(uploadUrl.toString(), {
      method: "PUT",
      headers: {
        "Content-Type": request.headers.get("content-type") ??
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Length": String(bytes.byteLength),
        "Content-Range": `bytes ${inicio}-${fim}/${total}`,
      },
      body: bytes,
    });

    if (respostaDrive.status === 308) {
      const range = respostaDrive.headers.get("range");
      const match = range?.match(/bytes=0-(\d+)/);
      return NextResponse.json({
        ok: true,
        proximoInicio: match ? Number(match[1]) + 1 : fim + 1,
      });
    }

    if (!respostaDrive.ok) {
      const detalhe = await respostaDrive.text();
      console.error("[upload-devolucao-chunk]", respostaDrive.status, detalhe);
      return NextResponse.json(
        { erro: `Google Drive recusou o bloco (${respostaDrive.status}).` },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, proximoInicio: total });
  } catch (error) {
    console.error("[upload-devolucao-chunk] Falha:", error);
    return NextResponse.json(
      { erro: error instanceof Error ? error.message : "Não foi possível enviar o bloco." },
      { status: 500 },
    );
  }
}
