import { medirEtapa } from "@/lib/diagnostico-tempo";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileBarChart,
  History,
  Layers3,
  Plus,
  XCircle,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { isInternalAdmin, requireInternalUser } from "@/lib/auth";
import { listRemoteTransportadoras } from "@/lib/godeploy-db";
import { startOfLocalDay } from "@/lib/dates";
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
  if (score >= 60) return "CrÃ­tico";
  if (score >= 30) return "AtenÃ§Ã£o";
  return "SaudÃ¡vel";
}

function localHour(date: Date) {
  const hour = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).formatToParts(date).find((part) => part.type === "hour")?.value;
  return Number(hour ?? 0);
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
  searchParams: Promise<{ origem?: string; transportadoraId?: string; pendentes?: string }>;
}) {
  const [currentUser, filters] = await Promise.all([medirEtapa("admin:autenticacao", () => requireInternalUser("/")), searchParams]);
  const canManage = isInternalAdmin(currentUser.role);
  const origemFilter = filters.origem === "demo" || filters.origem === "todos" ? filters.origem : "real";
  const transportadoraFilter = filters.transportadoraId ?? "";
  const pendentesOnly = filters.pendentes === "1";

  const today = startOfLocalDay(new Date());
  const tomorrow = addDays(today, 1);
  const rangeStart = addDays(today, -(HISTORY_DAYS - 1));
  const days = Array.from({ length: HISTORY_DAYS }, (_, index) => addDays(rangeStart, index));

  const transportadorasRemotas = await medirEtapa(
    "admin:relatorios",
    () => listRemoteTransportadoras(),
  );

  const transportadoras = transportadorasRemotas.map((transportadora) => ({
    ...transportadora,
    origem: "real",
    submissions: [],
  }));

  const filteredTransportadoras = transportadoras.filter((item) => {
    const matchesOrigem = origemFilter === "todos" || item.origem === origemFilter;
    const matchesTransportadora = !transportadoraFilter || item.id === transportadoraFilter;
    return matchesOrigem && matchesTransportadora;
  });
  const activeTransportadoras = filteredTransportadoras.filter((item) => item.ativo);
  const relatoriosHoje = 0;
  const ativas = activeTransportadoras.length;
  const pendentes = Math.max(0, ativas - relatoriosHoje);

  const carrierRows = activeTransportadoras.map((transportadora) => ({
    transportadora,
    submissionsByDate: new Map<string, {
      dataReport: Date;
      status: string;
      submittedAt: Date | null;
      observacoes: string | null;
    }>(),
    sentDays: 0,
    adherence: 0,
    averageSla: null as number | null,
    recentSla: null as number | null,
    baselineSla: null as number | null,
    slaDelta: null as number | null,
    qualityIssueRate: null as number | null,
    last: null as null | {
      dataReport: Date;
      status: string;
      submittedAt: Date | null;
      observacoes: string | null;
    },
    todaySubmission: null as null | {
      dataReport: Date;
      status: string;
      submittedAt: Date | null;
      observacoes: string | null;
    },
    consecutiveMisses: 0,
  }));

  const melhoresSla: typeof carrierRows = [];
  const pendentesHoje = carrierRows;
  const hasOperationalHistory = false;

  const riskRows = carrierRows.map((row) => ({
    ...row,
    riskScore: 0,
    riskFactors: ["histórico em migração"],
    hasHistory: false,
  }));

  const riskRowsToShow = pendentesOnly
    ? riskRows.filter((row) => !row.todaySubmission)
    : riskRows;

  const riskSummary = {
    critical: 0,
    warning: 0,
    ok: 0,
    semDado: riskRows.length,
  };

  const dailyTrend = days.map((day) => ({
    day,
    sent: 0,
    pending: activeTransportadoras.length,
    sentRate: 0,
    sla: null as number | null,
  }));

  const deteriorationRows: typeof carrierRows = [];

  const heatmapRows = carrierRows.map((row) => ({
    ...row,
    ufValues: BRAZILIAN_UFS.map((uf) => ({
      uf,
      sla: null as number | null,
      total: 0,
    })),
  }));

  const qualityStats = {
    lateSubmissions: 0,
    draftReports: 0,
    reportsWithNotes: 0,
    pendingToday: pendentesHoje.length,
  };
  return (
    <main className="shell admin-dashboard">
      <div className="page-title">
        <div>
          <h1>Admin operacional</h1>
          <p className="muted">Acompanhe os preenchimentos diÃ¡rios e acesse os relatÃ³rios das transportadoras.</p>
        </div>
        <div className="actions">
          {canManage ? (
            <Link className="btn" href="/transportadoras/nova">
              <Plus size={18} /> Nova transportadora
            </Link>
          ) : null}
          {canManage ? (
            <Link className="btn secondary" href="/automacoes/logs">
              <ClipboardList size={18} /> Logs
            </Link>
          ) : null}
        </div>
      </div>

      <section className="card dashboard-filters">
        <div className="filter-row">
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

      <section className="grid grid-3">
        <div className="card metric-card">
          <div className="metric-label">Transportadoras ativas</div>
          <div className="metric-value">{ativas}</div>
        </div>
        <div className="card metric-card green">
          <div className="metric-label">RelatÃ³rios enviados hoje</div>
          <div className="metric-value">{relatoriosHoje}</div>
        </div>
        <div className="card metric-card orange">
          <div className="metric-label">RelatÃ³rios pendentes hoje</div>
          <div className="metric-value">{pendentes}</div>
        </div>
      </section>

      <section className="card control-panel" style={{ marginTop: 18 }}>
        <div className="panel-heading">
          <div>
            <h2 className="section-title">Melhor SLA no perÃ­odo</h2>
            <p className="muted">MÃ©dia ponderada dos relatÃ³rios enviados nos Ãºltimos {HISTORY_DAYS} dias.</p>
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
            <div className="status-ok neutral">
              <CheckCircle2 size={20} />
              <span>Aguardando os primeiros envios para comparar SLA no perÃ­odo.</span>
            </div>
          )}
        </div>
      </section>

      <section className="card risk-panel">
        <div className="panel-heading">
          <div>
            <h2 className="section-title">Risco operacional</h2>
            <p className="muted">
              PriorizaÃ§Ã£o por transportadora combinando pendÃªncia de envio, cobertura, SLA, queda recente e incidÃªncias.
            </p>
          </div>
          <div className="risk-summary" aria-label="Resumo de risco operacional">
            <span className="health-pill critical">{riskSummary.critical} crÃ­tico</span>
            <span className="health-pill warning">{riskSummary.warning} atenÃ§Ã£o</span>
            <span className="health-pill ok">{riskSummary.ok} saudÃ¡vel</span>
            {riskSummary.semDado ? <span className="health-pill neutral">{riskSummary.semDado} sem dado</span> : null}
          </div>
        </div>

        {pendentesHoje.length ? (
          <Link
            className={`btn secondary compact${pendentesOnly ? " active" : ""}`}
            href={`/?origem=${origemFilter}${transportadoraFilter ? `&transportadoraId=${transportadoraFilter}` : ""}${pendentesOnly ? "" : "&pendentes=1"}`}
            style={{ marginTop: 12 }}
          >
            {pendentesOnly ? "Ver todas" : `Ver sÃ³ pendentes (${pendentesHoje.length})`}
          </Link>
        ) : null}

        {!riskRowsToShow.length ? (
          <EmptyState
            title={pendentesOnly ? "Nenhuma transportadora pendente" : "Sem transportadoras para calcular risco"}
            description={
              pendentesOnly
                ? "Todos os relatÃ³rios esperados para hoje foram recebidos."
                : "Ajuste os filtros ou cadastre transportadoras ativas para ver a matriz de risco operacional."
            }
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
                  <th>SLA mÃ©dio</th>
                  <th>Queda recente</th>
                  <th>Insucesso + devoluÃ§Ã£o</th>
                  <th>AÃ§Ãµes</th>
                </tr>
              </thead>
              <tbody>
                {riskRowsToShow.map((row) => (
                  <tr key={row.transportadora.id}>
                    <td>
                      <strong>{row.transportadora.nome}</strong>
                      <div className="muted">{row.transportadora.codigoSlug}</div>
                    </td>
                    <td>
                      <div className="risk-score">
                        {row.hasHistory ? (
                          <>
                            <span className={`health-pill ${riskClass(row.riskScore)}`}>{riskLabel(row.riskScore)}</span>
                            <strong>{row.riskScore}</strong>
                          </>
                        ) : (
                          <span className="health-pill neutral">Sem dado suficiente</span>
                        )}
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
                          <ClipboardList size={16} /> DiagnÃ³stico
                        </Link>
                        <Link className="btn secondary compact" href={`/historico/${row.transportadora.id}`}>
                          <History size={16} /> HistÃ³rico
                        </Link>
                        {row.last ? (
                          <Link className="btn secondary compact" href={`/reports/${row.transportadora.id}/${dateKey(row.last.dataReport)}`}>
                            <FileBarChart size={16} /> RelatÃ³rio
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

      <details className="analysis-disclosure" open={hasOperationalHistory}>
        <summary>
          <span>AnÃ¡lises detalhadas</span>
          <strong>{hasOperationalHistory ? "TendÃªncia, UF, qualidade e calendÃ¡rio" : "Abrir dados de acompanhamento"}</strong>
        </summary>

      <section className="analytics-grid">
        <div className="card trend-panel">
          <div className="panel-heading">
            <div>
              <h2 className="section-title">TendÃªncia diÃ¡ria cross-transportadora</h2>
              <p className="muted">EvoluÃ§Ã£o de recebimento e SLA mÃ©dio ponderado por dia no recorte atual.</p>
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
              <h2 className="section-title">Ranking de deterioraÃ§Ã£o</h2>
              <p className="muted">Transportadoras com maior queda do SLA recente frente ao restante do perÃ­odo.</p>
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
                      Recente {row.recentSla?.toFixed(1)}% Â· Base {row.baselineSla?.toFixed(1)}%
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
              <p className="muted">SLA mÃ©dio por UF para separar problema de rota/regiÃ£o de problema geral da transportadora.</p>
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
              <span>Envios apÃ³s 11h</span>
              <strong>{qualityStats.lateSubmissions}</strong>
            </div>
            <div>
              <span>Rascunhos no perÃ­odo</span>
              <strong>{qualityStats.draftReports}</strong>
            </div>
            <div>
              <span>RelatÃ³rios com observaÃ§Ã£o</span>
              <strong>{qualityStats.reportsWithNotes}</strong>
            </div>
            <div>
              <span>PendÃªncias hoje</span>
              <strong>{qualityStats.pendingToday}</strong>
            </div>
          </div>
          <p className="metric-note">
            InconsistÃªncias bloqueadas no formulÃ¡rio ainda nÃ£o sÃ£o persistidas; quando houver log dedicado, entram aqui como mÃ©trica de qualidade.
          </p>
        </div>
      </section>

      <section className="card calendar-panel">
        <div className="panel-heading">
          <div>
            <h2 className="section-title">CalendÃ¡rio de recebimento</h2>
            <p className="muted">VisÃ£o entre transportadoras dos relatÃ³rios enviados e ausentes nos Ãºltimos {HISTORY_DAYS} dias.</p>
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
                      const statusLabel = submission ? "Recebido" : "NÃ£o enviado";
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
      </details>

    </main>
  );
}




