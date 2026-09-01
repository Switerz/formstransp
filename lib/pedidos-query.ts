import type { Prisma } from "@prisma/client";
import { parseDateInput } from "@/lib/dates";

export interface PedidosFilters {
  pedido?: string;
  uf?: string;
  dataCriacaoDe?: string; // "YYYY-MM-DD"
  dataCriacaoAte?: string; // "YYYY-MM-DD"
  statusAtual?: string;
  transportadoraId?: string; // usado só pelo filtro opcional da Base Completa
}

const FILTER_KEYS: (keyof PedidosFilters)[] = [
  "pedido",
  "uf",
  "dataCriacaoDe",
  "dataCriacaoAte",
  "statusAtual",
  "transportadoraId",
];

/** Lê os filtros a partir de searchParams (Next.js Server Component ou Route Handler). */
export function parsePedidosFilters(raw: Record<string, string | undefined>): PedidosFilters {
  const filters: PedidosFilters = {};
  for (const key of FILTER_KEYS) {
    const value = raw[key]?.trim();
    if (value) filters[key] = key === "uf" ? value.toUpperCase() : value;
  }
  return filters;
}

/** Serializa os filtros ativos de volta para querystring (para links de paginação/download). */
export function filtersToSearchParams(filters: PedidosFilters, extra: Record<string, string> = {}): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  return params;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Monta o `where` do Prisma para Pedido a partir dos filtros da UI, combinado
 * com um `where` base fixo (regra de negócio da tela - ex.: transportadoraId
 * obrigatório e dataEntregaOrigem null na Minha Base). O `base` sempre vence:
 * os filtros da UI nunca sobrescrevem a regra fixa da tela.
 */
export function buildPedidosWhere(
  filters: PedidosFilters,
  base: Prisma.PedidoWhereInput = {},
): Prisma.PedidoWhereInput {
  const where: Prisma.PedidoWhereInput = { ...base };

  if (filters.pedido) {
    where.pedido = { contains: filters.pedido, mode: "insensitive" };
  }
  if (filters.uf) {
    where.uf = filters.uf;
  }
  if (filters.statusAtual) {
    where.statusAtual = { contains: filters.statusAtual, mode: "insensitive" };
  }
  // transportadoraId: só aplica o filtro da UI se a regra fixa da tela (base)
  // não já tiver definido um - a Minha Base sempre fixa isso, então este
  // ramo só entra em vigor na Base Completa.
  if (filters.transportadoraId && !base.transportadoraId) {
    where.transportadoraId = filters.transportadoraId;
  }
  if ((filters.dataCriacaoDe || filters.dataCriacaoAte) && !base.dataCriacaoPedido) {
    where.dataCriacaoPedido = {
      ...(filters.dataCriacaoDe ? { gte: parseDateInput(filters.dataCriacaoDe) } : {}),
      ...(filters.dataCriacaoAte ? { lt: addDays(parseDateInput(filters.dataCriacaoAte), 1) } : {}),
    };
  }

  return where;
}
