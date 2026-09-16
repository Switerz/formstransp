import { NextRequest, NextResponse } from "next/server";
import { requireInternalUser } from "@/lib/auth";
import {
  EXPORTACAO_ADMIN_CHAVE,
  chaveExportacaoTransportadora,
  obterExportacaoPronta,
} from "@/lib/exportacoes-download";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await requireInternalUser("/base-completa");
  const transportadoraId = request.nextUrl.searchParams.get("transportadoraId")?.trim();
  const chave = transportadoraId
    ? chaveExportacaoTransportadora(transportadoraId)
    : EXPORTACAO_ADMIN_CHAVE;
  const exportacao = await obterExportacaoPronta(chave);

  if (!exportacao) {
    return NextResponse.json(
      { error: "A exportação solicitada ainda não está disponível ou expirou." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.redirect(exportacao.signedUrl, 307);
}
