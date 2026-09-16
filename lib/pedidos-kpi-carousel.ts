import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatBrazilianDate } from "@/lib/dates";
import type { KpiCard, KpiCarouselProps } from "@/components/pedidos/KpiCarousel";
import { calcularPercentualAbertoTotal } from "@/lib/pedidos-kpis";
import { parsePeriodoFilters, periodoParaIntervaloDatas, type Periodo } from "@/lib/pedidos-periodo";

const ATUALIZANDO: Omit<KpiCard, "icon" | "label"> = {
  value: "Atualizando",
  hint: "Indicador sendo consolidado pela atualização automática",
  className: "kpi-card-building",
};

export interface DadosKpiCarousel {
  periodo: Periodo;
  props: KpiCarouselProps;
  ultimaCargaLabel: string;
  hasBaseUpdate: boolean;
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
  const escopoPeriodo: Prisma.PedidoWhereInput = {
    ...escopoTransportadora,
    dataCriacaoPedido: intervaloPeriodo,
  };

  // A abertura da página executa somente agregações indexadas. Os indicadores
  // que exigem percorrer milhares de linhas serão consolidados fora da web.
  const [totalPedidos, pedidosAbertosCount, pedidosVencidosCount, ultimaCarga, ultimaDevolucao] =
    await Promise.all([
      prisma.pedido.count({ where: escopoPeriodo }),
      prisma.pedido.count({ where: { ...escopoPeriodo, dataEntregaOrigem: null } }),
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
      prisma.automationLog.findFirst({
        where: { tipo: "pedidos_import" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.automationLog.findFirst({
        where: { tipo: "pedidos_devolucao", ...(transportadoraId ? { transportadoraId } : {}) },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

  const percentualAbertoTotal = calcularPercentualAbertoTotal(totalPedidos, pedidosAbertosCount);
  const periodoLabel = `${periodo.de.split("-").reverse().join("/")} a ${periodo.ate
    .split("-").reverse().join("/")}`;
  const pendente = (label: string): KpiCard => ({ ...ATUALIZANDO, icon: "…", label });

  const props: KpiCarouselProps = {
    slaAjusteTransporte: pendente("SLA Ajuste Transporte"),
    slaTransporte: pendente("SLA Transporte"),
    slaCliente: pendente("SLA Cliente"),
    taxaInsucesso: pendente("Taxa de Insucesso"),
    taxaDevolucao: pendente("Taxa de Devolução"),
    pedidosAbertos: {
      icon: "•", label: "Pedidos em Aberto",
      value: pedidosAbertosCount.toLocaleString("pt-BR"),
      hint: `Pedidos de ${periodoLabel} sem Data Entrega Origem`,
    },
    tratativaCx: pendente("Tratativa CX"),
    riscoAtraso: {
      icon: "•", label: "Pedidos Vencidos",
      value: pedidosVencidosCount.toLocaleString("pt-BR"),
      hint: `Previsão da transportadora no período ${periodoLabel}`,
    },
    processado: pendente("Processado"),
    perdas: pendente("Perdas Extr/Sint/Avar"),
    totalPedidos: {
      icon: "•", label: "Total Expedido",
      value: totalPedidos.toLocaleString("pt-BR"),
      hint: `Pedidos criados entre ${periodoLabel}`,
    },
    abertoTotal: {
      icon: "•", label: "% Aberto/Total",
      value: `${percentualAbertoTotal}%`,
      hint: `${pedidosAbertosCount.toLocaleString("pt-BR")} em aberto de ${totalPedidos.toLocaleString("pt-BR")} expedidos`,
    },
    integridade: {
      icon: "•", label: "Integridade da devolução", value: "Aguardando",
      hint: "Envie a devolução da base", id: "iIntegrity",
    },
    status: {
      icon: "•", label: "Status", value: ultimaDevolucao ? "Recebida" : "Aguardando",
      hint: ultimaDevolucao ? formatBrazilianDate(ultimaDevolucao.createdAt) : "Nenhuma devolução recebida ainda",
      id: "mStatus",
    },
  };

  return {
    periodo,
    props,
    ultimaCargaLabel: ultimaCarga ? formatBrazilianDate(ultimaCarga.createdAt) : "Aguardando carga",
    hasBaseUpdate: Boolean(ultimaCarga),
  };
}
