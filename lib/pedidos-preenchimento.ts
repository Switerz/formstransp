import { prisma } from "@/lib/prisma";

export interface ResumoPreenchimentoCompleto {
  pending: number;
  partial: number;
  done: number;
}

interface LinhaResumo {
  total: number;
  pending: number;
  done: number;
}

export async function obterResumoPreenchimentoCompleto(
  transportadoraId: string,
): Promise<ResumoPreenchimentoCompleto> {
  const [resumo] = await prisma.$queryRaw<LinhaResumo[]>`
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (WHERE
        "dataColetaProcessamento" IS NULL AND
        "dataPrevisao" IS NULL AND
        "prazoEntregaDiasUteis" IS NULL AND
        "dataEntrega" IS NULL AND
        NULLIF(BTRIM(COALESCE("statusAtual", '')), '') IS NULL AND
        NULLIF(BTRIM(COALESCE("ocorrencia", '')), '') IS NULL AND
        NULLIF(BTRIM(COALESCE("motivoDevolucao", '')), '') IS NULL AND
        NULLIF(BTRIM(COALESCE("slaStatus", '')), '') IS NULL AND
        NULLIF(BTRIM(COALESCE("justificativaAtraso", '')), '') IS NULL AND
        "novaDataPrevisao" IS NULL AND
        "dataResolucaoDevolucao" IS NULL
      )::int AS "pending",
      COUNT(*) FILTER (WHERE
        "dataColetaProcessamento" IS NOT NULL AND
        "dataPrevisao" IS NOT NULL AND
        "prazoEntregaDiasUteis" IS NOT NULL AND
        "dataEntrega" IS NOT NULL AND
        NULLIF(BTRIM(COALESCE("statusAtual", '')), '') IS NOT NULL AND
        NULLIF(BTRIM(COALESCE("ocorrencia", '')), '') IS NOT NULL AND
        NULLIF(BTRIM(COALESCE("motivoDevolucao", '')), '') IS NOT NULL AND
        NULLIF(BTRIM(COALESCE("slaStatus", '')), '') IS NOT NULL AND
        NULLIF(BTRIM(COALESCE("justificativaAtraso", '')), '') IS NOT NULL AND
        "novaDataPrevisao" IS NOT NULL AND
        "dataResolucaoDevolucao" IS NOT NULL
      )::int AS "done"
    FROM "public"."pedidos"
    WHERE "transportadoraId" = ${transportadoraId}
      AND "dataEntregaOrigem" IS NULL
  `;

  const total = resumo?.total ?? 0;
  const pending = resumo?.pending ?? 0;
  const done = resumo?.done ?? 0;
  return { pending, done, partial: Math.max(0, total - pending - done) };
}
