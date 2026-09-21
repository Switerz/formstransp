import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Resumo = { total: number; preenchidos: number; respondidos: number };
type Linha = { total: bigint; preenchidos: bigint; respondidos: bigint };

// Um único percurso pelo recorte administrativo substitui três COUNTs separados.
export async function obterResumoPreenchimentoInterno(
  where: Prisma.PedidoWhereInput,
): Promise<Resumo> {
  const periodo = where.dataCriacaoPedido as { gte?: Date; gt?: Date; lt?: Date; lte?: Date } | undefined;
  if (!periodo || ![periodo.gte, periodo.gt, periodo.lt, periodo.lte].some((data) => data instanceof Date)) {
    throw new Error("Janela da Base Completa inválida para calcular o resumo.");
  }
  const filtros: Prisma.Sql[] = [];
  if (periodo.gte) filtros.push(Prisma.sql`"dataCriacaoPedido" >= ${periodo.gte}`);
  if (periodo.gt) filtros.push(Prisma.sql`"dataCriacaoPedido" > ${periodo.gt}`);
  if (periodo.lt) filtros.push(Prisma.sql`"dataCriacaoPedido" < ${periodo.lt}`);
  if (periodo.lte) filtros.push(Prisma.sql`"dataCriacaoPedido" <= ${periodo.lte}`);
  if (typeof where.transportadoraId === "string") {
    filtros.push(Prisma.sql`"transportadoraId" = ${where.transportadoraId}`);
  }
  const preenchido = Prisma.sql`(
    "dataColetaProcessamento" IS NOT NULL OR "dataPrevisao" IS NOT NULL OR
    "prazoEntregaDiasUteis" IS NOT NULL OR "dataEntrega" IS NOT NULL OR
    "statusAtual" IS NOT NULL OR "ocorrencia" IS NOT NULL OR
    "motivoDevolucao" IS NOT NULL OR "slaStatus" IS NOT NULL OR
    "justificativaAtraso" IS NOT NULL OR "novaDataPrevisao" IS NOT NULL OR
    "dataResolucaoDevolucao" IS NOT NULL
  )`;
  const respondido = Prisma.sql`(
    "dataColetaProcessamento" IS NOT NULL AND "dataPrevisao" IS NOT NULL AND
    "prazoEntregaDiasUteis" IS NOT NULL AND "dataEntrega" IS NOT NULL AND
    "statusAtual" IS NOT NULL AND "ocorrencia" IS NOT NULL AND
    "motivoDevolucao" IS NOT NULL AND "slaStatus" IS NOT NULL AND
    "justificativaAtraso" IS NOT NULL AND "novaDataPrevisao" IS NOT NULL AND
    "dataResolucaoDevolucao" IS NOT NULL
  )`;
  const [linha] = await prisma.$queryRaw<Linha[]>(Prisma.sql`
    SELECT COUNT(*) AS total,
      COUNT(*) FILTER (WHERE ${preenchido}) AS preenchidos,
      COUNT(*) FILTER (WHERE ${respondido}) AS respondidos
    FROM "public"."pedidos"
    WHERE ${Prisma.join(filtros, " AND ")}
  `);
  return {
    total: Number(linha?.total ?? 0),
    preenchidos: Number(linha?.preenchidos ?? 0),
    respondidos: Number(linha?.respondidos ?? 0),
  };
}
