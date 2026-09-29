import { prisma } from "@/lib/prisma";
import { type LinhaPreparada, type ErroLinha } from "@/lib/base-original-preparar";

export type { LinhaPreparada, ErroLinha } from "@/lib/base-original-preparar";
export { prepararLinhasBaseOriginal, textoOuNull, decimalOuNull, dataOuNull, CANONICAL_TO_ORIGEM_FIELD } from "@/lib/base-original-preparar";

export interface ResultadoGravacaoLote {
  inseridos: number;
  atualizados: number;
  erros: ErroLinha[];
}

/**
 * Grava um LOTE de linhas já preparadas (findMany + createMany + transaction
 * em lote, mesma lógica já usada no upload direto - extraída para reuso).
 * TAMANHO_LOTE_DB controla o tamanho de cada sub-lote de escrita (findMany +
 * transaction), independente do tamanho do "lote" que o chamador externo
 * decide processar por invocação (que pode ser maior, agrupando vários
 * sub-lotes de escrita numa única chamada de servidor).
 */
export async function gravarLoteBaseOriginal(preparados: LinhaPreparada[]): Promise<ResultadoGravacaoLote> {
  const resultado: ResultadoGravacaoLote = { inseridos: 0, atualizados: 0, erros: [] };
  const TAMANHO_LOTE_DB = 500;

  for (let offset = 0; offset < preparados.length; offset += TAMANHO_LOTE_DB) {
    const lote = preparados.slice(offset, offset + TAMANHO_LOTE_DB);
    const existentes = await prisma.pedido.findMany({
      where: { pedido: { in: lote.map((item) => item.pedido) } },
      select: { pedido: true },
    });
    const existentesSet = new Set(existentes.map((item: { pedido: string }) => item.pedido));

    const novos = lote.filter((item) => !existentesSet.has(item.pedido));
    const novosValidos = novos.filter((item) => {
      if (item.data.dataCriacaoPedido instanceof Date) return true;
      resultado.erros.push({
        linha: item.linha,
        pedido: item.pedido,
        motivo: 'Pedido novo exige a coluna "Data Criação" válida da Intelipost; a data do upload não é usada como substituta.',
      });
      return false;
    });

    if (novosValidos.length > 0) {
      const created = await prisma.pedido.createMany({
        data: novosValidos.map((item) => item.data),
        skipDuplicates: true,
      });
      resultado.inseridos += created.count;
    }

    const updates = lote.filter((item) => existentesSet.has(item.pedido));
    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map((item) => {
          const { pedido: _pedido, ...data } = item.data;
          return prisma.pedido.update({ where: { pedido: item.pedido }, data });
        }),
      );
      resultado.atualizados += updates.length;
    }
  }

  return resultado;
}
