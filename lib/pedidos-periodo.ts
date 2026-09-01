import { formatDateInput, parseDateInput, startOfLocalDay } from "@/lib/dates";

export interface Periodo {
  de: string; // "YYYY-MM-DD"
  ate: string; // "YYYY-MM-DD"
}

/**
 * Período padrão ao abrir a página: D-1 (ontem), usando a Previsão Entrega
 * Transportadora de origem como referência. "Ontem" só é usado aqui, na
 * seleção inicial - o cálculo em si sempre usa o DE/ATÉ efetivo (ver
 * parsePeriodoFilters), nunca "ontem" hardcoded.
 */
export function getDefaultPeriodoD1(hoje: Date = new Date()): Periodo {
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const ontemFormatado = formatDateInput(startOfLocalDay(ontem));
  return { de: ontemFormatado, ate: ontemFormatado };
}

/**
 * Lê o período efetivo a partir de searchParams (raw), com fallback para
 * D-1 quando ausente ou inválido. Nunca lança - sempre devolve um período
 * válido utilizável em query.
 */
export function parsePeriodoFilters(
  raw: { de?: string; ate?: string },
  hoje: Date = new Date(),
): Periodo {
  const defaultPeriodo = getDefaultPeriodoD1(hoje);
  const de = isDataValida(raw.de) ? raw.de! : defaultPeriodo.de;
  const ate = isDataValida(raw.ate) ? raw.ate! : defaultPeriodo.ate;
  return { de, ate };
}

function isDataValida(value: string | undefined): boolean {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDateInput(value).getTime());
}

/** Converte o período (strings "YYYY-MM-DD") em limites de Date para uso em where do Prisma (ate é exclusivo, dia seguinte). */
export function periodoParaIntervaloDatas(periodo: Periodo): { gte: Date; lt: Date } {
  const gte = parseDateInput(periodo.de);
  const ateDate = parseDateInput(periodo.ate);
  const lt = new Date(ateDate);
  lt.setDate(lt.getDate() + 1);
  return { gte, lt };
}
