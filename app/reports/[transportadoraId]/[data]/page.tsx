import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, History } from "lucide-react";
import { DailySlaChart, WeeklySlaChart } from "@/components/SlaCharts";
import {
  asPercent,
  calculateDailySLA,
  calculateFailureRate,
  calculateMonthlySLA,
  calculatePartialDaySLA,
  calculateReturnRate,
  calculateStatusParticipation,
  calculateUFSLA,
  calculateWeeklySLA,
  safeRate,
} from "@/lib/calculations";
import { requireTransportadoraAccess } from "@/lib/auth";
import { formatBrazilianDate, monthBounds, parseDateInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ transportadoraId: string; data: string }>;
  searchParams: Promise<{ exportToken?: string }>;
}) {
  const { transportadoraId, data } = await params;
  const query = await searchParams;
  const validExportToken = Boolean(process.env.REPORT_JOB_SECRET && query.exportToken === process.env.REPORT_JOB_SECRET);
  if (!validExportToken) {
    await requireTransportadoraAccess(transportadoraId, `/reports/${transportadoraId}/${data}`);
  }

  const dataReport = parseDateInput(data);
  const { start, end } = monthBounds(dataReport);

  const submission = await prisma.dailyReportSubmission.findUnique({
    where: { transportadoraId_dataReport: { transportadoraId, dataReport } },
    include: {
      transportadora: true,
      previousDayMetrics: true,
      currentDayPreviewMetrics: true,
      ufMetrics: { orderBy: { uf: "asc" } },
    },
  });
  if (!submission?.previousDayMetrics || !submission.currentDayPreviewMetrics) notFound();

  const monthSubmissions = await prisma.dailyReportSubmission.findMany({
    where: { transportadoraId, dataReport: { gte: start, lt: end } },
    include: { previousDayMetrics: true },
    orderBy: { dataReport: "asc" },
  });
  const monthMetrics = monthSubmissions
    .filter((item) => item.previousDayMetrics)
    .map((item) => ({ ...item.previousDayMetrics!, dataReport: item.dataReport }));
  const [previousReport, nextReport] = await Promise.all([
    prisma.dailyReportSubmission.findFirst({
      where: { transportadoraId, dataReport: { lt: dataReport } },
      orderBy: { dataReport: "desc" },
      select: { dataReport: true },
    }),
    prisma.dailyReportSubmission.findFirst({
      where: { transportadoraId, dataReport: { gt: dataReport } },
      orderBy: { dataReport: "asc" },
      select: { dataReport: true },
    }),
  ]);

  const prev = submission.previousDayMetrics;
  const cur = submission.currentDayPreviewMetrics;
  const totals = {
    totalPedidosMes: monthMetrics.reduce((sum, item) => sum + item.totalPedidos, 0),
    totalNoPrazoMes: monthMetrics.reduce((sum, item) => sum + item.totalNoPrazo, 0),
    totalForaPrazoMes: monthMetrics.reduce((sum, item) => sum + item.totalForaDoPrazo, 0),
    totalInsucessoMes: monthMetrics.reduce((sum, item) => sum + item.totalTentativaInsucesso, 0),
    totalDevolucaoMes: monthMetrics.reduce((sum, item) => sum + item.totalDevolucao, 0),
  };

  const previousStatus = calculateStatusParticipation(
    [
      { status: "Entregue", quantidade: prev.totalEntregue },
      { status: "Em aberto", quantidade: prev.totalEmAberto },
      { status: "Tentativa sem sucesso", quantidade: prev.totalTentativaInsucesso },
      { status: "Devolução", quantidade: prev.totalDevolucao },
      { status: "Cancelado", quantidade: prev.totalCancelado },
    ],
    prev.totalPedidos,
  );
  const currentStatus = calculateStatusParticipation(
    [
      { status: "Entregue", quantidade: cur.totalEntregue },
      { status: "Em aberto", quantidade: cur.totalEmAberto },
      { status: "Tentativa sem sucesso", quantidade: cur.totalTentativaInsucesso },
      { status: "Devolução", quantidade: cur.totalDevolucao },
      { status: "Cancelado", quantidade: cur.totalCancelado },
    ],
    cur.totalPedidos,
  );

  const weekly = calculateWeeklySLA(monthMetrics).map((item) => ({ ...item, sla: item.sla * 100 }));
  const currentWeek = monthMetrics.slice(-7).map((item) => ({
    dia: new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(item.dataReport),
    sla: calculateDailySLA(item) * 100,
  }));
  const monthlySla = calculateMonthlySLA(monthMetrics);
  const failureRate = calculateFailureRate(monthMetrics);
  const returnRate = calculateReturnRate(monthMetrics);
  const partialDaySla = calculatePartialDaySLA(cur);
  const weekAverage = safeRate(
    currentWeek.reduce((sum, item) => sum + item.sla, 0),
    currentWeek.length * 100,
  );
  const weeklyBest = weekly.reduce((best, item) => (item.sla > best.sla ? item : best), weekly[0]);

  const slaHealth = getHealth(monthlySla, { good: 0.93, warning: 0.9 }, "higher");
  const failureHealth = getHealth(failureRate, { good: 0.03, warning: 0.05 }, "lower");
  const returnHealth = getHealth(returnRate, { good: 0.015, warning: 0.025 }, "lower");
  const partialHealth = getHealth(partialDaySla, { good: 0.93, warning: 0.9 }, "higher");
  const deliveryRate = safeRate(prev.totalEntregue, prev.totalPedidos);
  const currentOpenRate = safeRate(cur.totalEmAberto, cur.totalPedidos);

  return (
    <main className="shell">
      <div className="report-toolbar no-print">
        <Link className="btn secondary" href="/">
          Voltar ao admin
        </Link>
        <div className="actions">
          {previousReport ? (
            <Link className="btn secondary" href={`/reports/${transportadoraId}/${previousReport.dataReport.toISOString().slice(0, 10)}`}>
              <ChevronLeft size={16} /> Relatório anterior
            </Link>
          ) : (
            <span className="btn secondary disabled" aria-disabled="true">
              <ChevronLeft size={16} /> Relatório anterior
            </span>
          )}
          {nextReport ? (
            <Link className="btn secondary" href={`/reports/${transportadoraId}/${nextReport.dataReport.toISOString().slice(0, 10)}`}>
              Próximo relatório <ChevronRight size={16} />
            </Link>
          ) : (
            <span className="btn secondary disabled" aria-disabled="true">
              Próximo relatório <ChevronRight size={16} />
            </span>
          )}
          <Link className="btn secondary" href={`/historico/${transportadoraId}`}>
            <History size={16} /> Histórico
          </Link>
          <Link className="btn secondary" href={`/reports/${transportadoraId}/${data}/export/pdf`}>
            <Download size={16} /> Exportar PDF
          </Link>
        </div>
      </div>
      <section className="report-header">
        <div>
          <div className="report-kicker">DIÁRIO DE BORDO DO TRANSPORTADOR</div>
          <h1>RELATÓRIO DIÁRIO</h1>
        </div>
        <div>
          <strong>{submission.transportadora.nome}</strong>
          <div>{formatBrazilianDate(submission.dataReport)}</div>
        </div>
      </section>

      <section className="grid">
        <div className="grid grid-3">
          <div className="card metric-card">
            <div className="metric-head">
              <div className="metric-label">% SLA acumulado no mês</div>
              <HealthPill health={slaHealth} />
            </div>
            <div className="metric-value">{asPercent(monthlySla)}</div>
            <div className="metric-note">{slaHealth.copy} Meta mínima: 93%.</div>
            <div className="muted">Pedidos {totals.totalPedidosMes} | No prazo {totals.totalNoPrazoMes} | Fora do prazo {totals.totalForaPrazoMes}</div>
          </div>
          <div className="card metric-card orange">
            <div className="metric-head">
              <div className="metric-label">% Tentativas sem sucesso</div>
              <HealthPill health={failureHealth} />
            </div>
            <div className="metric-value">{asPercent(failureRate)}</div>
            <div className="metric-note">{failureHealth.copy} Alerta acima de 5%.</div>
            <div className="muted">Total de tentativas sem sucesso {totals.totalInsucessoMes}</div>
          </div>
          <div className="card metric-card red">
            <div className="metric-head">
              <div className="metric-label">% Devoluções</div>
              <HealthPill health={returnHealth} />
            </div>
            <div className="metric-value">{asPercent(returnRate)}</div>
            <div className="metric-note">{returnHealth.copy} Alerta acima de 2.5%.</div>
            <div className="muted">Total de devoluções {totals.totalDevolucaoMes}</div>
          </div>
        </div>

        <div className="grid grid-2">
          <div className="card chart-card">
            <div className="chart-title-row">
              <h2 className="section-title">SLA semanal</h2>
              <span className="chart-summary">Melhor: {weeklyBest ? `${weeklyBest.semana} (${weeklyBest.sla.toFixed(2)}%)` : "-"}</span>
            </div>
            <p className="chart-caption">Escala focada em 80-100%. Use a evolução semanal para identificar queda de tendência antes do fechamento do mês.</p>
            <WeeklySlaChart data={weekly} />
          </div>
          <div className="card chart-card">
            <div className="chart-title-row">
              <h2 className="section-title">SLA diário da semana atual</h2>
              <span className="chart-summary">Média: {asPercent(weekAverage)}</span>
            </div>
            <p className="chart-caption">Escala focada em 80-100%. Acompanhe se a semana está sustentando a meta antes do consolidado mensal.</p>
            <DailySlaChart data={currentWeek} />
          </div>
        </div>

        <div className="report-section-heading">
          <div>
            <h2>Desempenho do dia anterior</h2>
            <p>Ontem finalizou {asPercent(deliveryRate)} dos pedidos e manteve {prev.totalEmAberto} em aberto.</p>
          </div>
          <span className="section-tag">Resultado fechado</span>
        </div>
        <div className="grid grid-3">
          <div className="card metric-card"><div className="metric-label">Total de pedidos</div><div className="metric-value">{prev.totalPedidos}</div></div>
          <div className="card metric-card green"><div className="metric-label">Total entregue</div><div className="metric-value">{prev.totalEntregue}</div></div>
          <div className="card metric-card orange"><div className="metric-label">Total em aberto</div><div className="metric-value">{prev.totalEmAberto}</div></div>
        </div>
        <div className="grid grid-2">
          <TableCard title="Pedidos por UF" headers={["UF", "Dentro", "Fora", "Total", "% SLA"]} rows={submission.ufMetrics.map((row) => [row.uf, row.dentroDoPrazo, row.foraDoPrazo, row.total, asPercent(calculateUFSLA(row))])} />
          <TableCard title="Pedidos por status" headers={["Status", "Quantidade", "% Participação"]} rows={previousStatus.map((row) => [row.status, row.quantidade, asPercent(row.participacao)])} />
        </div>

        <div className="report-section-heading">
          <div>
            <h2>Prévia do SLA do dia atual</h2>
            <p>Parcial atual em {asPercent(partialDaySla)}, com {asPercent(currentOpenRate)} dos pedidos ainda em aberto.</p>
          </div>
          <span className="section-tag">Acompanhamento em curso</span>
        </div>
        <div className="grid grid-4">
          <div className="card metric-card">
            <div className="metric-head">
              <div className="metric-label">% SLA parcial</div>
              <HealthPill health={partialHealth} />
            </div>
            <div className="metric-value">{asPercent(partialDaySla)}</div>
            <div className="metric-note">{partialHealth.copy} Meta mínima: 93%.</div>
          </div>
          <div className="card metric-card green"><div className="metric-label">Total finalizado</div><div className="metric-value">{cur.totalFinalizado}</div></div>
          <div className="card metric-card orange"><div className="metric-label">Total em aberto</div><div className="metric-value">{cur.totalEmAberto}</div></div>
          <div className="card metric-card"><div className="metric-label">Total de pedidos</div><div className="metric-value">{cur.totalPedidos}</div></div>
        </div>
        <div className="grid grid-2">
          <TableCard title="Status atual do dia" headers={["Status", "Quantidade", "% Participação"]} rows={currentStatus.map((row) => [row.status, row.quantidade, asPercent(row.participacao)])} />
          <div className="card">
            <h2 className="section-title">Observações</h2>
            <p>{submission.observacoes || "Sem observações registradas."}</p>
          </div>
        </div>
      </section>
    </main>
  );
}

type Health = {
  level: "ok" | "warning" | "critical";
  label: string;
  copy: string;
};

function getHealth(
  value: number,
  thresholds: { good: number; warning: number },
  direction: "higher" | "lower",
): Health {
  const ok =
    direction === "higher" ? value >= thresholds.good : value <= thresholds.good;
  const warning =
    direction === "higher" ? value >= thresholds.warning : value <= thresholds.warning;

  if (ok) return { level: "ok", label: "Dentro da meta", copy: "Resultado dentro do esperado." };
  if (warning) return { level: "warning", label: "Atenção", copy: "Acompanhar no próximo envio." };
  return { level: "critical", label: "Crítico", copy: "Priorizar plano de ação." };
}

function HealthPill({ health }: { health: Health }) {
  return <span className={`health-pill ${health.level}`}>{health.label}</span>;
}

function TableCard({ title, headers, rows }: { title: string; headers: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div className="card">
      <h2 className="section-title">{title}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
