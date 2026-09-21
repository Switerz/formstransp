import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/auth";
import { EXPORTACAO_ADMIN_CHAVE, obterExportacaoPronta } from "@/lib/exportacoes-download";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireInternalAdmin("/base-completa");
  const principal = await obterExportacaoPronta(EXPORTACAO_ADMIN_CHAVE);
  if (!principal || principal.totalPartes < 1 || principal.totalPartes > 500) {
    return NextResponse.json({ error: "A base administrativa ainda não está disponível." }, { status: 503 });
  }

  const pasta = principal.storagePath.slice(0, principal.storagePath.lastIndexOf("/") + 1);
  const partes = await Promise.all(Array.from({ length: principal.totalPartes }, async (_, i) => {
    const arquivo = i === 0 ? principal : await obterExportacaoPronta(`${EXPORTACAO_ADMIN_CHAVE}:parte:${i + 1}`);
    if (!arquivo || !arquivo.storagePath.startsWith(pasta) || !arquivo.nomeArquivo.endsWith(".xlsx")) return null;
    return { nome: arquivo.nomeArquivo, url: arquivo.signedUrl };
  }));

  if (partes.some((parte) => !parte)) {
    return NextResponse.json({ error: "As partes desta geração estão incompletas. Gere a base administrativa novamente." }, { status: 503 });
  }
  return NextResponse.json({ partes }, { headers: { "Cache-Control": "no-store" } });
}
