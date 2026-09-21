import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/auth";
import { EXPORTACAO_ADMIN_CHAVE, obterExportacaoPronta } from "@/lib/exportacoes-download";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireInternalAdmin("/base-completa");
  const [base, csv] = await Promise.all([
    obterExportacaoPronta(EXPORTACAO_ADMIN_CHAVE),
    obterExportacaoPronta(`${EXPORTACAO_ADMIN_CHAVE}:csv`),
  ]);
  if (!base || !csv || csv.totalPartes < 1 || csv.totalPartes > 500) {
    return NextResponse.json({ error: "CSV consolidado ainda não disponível." }, { status: 503 });
  }
  const pasta = base.storagePath.slice(0, base.storagePath.lastIndexOf("/") + 1);
  if (!csv.storagePath.startsWith(`${pasta}csv/`)) {
    return NextResponse.json({ error: "O CSV desta geração ainda não está pronto." }, { status: 503 });
  }
  const partes = await Promise.all(Array.from({ length: csv.totalPartes }, async (_, indice) => {
    const arquivo = await obterExportacaoPronta(`${EXPORTACAO_ADMIN_CHAVE}:csv:parte:${indice + 1}`);
    if (!arquivo || !arquivo.storagePath.startsWith(`${pasta}csv/`) || !arquivo.storagePath.endsWith(".csv")) return null;
    return { url: arquivo.signedUrl };
  }));
  if (partes.some((parte) => !parte)) {
    return NextResponse.json({ error: "Partes do CSV incompletas." }, { status: 503 });
  }
  return NextResponse.json({ partes }, { headers: { "Cache-Control": "no-store" } });
}
