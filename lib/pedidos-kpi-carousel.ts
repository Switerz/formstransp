import { prisma } from "@/lib/prisma";
import { formatBrazilianDate } from "@/lib/dates";
import type { KpiCard, KpiCarouselProps } from "@/components/pedidos/KpiCarousel";
import { calcularPercentualAbertoTotal } from "@/lib/pedidos-kpis";
import { parsePeriodoFilters, periodoParaIntervaloDatas, type Periodo } from "@/lib/pedidos-periodo";

const SEM_REGRA: Omit<KpiCard, "icon" | "label"> = { value: "—", hint: "Aguardando dados" };

export interface DadosKpiCarousel {
  periodo: Periodo;
  props: KpiCarouselProps;
  ultimaCargaLabel: string;
  hasBaseUpdate: boolean;
}

/**
 * Monta TODOS os dados do carrossel "Números" (mesmas 14 cards, mesmas
 * regras) para uma transportadora e período. Única fonte de verdade,
 * chamada tanto por /portal/minha-base quanto por /portal (Início) - os
 * dois exibem exatamente os mesmos números para a mesma transportadora/
 * período, porque usam a mesma função, não duas implementações.
 *
 * A transportadora é sempre recebida como parâmetro já resolvido pelo
 * chamador via sessão (user.transportadoraId) - esta função não decide
 * isolamento, só consulta o que já foi determinado.
 */
export async function montarDadosKpiCarousel(
  transportadoraId: string,
  rawSearchParams: Record<string, string | undefined>,
): Promise<DadosKpiCarousel> {
  const periodo = parsePeriodoFilters(rawSearchParams);
  const intervaloPeriodo = periodoParaIntervaloDatas(periodo);

  const [totalPedidos, pedidosAbertosCount, pedidosVencidosCount, ultimaCarga, ultimaDevolucao] = await Promise.all([
    prisma.pedido.count({ where: { transportadoraId } }),
    prisma.pedido.count({ where: { transportadoraId, dataEntregaOrigem: null } }),
    prisma.pedido.count({
      where: { transportadoraId, dataEntregaOrigem: null, dataPrevisao: intervaloPeriodo },
    }),
    prisma.automationLog.findFirst({
      where: { tipo: "pedidos_import" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.automationLog.findFirst({
      where: { tipo: "pedidos_devolucao", transportadoraId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const percentualAbertoTotal = calcularPercentualAbertoTotal(totalPedidos, pedidosAbertosCount);

  const totalPedidosCard: KpiCard = {
    icon: "▥",
    label: "Total de Pedidos",
    value: totalPedidos.toLocaleString("pt-BR"),
    hint: "Todos os pedidos da transportadora",
  };
  const pedidosAbertosCard: KpiCard = {
    icon: "□",
    label: "Pedidos em Aberto",
    value: pedidosAbertosCount.toLocaleString("pt-BR"),
    hint: "dataEntregaOrigem em aberto",
  };
  const abertoTotalCard: KpiCard = {
    icon: "□",
    label: "% Aberto/Total",
    value: `${percentualAbertoTotal}%`,
    hint: "Sobre o total da transportadora",
  };
  const pedidosVencidosCard: KpiCard = {
    icon: "◷",
    label: "Pedidos Vencidos",
    value: pedidosVencidosCount.toLocaleString("pt-BR"),
    hint: `Promessa Transporte entre ${formatBrazilianDate(intervaloPeriodo.gte)} e ${periodo.ate.split("-").reverse().join("/")}`,
  };

  const props: KpiCarouselProps = {
    slaAjusteTransporte: { ...SEM_REGRA, icon: "◎", label: "SLA Ajuste Transporte" },
    slaTransporte: { ...SEM_REGRA, icon: "▣", label: "SLA Transporte" },
    slaCliente: { ...SEM_REGRA, icon: "●", label: "SLA Cliente" },
    taxaInsucesso: { ...SEM_REGRA, icon: "!", label: "Taxa de Insucesso" },
    taxaDevolucao: { ...SEM_REGRA, icon: "↺", label: "Taxa de Devolução" },
    pedidosAbertos: pedidosAbertosCard,
    tratativaCx: { ...SEM_REGRA, icon: "×", label: "Tratativa CX" },
    riscoAtraso: pedidosVencidosCard,
    processado: { ...SEM_REGRA, icon: "↗", label: "Processado" },
    perdas: { ...SEM_REGRA, icon: "◇", label: "Perdas Extr/Sint/Avar" },
    totalPedidos: totalPedidosCard,
    abertoTotal: abertoTotalCard,
    integridade: { icon: "✓", label: "Integridade da devolução", value: "Aguardando", hint: "Envie a devolução da base", id: "iIntegrity" },
    status: {
      icon: "•",
      label: "Status",
      value: ultimaDevolucao ? "Recebida" : "Aguardando",
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
