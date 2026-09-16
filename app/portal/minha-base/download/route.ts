import { NextResponse } from "next/server";
import { requireCarrierUser } from "@/lib/auth";
import { chaveExportacaoTransportadora, obterExportacaoPronta } from "@/lib/exportacoes-download";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireCarrierUser("/portal/minha-base");
  const exportacao = await obterExportacaoPronta(
    chaveExportacaoTransportadora(user.transportadoraId!),
  );

  if (!exportacao) {
    return NextResponse.json(
      { error: "A base está sendo preparada. Tente novamente em alguns minutos." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.redirect(exportacao.signedUrl, 307);
}
