/**
 * KPIs deriváveis SEM AMBIGUIDADE a partir do Pedido real. Os demais cards
 * do carrossel do HTML oficial (SLA Ajuste Transporte, SLA Transporte, SLA
 * Cliente, Taxa de Insucesso, Taxa de Devolução, Tratativa CX, Risco de
 * Atraso, Processado, Perdas Extr/Sint/Avar) NÃO têm fórmula definida no
 * HTML nem regra de negócio confirmada - propositalmente NÃO calculados
 * aqui. Ver components/pedidos/KpiCarousel.tsx para os cards "Aguardando
 * regra".
 */

export interface PedidoVencidoCheck {
  dataPrevisao: Date | null;
  dataEntregaOrigem: Date | null;
}

/**
 * "Pedido vencido": a Promessa Transporte (dataPrevisao) cai dentro do
 * período selecionado E o pedido ainda não foi finalizado (dataEntregaOrigem
 * IS NULL - mesma referência de finalização já usada em toda a Minha Base/
 * Base Completa, nunca dataEntrega). Espelha exatamente o WHERE usado nas
 * consultas reais (Prisma), servindo também de especificação testável.
 */
export function isPedidoVencidoNoPeriodo(pedido: PedidoVencidoCheck, gte: Date, lt: Date): boolean {
  if (pedido.dataEntregaOrigem !== null) return false;
  if (!pedido.dataPrevisao) return false;
  return pedido.dataPrevisao.getTime() >= gte.getTime() && pedido.dataPrevisao.getTime() < lt.getTime();
}

export interface PedidoOperacional {
  dataColetaProcessamento: Date | null;
  dataPrevisao: Date | null;
  prazoEntregaDiasUteis: number | null;
  dataEntrega: Date | null;
  statusAtual: string | null;
  ocorrencia: string | null;
  motivoDevolucao: string | null;
  slaStatus: string | null;
  justificativaAtraso: string | null;
  novaDataPrevisao: Date | null;
  dataResolucaoDevolucao: Date | null;
}

export type FillStatus = "pending" | "partial" | "done";

/**
 * Classifica um pedido conforme quantos dos 11 campos operacionais estão
 * preenchidos - mesma lógica de rowFillStatus() do HTML oficial, adaptada
 * para os 11 campos do layout oficial (o HTML tinha só 10; aqui os 11
 * contam, decisão explícita).
 */
export function rowFillStatus(pedido: PedidoOperacional): FillStatus {
  const campos: unknown[] = [
    pedido.dataColetaProcessamento,
    pedido.dataPrevisao,
    pedido.prazoEntregaDiasUteis,
    pedido.dataEntrega,
    pedido.statusAtual,
    pedido.ocorrencia,
    pedido.motivoDevolucao,
    pedido.slaStatus,
    pedido.justificativaAtraso,
    pedido.novaDataPrevisao,
    pedido.dataResolucaoDevolucao,
  ];

  const preenchidos = campos.filter((v) => v !== null && v !== undefined && String(v).trim() !== "").length;

  if (preenchidos === 0) return "pending";
  if (preenchidos === campos.length) return "done";
  return "partial";
}

export interface FillStatusSummary {
  pending: number;
  partial: number;
  done: number;
}

export function summarizeFillStatus(pedidos: PedidoOperacional[]): FillStatusSummary {
  const summary: FillStatusSummary = { pending: 0, partial: 0, done: 0 };
  for (const pedido of pedidos) {
    summary[rowFillStatus(pedido)] += 1;
  }
  return summary;
}

export interface KpisDerivaveis {
  totalPedidos: number;
  pedidosAbertos: number;
  percentualAbertoTotal: number; // 0-100
  preenchimento: FillStatusSummary;
}

/**
 * `pedidosAbertos` deve vir de uma contagem já filtrada por
 * dataEntregaOrigem IS NULL (mesma regra de negócio de Minha Base) -
 * calculada fora daqui, no chamador, para não duplicar a regra de acesso.
 */
export function calcularPercentualAbertoTotal(totalPedidos: number, pedidosAbertos: number): number {
  return totalPedidos > 0 ? Math.round((pedidosAbertos / totalPedidos) * 1000) / 10 : 0;
}

export function calcularKpisDerivaveis(totalPedidos: number, pedidosAbertos: number, abertos: PedidoOperacional[]): KpisDerivaveis {
  return {
    totalPedidos,
    pedidosAbertos,
    percentualAbertoTotal: calcularPercentualAbertoTotal(totalPedidos, pedidosAbertos),
    preenchimento: summarizeFillStatus(abertos),
  };
}
