import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatBrazilianDate } from "@/lib/dates";
import type { KpiCard, KpiCarouselProps } from "@/components/pedidos/KpiCarousel";
import { calcularPercentualAbertoTotal } from "@/lib/pedidos-kpis";
import { parsePeriodoFilters, periodoParaIntervaloDatas, type Periodo } from "@/lib/pedidos-periodo";
import { obterKpiSnapshot, resumirKpiSnapshot } from "@/lib/pedidos-kpi-snapshot";

const ATUALIZANDO: Omit<KpiCard, "icon" | "label"> = {
  value: "Em consolidação",
  hint: "Indicador temporariamente indisponível durante a otimização",
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

  if (transportadoraId) {
    const [snapshot, ultimaCarga, ultimaDevolucao] = await Promise.all([
      obterKpiSnapshot(transportadoraId),
      prisma.automationLog.findFirst({
        where: { tipo: "pedidos_import" }, orderBy: { createdAt: "desc" }, select: { createdAt: true },
      }),
      prisma.automationLog.findFirst({
        where: { tipo: "pedidos_devolucao", transportadoraId },
        orderBy: { createdAt: "desc" }, select: { createdAt: true },
      }),
    ]);
    if (snapshot) {
      const r = resumirKpiSnapshot(snapshot.payload, periodo.de, periodo.ate);
      const percentual = (ok: number, total: number) => total ? Math.round((ok / total) * 1000) / 10 : 0;
      const cardPercentual = (label: string, ok: number, total: number, descricao: string): KpiCard => ({
        icon: "•", label, value: total ? `${percentual(ok, total)}%` : "0%",
        hint: `${ok.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} ${descricao}`,
      });
      const props: KpiCarouselProps = {
        slaAjusteTransporte: cardPercentual("SLA Ajuste Transporte", r.slaAjusteOk, r.slaAjusteTotal, "no prazo ajustado"),
        slaTransporte: cardPercentual("SLA Transporte", r.slaTransOk, r.slaTransTotal, "entregues no prazo"),
        slaCliente: cardPercentual("SLA Cliente", r.slaClienteOk, r.slaClienteTotal, "entregues no prazo"),
        taxaInsucesso: cardPercentual("Taxa de Insucesso", r.insucesso, r.prometidos, "prometidos com insucesso"),
        taxaDevolucao: cardPercentual("Taxa de Devolução", r.devolucao, r.prometidos, "prometidos em devolução/devolvidos"),
        pedidosAbertos: { icon: "•", label: "Pedidos em Aberto", value: r.abertos.toLocaleString("pt-BR"), hint: "Pedidos do período sem Data Entrega Origem" },
        tratativaCx: cardPercentual("Tratativa CX", r.tratativa, r.prometidos, "prometidos em tratativa"),
        riscoAtraso: { icon: "•", label: "Pedidos Vencidos", value: r.vencidos.toLocaleString("pt-BR"), hint: "Pedidos abertos com previsão no período" },
        processado: cardPercentual("Processado", r.processado, r.total, "pedidos processados"),
        perdas: cardPercentual("Perdas Extr/Sint/Avar", r.perdas, r.prometidos, "prometidos com perda"),
        totalPedidos: { icon: "•", label: "Total Expedido", value: r.total.toLocaleString("pt-BR"), hint: "Pedidos criados no período selecionado" },
        abertoTotal: cardPercentual("% Aberto/Total", r.abertos, r.total, "pedidos em aberto"),
        integridade: { icon: "•", label: "Integridade da devolução", value: "Aguardando", hint: "Envie a devolução da base", id: "iIntegrity" },
        status: { icon: "•", label: "Status", value: ultimaDevolucao ? "Recebida" : "Aguardando", hint: ultimaDevolucao ? formatBrazilianDate(ultimaDevolucao.createdAt) : "Nenhuma devolução recebida ainda", id: "mStatus" },
      };
      return {
        periodo, props,
        ultimaCargaLabel: ultimaCarga ? formatBrazilianDate(ultimaCarga.createdAt) : "Aguardando carga",
        hasBaseUpdate: Boolean(ultimaCarga),
      };
    }
  }

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
