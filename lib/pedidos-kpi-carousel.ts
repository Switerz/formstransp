import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatBrazilianDate } from "@/lib/dates";
import type { KpiCard, KpiCarouselProps } from "@/components/pedidos/KpiCarousel";
import { calcularPercentualAbertoTotal } from "@/lib/pedidos-kpis";
import { parsePeriodoFilters, periodoParaIntervaloDatas, type Periodo } from "@/lib/pedidos-periodo";

const SEM_REGRA: Omit<KpiCard, "icon" | "label"> = { value: "â€”", hint: "Aguardando dados" };

export interface DadosKpiCarousel {
  periodo: Periodo;
  props: KpiCarouselProps;
  ultimaCargaLabel: string;
  hasBaseUpdate: boolean;
}

/**
 * Monta TODOS os dados do carrossel "NÃºmeros" (mesmas 14 cards, mesmas
 * regras) para uma transportadora (ou todas, se null) e perÃ­odo. Ãšnica
 * fonte de verdade, chamada por /portal/minha-base, /portal (InÃ­cio) e
 * /base-completa - todos exibem exatamente os mesmos nÃºmeros para o
 * mesmo escopo/perÃ­odo, porque usam a mesma funÃ§Ã£o, nÃ£o implementaÃ§Ãµes
 * separadas.
 *
 * A transportadora Ã© sempre recebida como parÃ¢metro jÃ¡ resolvido pelo
 * chamador (via sessÃ£o em Minha Base/InÃ­cio, ou via filtro opcional de
 * UI + requireInternalUser em Base Completa) - esta funÃ§Ã£o nÃ£o decide
 * isolamento, sÃ³ consulta o escopo que jÃ¡ foi determinado.
 * transportadoraId === null significa "todas as transportadoras" (usado
 * exclusivamente pela Base Completa).
 */
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

  const [totalPedidos, pedidosAbertosCount, pedidosVencidosCount, ultimaCarga, ultimaDevolucao] = await Promise.all([
    prisma.pedido.count({ where: escopoTransportadora }),
    prisma.pedido.count({ where: { ...escopoTransportadora, dataEntregaOrigem: null } }),
    prisma.pedido.count({
      where: {
        ...escopoTransportadora,
        dataEntregaOrigem: null,
        previsaoEntregaTransportadoraOrigem: intervaloPeriodo,
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

  const totalPedidosCard: KpiCard = {
    icon: "â–¥",
    label: "Total de Pedidos",
    value: totalPedidos.toLocaleString("pt-BR"),
    hint: transportadoraId ? "Todos os pedidos da transportadora" : "Consolidado de todas as transportadoras",
  };
  const pedidosAbertosCard: KpiCard = {
    icon: "â–¡",
    label: "Pedidos em Aberto",
    value: pedidosAbertosCount.toLocaleString("pt-BR"),
    hint: "dataEntregaOrigem em aberto",
  };
  const abertoTotalCard: KpiCard = {
    icon: "â–¡",
    label: "% Aberto/Total",
    value: `${percentualAbertoTotal}%`,
    hint: transportadoraId ? "Sobre o total da transportadora" : "Sobre o total consolidado",
  };
  const pedidosVencidosCard: KpiCard = {
    icon: "â—·",
    label: "Pedidos Vencidos",
    value: pedidosVencidosCount.toLocaleString("pt-BR"),
    hint: `PrevisÃ£o Entrega Transportadora entre ${formatBrazilianDate(intervaloPeriodo.gte)} e ${periodo.ate.split("-").reverse().join("/")}`,
  };

  const props: KpiCarouselProps = {
    slaAjusteTransporte: { ...SEM_REGRA, icon: "â—Ž", label: "SLA Ajuste Transporte" },
    slaTransporte: { ...SEM_REGRA, icon: "â–£", label: "SLA Transporte" },
    slaCliente: { ...SEM_REGRA, icon: "â—", label: "SLA Cliente" },
    taxaInsucesso: { ...SEM_REGRA, icon: "!", label: "Taxa de Insucesso" },
    taxaDevolucao: { ...SEM_REGRA, icon: "â†º", label: "Taxa de DevoluÃ§Ã£o" },
    pedidosAbertos: pedidosAbertosCard,
    tratativaCx: { ...SEM_REGRA, icon: "Ã—", label: "Tratativa CX" },
    riscoAtraso: pedidosVencidosCard,
    processado: { ...SEM_REGRA, icon: "â†—", label: "Processado" },
    perdas: { ...SEM_REGRA, icon: "â—‡", label: "Perdas Extr/Sint/Avar" },
    totalPedidos: totalPedidosCard,
    abertoTotal: abertoTotalCard,
    integridade: { icon: "âœ“", label: "Integridade da devoluÃ§Ã£o", value: "Aguardando", hint: "Envie a devoluÃ§Ã£o da base", id: "iIntegrity" },
    status: {
      icon: "â€¢",
      label: "Status",
      value: ultimaDevolucao ? "Recebida" : "Aguardando",
      hint: ultimaDevolucao ? formatBrazilianDate(ultimaDevolucao.createdAt) : "Nenhuma devoluÃ§Ã£o recebida ainda",
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
