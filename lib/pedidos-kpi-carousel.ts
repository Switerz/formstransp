import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatBrazilianDate } from "@/lib/dates";
import type { KpiCard, KpiCarouselProps } from "@/components/pedidos/KpiCarousel";
import { calcularPercentualAbertoTotal } from "@/lib/pedidos-kpis";
import {
  classificarMacroInsucesso,
  classificarMacroStatus,
} from "@/lib/pedidos-classificacao";
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
    pedidosParaClassificacao,
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
        previsaoEntregaTransportadoraOrigem: {
          gte: intervaloPeriodo.gte,
          lt: intervaloPeriodo.lt,
        },
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

    prisma.pedido.findMany({
      where: escopoPeriodo,
      select: {
        microStatus: true,
        statusTransportador: true,
        quantidadeOcorrencias: true,
        ultimaOcorrenciaMicro: true,
        dataDespacho: true,
        motivoDevolucao: true,
        ocorrencia: true,
        canalVendas: true,
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


  let totalPrometidos = 0;
  let totalInsucesso = 0;
  let totalDevolucao = 0;
  let totalPerdas = 0;
  let totalTratativaCx = 0;
  let totalProcessado = 0;

  for (const pedido of pedidosParaClassificacao) {
    /*
     * Regra tempor?ria de identifica??o da marca:
     * consideramos Gocase quando o canal for Site BR (Extrema/MG).
     * Os demais seguem regra GoBeaut?.
     */
    const ehGocase =
      pedido.canalVendas?.trim().toUpperCase() ===
      "SITE BR (EXTREMA/MG)";

    const macroStatus = classificarMacroStatus({
      microStatus: pedido.microStatus,
      statusTransportador: pedido.statusTransportador,
      quantidadeOcorrencias: pedido.quantidadeOcorrencias,
      ehGocase,
    });

    /*
     * Macro Insucesso vem de Ultima Ocorrencia (Micro),
     * campo de origem da Intelipost.
     */
    const macroInsucesso = classificarMacroInsucesso(
      pedido.ultimaOcorrenciaMicro,
    );

    const entraPrometidos =
      macroStatus !== "N\u00E3o Processado";

    if (entraPrometidos) {
      totalPrometidos += 1;
    }

    if (entraPrometidos && macroInsucesso) {
      totalInsucesso += 1;
    }

    if (
      entraPrometidos &&
      (
        macroStatus === "Devolu\u00E7\u00E3o" ||
        macroStatus === "Devolvido" ||
        Boolean(pedido.motivoDevolucao?.trim())
      )
    ) {
      totalDevolucao += 1;
    }

    if (
      entraPrometidos &&
      macroStatus === "Extravio/Sinistro/Avaria"
    ) {
      totalPerdas += 1;
    }

    if (
      entraPrometidos &&
      (
        macroStatus === "Tratativa CX" ||
        macroStatus === "Retirada Correios"
      )
    ) {
      totalTratativaCx += 1;
    }

    if (
      pedido.dataDespacho &&
      macroStatus !== "N\u00E3o Processado"
    ) {
      totalProcessado += 1;
    }
  }

  const percentualInsucesso = calcularPercentual(
    totalInsucesso,
    totalPrometidos,
  );

  const percentualDevolucao = calcularPercentual(
    totalDevolucao,
    totalPrometidos,
  );

  const percentualPerdas = calcularPercentual(
    totalPerdas,
    totalPrometidos,
  );

  const percentualTratativaCx = calcularPercentual(
    totalTratativaCx,
    totalPrometidos,
  );

  const percentualProcessado = calcularPercentual(
    totalProcessado,
    totalPedidos,
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
      icon: "?",
      label: "Taxa de Insucesso",
      value: `${percentualInsucesso}%`,
      hint: `${totalInsucesso.toLocaleString("pt-BR")} pedido(s) com Macro Insucesso de ${totalPrometidos.toLocaleString("pt-BR")} prometidos`,
    },

    taxaDevolucao: {
      icon: "?",
      label: "Taxa de Devolu\u00e7\u00e3o",
      value: `${percentualDevolucao}%`,
      hint: `${totalDevolucao.toLocaleString("pt-BR")} pedido(s) em devolu\u00e7\u00e3o/devolvidos de ${totalPrometidos.toLocaleString("pt-BR")} prometidos`,
    },

    pedidosAbertos: pedidosAbertosCard,

    tratativaCx: {
      icon: "?",
      label: "Tratativa CX",
      value: `${percentualTratativaCx}%`,
      hint: `${totalTratativaCx.toLocaleString("pt-BR")} pedido(s) em Tratativa CX/Retirada Correios de ${totalPrometidos.toLocaleString("pt-BR")} prometidos`,
    },

    riscoAtraso: pedidosVencidosCard,

    processado: {
      icon: "?",
      label: "Processado",
      value: `${percentualProcessado}%`,
      hint: `${totalProcessado.toLocaleString("pt-BR")} pedido(s) processados de ${totalPedidos.toLocaleString("pt-BR")} linhas`,
    },

    perdas: {
      icon: "?",
      label: "Perdas Extr/Sint/Avar",
      value: `${percentualPerdas}%`,
      hint: `${totalPerdas.toLocaleString("pt-BR")} pedido(s) com Extravio/Sinistro/Avaria de ${totalPrometidos.toLocaleString("pt-BR")} prometidos`,
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
