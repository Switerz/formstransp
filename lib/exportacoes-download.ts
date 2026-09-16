import { prisma } from "@/lib/prisma";

export const EXPORTACAO_ADMIN_CHAVE = "admin:base-completa";

export function chaveExportacaoTransportadora(transportadoraId: string) {
  return `transportadora:${transportadoraId}`;
}

export async function obterExportacaoPronta(chave: string) {
  const exportacao = await prisma.exportacaoArquivo.findUnique({ where: { chave } });
  if (!exportacao || exportacao.status !== "ready") return null;
  if (exportacao.expiresAt.getTime() <= Date.now()) return null;
  return exportacao;
}
