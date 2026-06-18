export type PreviousDayMetricInput = {
  totalPedidos: number;
  totalTentativaInsucesso: number;
  totalDevolucao: number;
  totalNoPrazo: number;
  totalForaDoPrazo: number;
};

export type CurrentDayPreviewInput = {
  totalPedidos: number;
  totalFinalizado: number;
  finalizadosNoPrazo: number;
};

export type UFMetricInput = {
  uf: string;
  dentroDoPrazo: number;
  foraDoPrazo: number;
  total: number;
};

export type StatusInput = {
  status: string;
  quantidade: number;
};

export function safeRate(numerator: number, denominator: number) {
  if (!denominator || denominator <= 0) return 0;
  return numerator / denominator;
}

export function asPercent(value: number, digits = 2) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function calculateMonthlySLA(metrics: PreviousDayMetricInput[]) {
  const totalNoPrazo = metrics.reduce((sum, metric) => sum + metric.totalNoPrazo, 0);
  const totalPedidos = metrics.reduce((sum, metric) => sum + metric.totalPedidos, 0);
  return safeRate(totalNoPrazo, totalPedidos);
}

export function calculateFailureRate(metrics: PreviousDayMetricInput[]) {
  const totalInsucesso = metrics.reduce((sum, metric) => sum + metric.totalTentativaInsucesso, 0);
  const totalPedidos = metrics.reduce((sum, metric) => sum + metric.totalPedidos, 0);
  return safeRate(totalInsucesso, totalPedidos);
}

export function calculateReturnRate(metrics: PreviousDayMetricInput[]) {
  const totalDevolucao = metrics.reduce((sum, metric) => sum + metric.totalDevolucao, 0);
  const totalPedidos = metrics.reduce((sum, metric) => sum + metric.totalPedidos, 0);
  return safeRate(totalDevolucao, totalPedidos);
}

export function calculateDailySLA(metric: PreviousDayMetricInput) {
  return safeRate(metric.totalNoPrazo, metric.totalPedidos);
}

export function calculateUFSLA(metric: UFMetricInput) {
  return safeRate(metric.dentroDoPrazo, metric.total);
}

export function calculateStatusParticipation(status: StatusInput[], totalPedidos: number) {
  return status.map((item) => ({
    ...item,
    participacao: safeRate(item.quantidade, totalPedidos),
  }));
}

export function calculatePartialDaySLA(metric: CurrentDayPreviewInput) {
  return safeRate(metric.finalizadosNoPrazo, metric.totalFinalizado);
}

export function calculateWeeklySLA(
  metrics: Array<PreviousDayMetricInput & { dataReport: Date }>,
) {
  const grouped = new Map<string, { totalPedidos: number; totalNoPrazo: number; dates: Date[] }>();

  for (const metric of metrics) {
    const day = metric.dataReport.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(metric.dataReport);
    monday.setDate(metric.dataReport.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    const key = monday.toISOString().slice(0, 10);
    const current = grouped.get(key) ?? { totalPedidos: 0, totalNoPrazo: 0, dates: [] };
    current.totalPedidos += metric.totalPedidos;
    current.totalNoPrazo += metric.totalNoPrazo;
    current.dates.push(metric.dataReport);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value], index) => ({
      semana: `Semana ${index + 1}`,
      inicio: key,
      fim: value.dates
        .reduce((latest, date) => (date > latest ? date : latest), value.dates[0])
        .toISOString()
        .slice(0, 10),
      sla: safeRate(value.totalNoPrazo, value.totalPedidos),
    }));
}
