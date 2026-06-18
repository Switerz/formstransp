import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Edit,
  FileBarChart,
  History,
  Layers3,
  Plus,
  XCircle,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { isInternalAdmin, requireInternalUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBrazilianDate, startOfLocalDay } from "@/lib/dates";
import { BRAZILIAN_UFS } from "@/lib/ufs";

const HISTORY_DAYS = 14;
const GOOD_SLA_THRESHOLD = 93;
const WARNING_SLA_THRESHOLD = 90;

export const dynamic = "force-dynamic";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortBrazilianDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

function weekdayLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" })
    .format(date)
    .replace(".", "");
}

function slaPercent(totalNoPrazo: number, totalForaDoPrazo: number) {
  const total = totalNoPrazo + totalForaDoPrazo;
  return total > 0 ? (totalNoPrazo / total) * 100 : null;
}

function slaClass(value: number | null) {
  if (value === null) return "pending";
  if (value >= GOOD_SLA_THRESHOLD) return "ok";
  if (value >= WARNING_SLA_THRESHOLD) return "warning";
  return "critical";
}

function weightedSla(
  metrics: Array<{ totalNoPrazo: number; totalForaDoPrazo: number }>,
) {
  const totalNoPrazo = metrics.reduce((sum, item) => sum + item.totalNoPrazo, 0);
  const totalForaDoPrazo = metrics.reduce((sum, item) => sum + item.totalForaDoPrazo, 0);
  return slaPercent(totalNoPrazo, totalForaDoPrazo);
}

function issueRate(
  metrics: Array<{ totalPedidos: number; totalTentativaInsucesso: number; totalDevolucao: number }>,
) {
  const totalPedidos = metrics.reduce((sum, item) => sum + item.totalPedidos, 0);
  const totalIssues = metrics.reduce((sum, item) => sum + item.totalTentativaInsucesso + item.totalDevolucao, 0);
  return totalPedidos > 0 ? (totalIssues / totalPedidos) * 100 : null;
}

function riskClass(score: number) {
  if (score >= 60) return "critical";
  if (score >= 30) return "warning";
  return "ok";
}

function riskLabel(score: number) {
  if (score >= 60) return "Crítico";
  if (score >= 30) return "Atenção";
  return "Saudável";
}

function localHour(date: Date) {
  const hour = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).formatToParts(date).find((part) => part.type === "hour")?.value;
  return Number(hour ?? 0);
}

function formatBrazilianDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function heatClass(value: number | null) {
  if (value === null) return "empty";
  if (value >= GOOD_SLA_THRESHOLD) return "ok";
  if (value >= WARNING_SLA_THRESHOLD) return "warning";
  return "critical";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ origem?: string; transportadoraId?: string }>;
}) {
  const [currentUser, filters] = await Promise.all([requireInternalUser("/"), searchParams]);
  const canManage = isInternalAdmin(currentUser.role);
  const origemFilter = filters.origem === "demo" || filters.origem === "todos" ? filters.origem : "real";
  const transportadoraFilter = filters.transportadoraId ?? "";

  const today = startOfLocalDay(new Date());
  const tomorrow = addDays(today, 1);
  const rangeStart = addDays(today, -(HISTORY_DAYS - 1));
  const days = Array.from({ length: HISTORY_DAYS }, (_, index) => addDays(rangeStart, index));

  const transportadoras = await prisma.transportadora.findMany({
    include: {
      submissions: {
        where: { dataReport: { gte: rangeStart, lt: tomorrow } },
        orderBy: { dataReport: "desc" },
        include: { previousDayMetrics: true, ufMetrics: true },
      },
    },
    orderBy: { nome: "asc" },
  });

  const filteredTransportadoras = transportadoras.filter((item) => {
    const matchesOrigem = origemFilter === "todos" || item.origem === origemFilter;
    const matchesTransportadora = !transportadoraFilter || item.id === transportadoraFilter;
    return matchesOrigem && matchesTransportadora;
  });
  const activeTransportadoras = filteredTransportadoras.filter((item) => item.ativo);
  const relatoriosHoje = activeTransportadoras.filter((transportadora) =>
    transportadora.submissions.some((submission) => submission.dataReport >= today && submission.dataReport < tomorrow),
  ).length;
  const ativas = activeTransportadoras.length;
  const pendentes = Math.max(0, ativas - relatoriosHoje);
  const ultimoEnvio = filteredTransportadoras
    .flatMap((item) => item.submissions)
    .sort((a, b) => b.dataReport.getTime() - a.dataReport.getTime())[0];

  const carrierRows = activeTransportadoras.map((transportadora) => {
    const submissionsByDate = new Map(transportadora.submissions.map((submission) => [dateKey(submission.dataReport), submission]));
    const sentDays = days.filter((day) => submissionsByDate.has(dateKey(day))).length;
    const periodMetrics = transportadora.submissions
      .map((submission) => submission.previousDayMetrics)
      .filter((metrics): metrics is NonNullable<typeof metrics> => Boolean(metrics));
    const averageSla = weightedSla(periodMetrics);
    const recentSla = weightedSla(periodMetrics.slice(0, 3));
    const baselineSla = weightedSla(periodMetrics.slice(3));
    const slaDelta = recentSla !== null && baselineSla !== null ? recentSla - baselineSla : null;
    const qualityIssueRate = issueRate(periodMetrics);
    const last = transportadora.submissions[0];
    const todaySubmission = submissionsByDate.get(dateKey(today));
    let consecutiveMisses = 0;
    for (const day of [...days].reverse()) {
      if (submissionsByDate.has(dateKey(day))) break;
      consecutiveMisses += 1;
    }

    return {
      transportadora,
      submissionsByDate,
      sentDays,
      adherence: days.length > 0 ? (sentDays / days.length) * 100 : 0,
      averageSla,
      recentSla,
      baselineSla,
      slaDelta,
      qualityIssueRate,
      last,
      todaySubmission,
      consecutiveMisses,
    };
  });

  const melhoresSla = [...carrierRows]
    .filter((row) => row.averageSla !== null)
    .sort((a, b) => (b.averageSla ?? 0) - (a.averageSla ?? 0))
    .slice(0, 3);
  const pendentesHoje = carrierRows.filter((row) => !row.todaySubmission);
  const coberturaPeriodo =
    carrierRows.length > 0 ? carrierRows.reduce((sum, row) => sum + row.adherence, 0) / carrierRows.length : 0;
  const riskRows = carrierRows
    .map((row) => {
      const factors: string[] = [];
      let score = 0;

      if (!row.todaySubmission) {
        score += 35;
        factors.push("pendente hoje");
      }
      if (row.adherence < 70) {
        score += 25;
        factors.push("baixa cobertura");
      } else if (row.adherence < 90) {
        score += 12;
        factors.push("cobertura parcial");
      }
      if (row.averageSla === null) {
        score += 15;
        factors.push("sem SLA no período");
      } else if (row.averageSla < WARNING_SLA_THRESHOLD) {
        score += 25;
        factors.push("SLA crítico");
      } else if (row.averageSla < GOOD_SLA_THRESHOLD) {
        score += 12;
        factors.push("SLA abaixo da meta");
      }
      if (row.slaDelta !== null && row.slaDelta <= -3) {
        score += 15;
        factors.push("queda recente");
      } else if (row.slaDelta !== null && row.slaDelta <= -1.5) {
        score += 8;
        factors.push("queda moderada");
      }
      if (row.qualityIssueRate !== null && row.qualityIssueRate >= 7) {
        score += 15;
        factors.push("insucesso/devolução alto");
      } else if (row.qualityIssueRate !== null && row.qualityIssueRate >= 5) {
        score += 8;
        factors.push("insucesso/devolução em atenção");
      }

      return {
        ...row,
        riskScore: Math.min(100, score),
        riskFactors: factors.length ? factors : ["sem alerta relevante"],
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore || a.transportadora.nome.localeCompare(b.transportadora.nome));
  const riskSummary = {
    critical: riskRows.filter((row) => riskClass(row.riskScore) === "critical").length,
    warning: riskRows.filter((row) => riskClass(row.riskScore) === "warning").length,
    ok: riskRows.filter((row) => riskClass(row.riskScore) === "ok").length,
  };
  const dailyTrend = days.map((day) => {
    const sentSubmissions = activeTransportadoras
      .map((transportadora) => transportadora.submissions.find((submission) => dateKey(submission.dataReport) === dateKey(day)))
      .filter((submission): submission is NonNullable<typeof submission> => Boolean(submission));
    const metrics = sentSubmissions
      .map((submission) => submission.previousDayMetrics)
      .filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));
    const sent = sentSubmissions.length;
    const pending = Math.max(0, activeTransportadoras.length - sent);

    return {
      day,
      sent,
      pending,
      sentRate: activeTransportadoras.length ? (sent / activeTransportadoras.length) * 100 : 0,
      sla: weightedSla(metrics),
    };
  });
  const deteriorationRows = carrierRows
    .filter((row) => row.slaDelta !== null && row.slaDelta < 0)
    .sort((a, b) => (a.slaDelta ?? 0) - (b.slaDelta ?? 0))
    .slice(0, 5);
  const heatmapRows = carrierRows.map((row) => {
    const ufValues = BRAZILIAN_UFS.map((uf) => {
      const ufMetrics = row.transportadora.submissions.flatMap((submission) =>
        submission.ufMetrics.filter((metric) => metric.uf === uf),
      );
      const dentroDoPrazo = ufMetrics.reduce((sum, metric) => sum + metric.dentroDoPrazo, 0);
      const foraDoPrazo = ufMetrics.reduce((sum, metric) => sum + metric.foraDoPrazo, 0);
      return {
        uf,
        sla: slaPercent(dentroDoPrazo, foraDoPrazo),
        total: dentroDoPrazo + foraDoPrazo,
      };
    });

    return { ...row, ufValues };
  });
  const allSubmissions = activeTransportadoras.flatMap((transportadora) => transportadora.submissions);
  const submittedReports = allSubmissions.filter((submission) => submission.status !== "draft");
  const lateSubmissions = submittedReports.filter((submission) => submission.submittedAt && localHour(submission.submittedAt) >= 11);
  const draftReports = allSubmissions.filter((submission) => submission.status === "draft");
  const reportsWithNotes = allSubmissions.filter((submission) => Boolean(submission.observacoes?.trim()));
  const qualityStats = {
    lateSubmissions: lateSubmissions.length,
    draftReports: draftReports.length,
    reportsWithNotes: reportsWithNotes.length,
    pendingToday: pendentesHoje.length,
  };
  const origemCounts = {
    real: transportadoras.filter((item) => item.origem === "real").length,
    demo: transportadoras.filter((item) => item.origem === "demo").length,
    todos: transportadoras.length,
  };

  return (
    <main className="shell">
      <div className="page-title">
        <div>
          <h1>Admin operacional</h1>
          <p className="muted">Acompanhe os preenchimentos diários e acesse os relatórios das transportadoras.</p>
        </div>
        <div className="actions">
          {canManage ? (
            <Link className="btn" href="/transportadoras/nova">
              <Plus size={18} /> Nova transportadora
            </Link>
          ) : null}
          <Link className="btn secondary" href="/automacoes/logs">
            <ClipboardList size={18} /> Logs
          </Link>
        </div>
      </div>

      <section className="card dashboard-filters">
        <div>
          <h2 className="section-title">Recorte operacional</h2>
          <p className="muted">Por padrão, o painel mostra apenas transportadoras reais. Use a base demo para simular calendário e relatórios.</p>
        </div>
        <div className="filter-row">
          <div className="segmented-control" aria-label="Filtrar origem dos dados">
            <Link className={origemFilter === "real" ? "active" : ""} href={`/?origem=real${transportadoraFilter ? `&transportadoraId=${transportadoraFilter}` : ""}`}>
              Reais <span>{origemCounts.real}</span>
            </Link>
            <Link className={origemFilter === "demo" ? "active" : ""} href={`/?origem=demo${transportadoraFilter ? `&transportadoraId=${transportadoraFilter}` : ""}`}>
              Demo <span>{origemCounts.demo}</span>
            </Link>
            <Link className={origemFilter === "todos" ? "active" : ""} href={`/?origem=todos${transportadoraFilter ? `&transportadoraId=${transportadoraFilter}` : ""}`}>
              Todas <span>{origemCounts.todos}</span>
            </Link>
          </div>
          <form className="filter-form">
            <input type="hidden" name="origem" value={origemFilter} />
            <label className="sr-only" htmlFor="transportadoraId">Transportadora</label>
            <select id="transportadoraId" name="transportadoraId" defaultValue={transportadoraFilter}>
              <option value="">Todas as transportadoras</option>
              {transportadoras
                .filter((item) => origemFilter === "todos" || item.origem === origemFilter)
                .map((transportadora) => (
                  <option key={transportadora.id} value={transportadora.id}>
                    {transportadora.nome}
                  </option>
                ))}
            </select>
            <button className="btn secondary compact" type="submit">
              <Layers3 size={16} /> Aplicar
            </button>
          </form>
        </div>
      </section>

      <section className="grid grid-4">
        <div className="card metric-card">
          <div className="metric-label">Transportadoras ativas</div>
          <div className="metric-value">{ativas}</div>
        </div>
        <div className="card metric-card green">
          <div className="metric-label">Relatórios enviados hoje</div>
          <div className="metric-value">{relatoriosHoje}</div>
        </div>
        <div className="card metric-card orange">
          <div className="metric-label">Relatórios pendentes hoje</div>
          <div className="metric-value">{pendentes}</div>
        </div>
        <div className="card metric-card">
          <div className="metric-label">Cobertura em {HISTORY_DAYS} dias</div>
          <div className="metric-value">{carrierRows.length ? `${coberturaPeriodo.toFixed(0)}%` : "-"}</div>
        </div>
      </section>

      <section className="operations-grid">
        <div className="card control-panel">
          <div className="panel-heading">
            <div>
              <h2 className="section-title">Fila de hoje</h2>
              <p className="muted">Transportadoras ativas que ainda não enviaram o relatório de {formatBrazilianDate(today)}.</p>
            </div>
            <span className={`health-pill ${pendentesHoje.length ? "warning" : "ok"}`}>
              {pendentesHoje.length === 1 ? "1 pendente" : pendentesHoje.length ? `${pendentesHoje.length} pendentes` : "Tudo recebido"}
            </span>
          </div>

          {pendentesHoje.length ? (
            <div className="focus-list">
              {pendentesHoje.map(({ transportadora, last, consecutiveMisses }) => (
                <div className="focus-row" key={transportadora.id}>
                  <AlertTriangle size={18} />
                  <div>
                    <strong>{transportadora.nome}</strong>
                    <span>
                      {consecutiveMisses > 1 ? `${consecutiveMisses} dias sem envio` : "pendente hoje"} · Último envio:{" "}
                      {last ? formatBrazilianDate(last.dataReport) : "sem histórico"}
                    </span>
                    {last?.submittedByName || last?.submittedAt ? (
                      <span>
                        {last.submittedByName ? `Responsável: ${last.submittedByName}` : "Responsável não informado"}
                        {last.submittedAt ? ` · ${formatBrazilianDateTime(last.submittedAt)}` : ""}
                      </span>
                    ) : null}
                  </div>
                  <Link className="btn secondary compact" href={`/historico/${transportadora.id}`}>
                    <History size={16} /> Histórico
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="status-ok">
              <CheckCircle2 size={20} />
              <span>Todos os relatórios esperados para hoje foram recebidos.</span>
            </div>
          )}
        </div>

        <div className="card control-panel">
          <div className="panel-heading">
            <div>
              <h2 className="section-title">Melhor SLA no período</h2>
              <p className="muted">Média ponderada dos relatórios enviados nos últimos {HISTORY_DAYS} dias.</p>
            </div>
          </div>

          <div className="ranking-list">
            {melhoresSla.length ? (
              melhoresSla.map((row, index) => (
                <div className="ranking-row" key={row.transportadora.id}>
                  <span className="rank">{index + 1}</span>
                  <div>
                    <strong>{row.transportadora.nome}</strong>
                    <span>{row.sentDays}/{HISTORY_DAYS} dias enviados</span>
                  </div>
                  <span className={`health-pill ${slaClass(row.averageSla)}`}>{row.averageSla?.toFixed(1)}%</span>
                </div>
              ))
            ) : (
              <p className="muted">Sem dados suficientes para comparar SLA.</p>
            )}
          </div>
        </div>
      </section>

      <section className="card risk-panel">
        <div className="panel-heading">
          <div>
            <h2 className="section-title">Risco operacional</h2>
            <p className="muted">
              Priorização por transportadora combinando pendência de envio, cobertura, SLA, queda recente e incidências.
            </p>
          </div>
          <div className="risk-summary" aria-label="Resumo de risco operacional">
            <span className="health-pill critical">{riskSummary.critical} crítico</span>
            <span className="health-pill warning">{riskSummary.warning} atenção</span>
            <span className="health-pill ok">{riskSummary.ok} saudável</span>
          </div>
        </div>

        {!riskRows.length ? (
          <EmptyState
            title="Sem transportadoras para calcular risco"
            description="Ajuste os filtros ou cadastre transportadoras ativas para ver a matriz de risco operacional."
            action={{ href: "/", label: "Ver base real" }}
          />
        ) : (
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="risk-table">
              <thead>
                <tr>
                  <th>Transportadora</th>
                  <th>Risco</th>
                  <th>Fatores</th>
                  <th>Cobertura</th>
                  <th>SLA médio</th>
                  <th>Queda recente</th>
                  <th>Insucesso + devolução</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {riskRows.map((row) => (
                  <tr key={row.transportadora.id}>
                    <td>
                      <strong>{row.transportadora.nome}</strong>
                      <div className="muted">{row.transportadora.codigoSlug}</div>
                    </td>
                    <td>
                      <div className="risk-score">
                        <span className={`health-pill ${riskClass(row.riskScore)}`}>{riskLabel(row.riskScore)}</span>
                        <strong>{row.riskScore}</strong>
                      </div>
                    </td>
                    <td>
                      <div className="risk-factors">
                        {row.riskFactors.slice(0, 3).map((factor) => (
                          <span key={factor}>{factor}</span>
                        ))}
                      </div>
                    </td>
                    <td>{row.adherence.toFixed(0)}%</td>
                    <td>{row.averageSla !== null ? `${row.averageSla.toFixed(1)}%` : "-"}</td>
                    <td className={row.slaDelta !== null && row.slaDelta < 0 ? "negative-delta" : ""}>
                      {row.slaDelta !== null ? `${row.slaDelta > 0 ? "+" : ""}${row.slaDelta.toFixed(1)} p.p.` : "-"}
                    </td>
                    <td>{row.qualityIssueRate !== null ? `${row.qualityIssueRate.toFixed(1)}%` : "-"}</td>
                    <td>
                      <div className="actions">
                        <Link className="btn secondary compact" href={`/transportadoras/${row.transportadora.id}`}>
                          <ClipboardList size={16} /> Diagnóstico
                        </Link>
                        {row.last ? (
                          <Link className="btn secondary compact" href={`/reports/${row.transportadora.id}/${dateKey(row.last.dataReport)}`}>
                            <FileBarChart size={16} /> Relatório
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="analytics-grid">
        <div className="card trend-panel">
          <div className="panel-heading">
            <div>
              <h2 className="section-title">Tendência diária cross-transportadora</h2>
              <p className="muted">Evolução de recebimento e SLA médio ponderado por dia no recorte atual.</p>
            </div>
          </div>
          <div className="trend-list">
            {dailyTrend.map((item) => (
              <div className="trend-row" key={dateKey(item.day)}>
                <div>
                  <strong>{shortBrazilianDate(item.day)}</strong>
                  <span>{weekdayLabel(item.day)}</span>
                </div>
                <div className="trend-bars" aria-label={`${item.sent} enviados e ${item.pending} pendentes`}>
                  <span className="trend-sent" style={{ width: `${Math.max(4, item.sentRate)}%` }} />
                  <span className="trend-pending" style={{ width: `${Math.max(0, 100 - item.sentRate)}%` }} />
                </div>
                <div className="trend-values">
                  <strong>{item.sent}/{activeTransportadoras.length}</strong>
                  <span>{item.sla !== null ? `${item.sla.toFixed(1)}% SLA` : "sem SLA"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card deterioration-panel">
          <div className="panel-heading">
            <div>
              <h2 className="section-title">Ranking de deterioração</h2>
              <p className="muted">Transportadoras com maior queda do SLA recente frente ao restante do período.</p>
            </div>
          </div>
          {deteriorationRows.length ? (
            <div className="ranking-list">
              {deteriorationRows.map((row, index) => (
                <div className="ranking-row" key={row.transportadora.id}>
                  <span className="rank">{index + 1}</span>
                  <div>
                    <strong>{row.transportadora.nome}</strong>
                    <span>
                      Recente {row.recentSla?.toFixed(1)}% · Base {row.baselineSla?.toFixed(1)}%
                    </span>
                  </div>
                  <span className="health-pill critical">{row.slaDelta?.toFixed(1)} p.p.</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="status-ok">
              <CheckCircle2 size={20} />
              <span>Nenhuma queda recente relevante no recorte atual.</span>
            </div>
          )}
        </div>
      </section>

      <section className="analytics-grid">
        <div className="card heatmap-panel">
          <div className="panel-heading">
            <div>
              <h2 className="section-title">Heatmap UF x transportadora</h2>
              <p className="muted">SLA médio por UF para separar problema de rota/região de problema geral da transportadora.</p>
            </div>
          </div>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="heatmap-table">
              <thead>
                <tr>
                  <th>Transportadora</th>
                  {BRAZILIAN_UFS.map((uf) => (
                    <th key={uf}>{uf}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapRows.map((row) => (
                  <tr key={row.transportadora.id}>
                    <td>
                      <strong>{row.transportadora.nome}</strong>
                    </td>
                    {row.ufValues.map((value) => (
                      <td key={value.uf}>
                        <span className={`heat-cell ${heatClass(value.sla)}`}>
                          {value.sla !== null ? `${value.sla.toFixed(0)}%` : "-"}
                          <small>{value.total ? `${value.total} ped.` : "sem vol."}</small>
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card quality-panel">
          <div className="panel-heading">
            <div>
              <h2 className="section-title">Qualidade do envio</h2>
              <p className="muted">Sinais de disciplina operacional e confiabilidade do dado enviado.</p>
            </div>
          </div>
          <div className="quality-grid">
            <div>
              <span>Envios após 11h</span>
              <strong>{qualityStats.lateSubmissions}</strong>
            </div>
            <div>
              <span>Rascunhos no período</span>
              <strong>{qualityStats.draftReports}</strong>
            </div>
            <div>
              <span>Relatórios com observação</span>
              <strong>{qualityStats.reportsWithNotes}</strong>
            </div>
            <div>
              <span>Pendências hoje</span>
              <strong>{qualityStats.pendingToday}</strong>
            </div>
          </div>
          <p className="metric-note">
            Inconsistências bloqueadas no formulário ainda não são persistidas; quando houver log dedicado, entram aqui como métrica de qualidade.
          </p>
        </div>
      </section>

      <section className="card calendar-panel">
        <div className="panel-heading">
          <div>
            <h2 className="section-title">Calendário de recebimento</h2>
            <p className="muted">Visão entre transportadoras dos relatórios enviados e ausentes nos últimos {HISTORY_DAYS} dias.</p>
          </div>
          <CalendarDays size={22} aria-hidden="true" />
        </div>

        {!filteredTransportadoras.length ? (
          <EmptyState
            title="Nenhuma transportadora neste recorte"
            description="Ajuste os filtros para ver outra origem de dados ou outra transportadora."
            action={{ href: "/", label: "Ver base real" }}
          />
        ) : (
          <div className="calendar-scroll">
            <table className="calendar-table">
              <thead>
                <tr>
                  <th>Transportadora</th>
                  {days.map((day) => (
                    <th key={dateKey(day)}>
                      <span>{weekdayLabel(day)}</span>
                      <strong>{shortBrazilianDate(day)}</strong>
                    </th>
                  ))}
                  <th>Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {carrierRows.map((row) => (
                  <tr key={row.transportadora.id}>
                    <td>
                      <strong>{row.transportadora.nome}</strong>
                      <div className="muted">{row.transportadora.codigoSlug}</div>
                    </td>
                    {days.map((day) => {
                      const submission = row.submissionsByDate.get(dateKey(day));
                      const statusLabel = submission ? "Recebido" : "Não enviado";
                      return (
                        <td key={dateKey(day)} className="calendar-cell">
                          <span className={`calendar-dot ${submission ? "ok" : "missing"}`} title={statusLabel}>
                            {submission ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                            <span className="sr-only">{statusLabel}</span>
                          </span>
                        </td>
                      );
                    })}
                    <td>
                      <strong>{row.adherence.toFixed(0)}%</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="panel-heading">
          <div>
            <h2 className="section-title">Transportadoras</h2>
            <p className="muted">Acesso rápido ao cadastro, histórico e último relatório disponível.</p>
          </div>
          <span className="pill">{ultimoEnvio ? `Último envio: ${formatBrazilianDate(ultimoEnvio.dataReport)}` : "Sem envios"}</span>
        </div>

        {!filteredTransportadoras.length ? (
          <EmptyState
            title="Nenhuma transportadora neste recorte"
            description="Ajuste os filtros para ver outra origem de dados ou outra transportadora."
            action={{ href: "/", label: "Ver base real" }}
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Transportadora</th>
                  <th>Status hoje</th>
                  <th>Ativa</th>
                  <th>SLA médio</th>
                  <th>Último envio</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransportadoras.map((transportadora) => {
                  const row = carrierRows.find((item) => item.transportadora.id === transportadora.id);
                  const last = transportadora.submissions[0];
                  const sentToday = Boolean(row?.todaySubmission);
                  return (
                    <tr key={transportadora.id}>
                      <td>
                        <strong>{transportadora.nome}</strong>
                        <div className="muted">{transportadora.codigoSlug}</div>
                        <span className={`pill tiny ${transportadora.origem === "real" ? "ok" : "pending"}`}>
                          {transportadora.origem === "real" ? "Real" : "Demo"}
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${sentToday ? "ok" : "pending"}`}>
                          {sentToday ? "Recebido" : "Pendente"}
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${transportadora.ativo ? "ok" : "pending"}`}>
                          {transportadora.ativo ? "Ativa" : "Inativa"}
                        </span>
                      </td>
                      <td>{row?.averageSla ? `${row.averageSla.toFixed(1)}%` : "-"}</td>
                      <td>{last ? formatBrazilianDate(last.dataReport) : "-"}</td>
                      <td>
                        <div className="actions">
                          {canManage ? (
                            <Link className="btn secondary" href={`/transportadoras/${transportadora.id}/editar`}>
                              <Edit size={16} /> Editar
                            </Link>
                          ) : null}
                          <Link className="btn secondary" href={`/transportadoras/${transportadora.id}`}>
                            <ClipboardList size={16} /> Diagnóstico
                          </Link>
                          {last ? (
                            <Link className="btn secondary" href={`/reports/${transportadora.id}/${dateKey(last.dataReport)}`}>
                              <FileBarChart size={16} /> Relatório
                            </Link>
                          ) : null}
                          <Link className="btn secondary" href={`/historico/${transportadora.id}`}>
                            <History size={16} /> Histórico
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
