import { NextRequest, NextResponse } from "next/server";
import { requireInternalAdmin, requireInternalUser } from "@/lib/auth";
import {
  EXPORTACAO_ADMIN_CHAVE,
  chaveExportacaoTransportadora,
  obterExportacaoPronta,
} from "@/lib/exportacoes-download";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const transportadoraId = request.nextUrl.searchParams.get("transportadoraId")?.trim();
  if (transportadoraId) await requireInternalUser("/base-completa");
  else await requireInternalAdmin("/base-completa");
  const parteRaw = request.nextUrl.searchParams.get("parte");
  const parte = parteRaw === null ? 1 : Number(parteRaw);
  if (!transportadoraId && (!Number.isSafeInteger(parte) || parte < 1)) {
    return NextResponse.json({ error: "Parte inválida." }, { status: 400 });
  }
  if (transportadoraId && parteRaw !== null) {
    return NextResponse.json({ error: "Parte inválida." }, { status: 400 });
  }
  const principal = !transportadoraId ? await obterExportacaoPronta(EXPORTACAO_ADMIN_CHAVE) : null;
  if (!transportadoraId && (!principal || parte > principal.totalPartes)) {
    return NextResponse.json({ error: "Parte indisponível." }, { status: 503 });
  }
  const chave = transportadoraId
    ? chaveExportacaoTransportadora(transportadoraId)
    : parte === 1 ? EXPORTACAO_ADMIN_CHAVE : `${EXPORTACAO_ADMIN_CHAVE}:parte:${parte}`;
  const exportacao = parte === 1 && !transportadoraId ? principal : await obterExportacaoPronta(chave);
  if (!transportadoraId && parte > 1 && exportacao && principal &&
      pathPrefix(exportacao.storagePath) !== pathPrefix(principal.storagePath)) {
    return NextResponse.json({ error: "Parte indisponível nesta geração." }, { status: 503 });
  }

  if (!exportacao) {
    return NextResponse.json(
      { error: "A exportação solicitada ainda não está disponível ou expirou." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.redirect(exportacao.signedUrl, 307);
}

function pathPrefix(storagePath: string) {
  return storagePath.split("/").slice(0, -1).join("/");
}
