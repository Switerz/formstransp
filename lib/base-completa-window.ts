import type { Prisma } from "@prisma/client";
import { startOfLocalDay } from "@/lib/dates";

export const BASE_COMPLETA_DIAS = 45;

/**
 * Janela fixa da Base Completa: hoje + 44 dias anteriores (45 dias corridos),
 * sempre pela Data Criação original da Intelipost.
 */
export function getBaseCompletaWindowStart(reference = new Date()) {
  const start = startOfLocalDay(reference);
  start.setDate(start.getDate() - (BASE_COMPLETA_DIAS - 1));
  return start;
}

export function getBaseCompletaWindowWhere(reference = new Date()): Prisma.PedidoWhereInput {
  return {
    dataCriacaoPedido: { gte: getBaseCompletaWindowStart(reference) },
  };
}
