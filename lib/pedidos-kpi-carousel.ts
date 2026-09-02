import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatBrazilianDate } from "@/lib/dates";
import type { KpiCard, KpiCarouselProps } from "@/components/pedidos/KpiCarousel";
import { calcularPercentualAbertoTotal } from "@/lib/pedidos-kpis";
import {
  parsePeriodoFilters,
  periodoParaIntervaloDatas,
  type Periodo,
} from "@/lib/pedidos-periodo";

const EM_CONSTRUCAO: Omit<KpiCard, "icon" | "label"> = {
  value: "Em constru\u00e7\u00e3o",
  hint: "Indicador em constru\u00e7\u00e3o",
  className: "kpi-card-building",
};

export interface DadosKpiCarousel {
  periodo: Periodo;
  props: KpiCarouselProps;
  ultimaCargaLabel: string;
  hasBaseUpdate: boolean;
}

function calcularPercentual(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 1000) / 10 : 0;
}

export async function montarDadosKpiCarousel(
  transportadoraId: string | null,
  rawSearchParams: Record<string, string | undefined>,
  baseWhere: Prisma.PedidoWhereInput = {},
): Promise<DadosKpiCarousel> {
  const periodo = parsePeriodoFilters(rawSearchParams);
  const intervaloPeriodo = periodoParaIntervaloDatas(periodo);

  const escopoTransportadora: Prisma.PedidoWhereInput = {
    ...baseWhere,
    ...(transportadoraId ? { transportadoraId } : {}),
  };

  /*
   * Regra dos cards:
   * - o banco continua mantendo a janela completa dispon?vel;
   * - os Grandes N?meros obedecem ao DE/AT? selecionado;
   * - para Total/Abertos/SLA, o recorte ? pela Data Cria??o do pedido.
   */
  const escopoPeriodo: Prisma.PedidoWhereInput = {
    ...escopoTransportadora,
    dataCriacaoPedido: intervaloPeriodo,
  };

  const [
    totalPedidos,
    pedidosAbertosCount,
    pedidosVencidosCount,
    pedidosParaSla,
    ultimaCarga,
    ultimaDevolucao,
  ] = await Promise.all([
    prisma.pedido.count({
      where: escopoPeriodo,
    }),

    prisma.pedido.count({
      where: {
        ...escopoPeriodo,
        dataEntregaOrigem: null,
      },
    }),

    prisma.pedido.count({
      where: {
        ...escopoTransportadora,
        dataEntregaOrigem: null,
        previsaoEntregaTransportadoraOrigem: intervaloPeriodo,
      },
    }),

    prisma.pedido.findMany({
      where: {
        ...escopoPeriodo,
        dataEntregaOrigem: {
          not: null,
        },
        OR: [
          {
            previsaoEntregaTransportadoraOrigem: {
              not: null,
            },
          },
          {
            previsaoEntregaClienteOrigem: {
              not: null,
            },
          },
        ],
      },
      select: {
        dataEntregaOrigem: true,
        previsaoEntregaTransportadoraOrigem: true,
        previsaoEntregaClienteOrigem: true,
      },
    }),

    prisma.automationLog.findFirst({
      where: {
        tipo: "pedidos_import",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
      },
    }),

    prisma.automationLog.findFirst({
      where: {
        tipo: "pedidos_devolucao",
        ...(transportadoraId ? { transportadoraId } : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
      },
    }),
  ]);

  const percentualAbertoTotal = calcularPercentualAbertoTotal(
    totalPedidos,
    pedidosAbertosCount,
  );

  /*
   * SLA Transporte:
   * Data Entrega Origem <= Previs\u00e3o Entrega Transportadora = NO PRAZO.
   * S? entram no denominador pedidos j? entregues e com previs\u00e3o dispon?vel.
   */
  let totalAvaliavelSlaTransporte = 0;
  let noPrazoSlaTransporte = 0;

  /*
   * SLA Cliente:
   * Data Entrega Origem <= Previs?o Entrega Cliente = NO PRAZO.
   * S? entram no denominador pedidos j? entregues e com previs\u00e3o dispon?vel.
   */
  let totalAvaliavelSlaCliente = 0;
  let noPrazoSlaCliente = 0;

  for (const pedido of pedidosParaSla) {
    const entrega = pedido.dataEntregaOrigem;

    if (!entrega) {
      continue;
    }

    if (pedido.previsaoEntregaTransportadoraOrigem) {
      totalAvaliavelSlaTransporte += 1;

      if (
        entrega.getTime() <=
        pedido.previsaoEntregaTransportadoraOrigem.getTime()
      ) {
        noPrazoSlaTransporte += 1;
      }
    }

    if (pedido.previsaoEntregaClienteOrigem) {
      totalAvaliavelSlaCliente += 1;

      if (
        entrega.getTime() <=
        pedido.previsaoEntregaClienteOrigem.getTime()
      ) {
        noPrazoSlaCliente += 1;
      }
    }
  }

  const percentualSlaTransporte = calcularPercentual(
    noPrazoSlaTransporte,
    totalAvaliavelSlaTransporte,
  );

  const percentualSlaCliente = calcularPercentual(
    noPrazoSlaCliente,
    totalAvaliavelSlaCliente,
  );

  const totalPedidosCard: KpiCard = {
    icon: "?",
    label: "Total Expedido",
    value: totalPedidos.toLocaleString("pt-BR"),
    hint: `Pedidos criados entre ${formatBrazilianDate(
      intervaloPeriodo.gte,
    )} e ${periodo.ate.split("-").reverse().join("/")}`,
  };

  const pedidosAbertosCard: KpiCard = {
    icon: "?",
    label: "Pedidos em Aberto",
    value: pedidosAbertosCount.toLocaleString("pt-BR"),
    hint: "Pedidos do per\u00edodo ainda sem Data Entrega Origem",
  };

  const abertoTotalCard: KpiCard = {
    icon: "?",
    label: "% Aberto/Total",
    value: `${percentualAbertoTotal}%`,
    hint: `${pedidosAbertosCount.toLocaleString(
      "pt-BR",
    )} em aberto de ${totalPedidos.toLocaleString("pt-BR")} expedidos`,
  };

  const slaTransporteCard: KpiCard = {
    icon: "?",
    label: "SLA Transporte",
    value:
      totalAvaliavelSlaTransporte > 0
        ? `${percentualSlaTransporte}%`
        : "?",
    hint:
      totalAvaliavelSlaTransporte > 0
        ? `${noPrazoSlaTransporte.toLocaleString(
            "pt-BR",
          )} no prazo de ${totalAvaliavelSlaTransporte.toLocaleString(
            "pt-BR",
          )} entregues avali\u00e1veis`
        : "Sem pedidos entregues com previs\u00e3o da transportadora no per\u00edodo",
  };

  const slaClienteCard: KpiCard = {
    icon: "?",
    label: "SLA Cliente",
    value:
      totalAvaliavelSlaCliente > 0
        ? `${percentualSlaCliente}%`
        : "?",
    hint:
      totalAvaliavelSlaCliente > 0
        ? `${noPrazoSlaCliente.toLocaleString(
            "pt-BR",
          )} no prazo de ${totalAvaliavelSlaCliente.toLocaleString(
            "pt-BR",
          )} entregues avali\u00e1veis`
        : "Sem pedidos entregues com previs\u00e3o cliente no per\u00edodo",
  };

  const pedidosVencidosCard: KpiCard = {
    icon: "?",
    label: "Pedidos Vencidos",
    value: pedidosVencidosCount.toLocaleString("pt-BR"),
    hint: `Previs\u00e3o Entrega Transportadora entre ${formatBrazilianDate(
      intervaloPeriodo.gte,
    )} e ${periodo.ate.split("-").reverse().join("/")}`,
  };

  const props: KpiCarouselProps = {
    slaAjusteTransporte: {
      ...EM_CONSTRUCAO,
      icon: "?",
      label: "SLA Ajuste Transporte",
    },

    slaTransporte: slaTransporteCard,

    slaCliente: slaClienteCard,

    taxaInsucesso: {
      ...EM_CONSTRUCAO,
      icon: "?",
      label: "Taxa de Insucesso",
    },

    taxaDevolucao: {
      ...EM_CONSTRUCAO,
      icon: "?",
      label: "Taxa de Devolu\u00e7\u00e3o",
    },

    pedidosAbertos: pedidosAbertosCard,

    tratativaCx: {
      ...EM_CONSTRUCAO,
      icon: "?",
      label: "Tratativa CX",
    },

    riscoAtraso: pedidosVencidosCard,

    processado: {
      ...EM_CONSTRUCAO,
      icon: "?",
      label: "Processado",
    },

    perdas: {
      ...EM_CONSTRUCAO,
      icon: "?",
      label: "Perdas Extr/Sint/Avar",
    },

    totalPedidos: totalPedidosCard,

    abertoTotal: abertoTotalCard,

    integridade: {
      icon: "?",
      label: "Integridade da devolu\u00e7\u00e3o",
      value: "Aguardando",
      hint: "Envie a devolu\u00e7\u00e3o da base",
      id: "iIntegrity",
    },

    status: {
      icon: "?",
      label: "Status",
      value: ultimaDevolucao ? "Recebida" : "Aguardando",
      hint: ultimaDevolucao
        ? formatBrazilianDate(ultimaDevolucao.createdAt)
        : "Nenhuma devolu\u00e7\u00e3o recebida ainda",
      id: "mStatus",
    },
  };

  return {
    periodo,
    props,
    ultimaCargaLabel: ultimaCarga
      ? formatBrazilianDate(ultimaCarga.createdAt)
      : "Aguardando carga",
    hasBaseUpdate: Boolean(ultimaCarga),
  };
}
