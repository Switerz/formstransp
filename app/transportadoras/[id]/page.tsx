import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  Edit,
  FileBarChart,
  History,
  KeyRound,
  UsersRound,
} from "lucide-react";
import {
  asPercent,
  calculateDailySLA,
  calculateFailureRate,
  calculateMonthlySLA,
  calculateReturnRate,
  safeRate,
} from "@/lib/calculations";
import { isInternalAdmin, requireTransportadoraAccess } from "@/lib/auth";
import { formatBrazilianDate, startOfLocalDay } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { BRAZILIAN_UFS } from "@/lib/ufs";

const HISTORY_DAYS = 30;
const PENDING_WINDOW_DAYS = 14;

export const dynamic = "force-dynamic";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shortBrazilianDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

function slaClass(value: number | null) {
  if (value === null) return "pending";
  if (value >= 0.93) return "ok";
  if (value >= 0.9) return "warning";
  return "critical";
}

function slaLabel(value: number | null) {
  if (value === null) return "Sem volume";
  if (value >= 0.93) return "Dentro da meta";
  if (value >= 0.9) return "Atenção";
  return "Crítico";
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

function parseReasons(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.join(" ") : value;
  } catch {
    return value;
  }
}

export default async function TransportadoraDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await requireTransportadoraAccess(id, `/transportadoras/${id}`);
  const canManage = isInternalAdmin(currentUser.role);

  const today = startOfLocalDay(new Date());
  const tomorrow = addDays(today, 1);
  const rangeStart = addDays(today, -(HISTORY_DAYS - 1));
  const pendingStart = addDays(today, -(PENDING_WINDOW_DAYS - 1));
  const pendingDays = Array.from({ length: PENDING_WINDOW_DAYS }, (_, index) => addDays(pendingStart, index));

  const transportadora = await prisma.transportadora.findUnique({
    where: { id },
    include: {
      users: { orderBy: [{ role: "asc" }, { nome: "asc" }] },
      submissions: {
        where: { dataReport: { gte: rangeStart, lt: tomorrow } },
        orderBy: { dataReport: "desc" },
        include: {
          previousDayMetrics: true,
          currentDayPreviewMetrics: true,
          ufMetrics: { orderBy: { uf: "asc" } },
        },
      },
      qualityLogs: {
        where: { createdAt: { gte: rangeStart } },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { user: true },
      },
    },
  });
  if (!transportadora) notFound();

  const submitted = transportadora.submissions.filter((submission) => submission.status === "submitted");
  const metrics = submitted
    .filter((submission) => submission.previousDayMetrics)
    .map((submission) => ({ ...submission.previousDayMetrics!, dataReport: submission.dataReport }));
  const lastSubmission = transportadora.submissions[0] ?? null;
  const todaySubmission = transportadora.submissions.find((submission) => dateKey(submission.dataReport) === dateKey(today));
  const submissionsByDate = new Map(transportadora.submissions.map((submission) => [dateKey(submission.dataReport), submission]));
  const missingDays = pendingDays.filter((day) => !submissionsByDate.has(dateKey(day)));
  const recentSubmitted = submitted.slice(0, 7);
  const previousSubmitted = submitted.slice(7, 14);
  const recentSla = calculateMonthlySLA(
    recentSubmitted.filter((submission) => submission.previousDayMetrics).map((submission) => submission.previousDayMetrics!),
  );
  const baselineSla = calculateMonthlySLA(
    previousSubmitted.filter((submission) => submission.previousDayMetrics).map((submission) => submission.previousDayMetrics!),
  );
  const adherence = safeRate(submitted.length, HISTORY_DAYS);
  const averageSla = calculateMonthlySLA(metrics);
  const failureRate = calculateFailureRate(metrics);
  const returnRate = calculateReturnRate(metrics);
  const slaDelta = recentSubmitted.length && previousSubmitted.length ? (recentSla - baselineSla) * 100 : null;
  const riskScore =
    (adherence < 0.85 ? 25 : 0) +
    (averageSla < 0.9 ? 35 : averageSla < 0.93 ? 18 : 0) +
    (failureRate >= 0.05 ? 18 : 0) +
    (returnRate >= 0.025 ? 12 : 0) +
    (missingDays.length >= 3 ? 15 : missingDays.length ? 8 : 0) +
    (transportadora.qualityLogs.length ? 12 : 0);

  const dailyTrend = transportadora.submissions
    .slice()
    .reverse()
    .filter((submission) => submission.previousDayMetrics)
    .slice(-14)
    .map((submission) => ({
      date: submission.dataReport,
      sla: calculateDailySLA(submission.previousDayMetrics!),
      totalPedidos: submission.previousDayMetrics!.totalPedidos,
    }));

  const ufRows = BRAZILIAN_UFS.map((uf) => {
    const rows = transportadora.submissions.flatMap((submission) => submission.ufMetrics.filter((metric) => metric.uf === uf));
    const dentro = rows.reduce((sum, row) => sum + row.dentroDoPrazo, 0);
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    return { uf, sla: total ? dentro / total : null, total };
  });

  const recentNotes = submitted
    .filter((submission) => submission.observacoes)
    .slice(0, 5);
  const credentialPendingUsers = transportadora.users.filter((user) => user.passwordMustChange && !user.credentialSentAt);

  return (
    <main className="shell">
      <div className="report-toolbar">
        <Link className="btn secondary" href="/">
          <ArrowLeft size={16} /> Voltar ao admin
        </Link>
        <div className="actions">
          {canManage ? (
            <Link className="btn secondary" href={`/transportadoras/${transportadora.id}/editar`}>
              <Edit size={16} /> Editar
            </Link>
          ) : null}
          <Link className="btn secondary" href={`/historico/${transportadora.id}`}>
            <History size={16} /> Histórico
          </Link>
          {lastSubmission ? (
            <Link className="btn secondary" href={`/reports/${transportadora.id}/${dateKey(lastSubmission.dataReport)}`}>
              <FileBarChart size={16} /> Último report
            </Link>
          ) : null}
          {canManage ? (
            <Link className="btn secondary" href="/usuarios">
              <KeyRound size={16} /> Usuários
            </Link>
          ) : null}
        </div>
      </div>

      <section className="report-header">
        <div>
          <div className="report-kicker">DIAGNÓSTICO DA TRANSPORTADORA</div>
          <h1>{transportadora.nome}</h1>
        </div>
        <div>
          <strong>{transportadora.ativo ? "Ativa" : "Inativa"}</strong>
          <div>{transportadora.codigoSlug}</div>
        </div>
      </section>

      <section className="grid grid-4">
        <div className={`card metric-card ${riskClass(riskScore) === "critical" ? "red" : riskClass(riskScore) === "warning" ? "orange" : "green"}`}>
          <div className="metric-head">
            <div className="metric-label">Saúde operacional</div>
            <span className={`health-pill ${riskClass(riskScore)}`}>{riskLabel(riskScore)}</span>
          </div>
          <div className="metric-value">{riskScore}</div>
          <div className="metric-note">Score combina SLA, cobertura, pendências e qualidade do envio.</div>
        </div>
        <div className="card metric-card">
          <div className="metric-label">Cobertura de envio</div>
          <div className="metric-value">{asPercent(adherence, 0)}</div>
          <div className="metric-note">{submitted.length} envios nos últimos {HISTORY_DAYS} dias.</div>
        </div>
        <div className={`card metric-card ${slaClass(averageSla) === "critical" ? "red" : slaClass(averageSla) === "warning" ? "orange" : "green"}`}>
          <div className="metric-label">SLA médio recente</div>
          <div className="metric-value">{asPercent(averageSla)}</div>
          <div className="metric-note">
            {slaDelta !== null ? `Variação recente: ${slaDelta > 0 ? "+" : ""}${slaDelta.toFixed(1)} p.p.` : "Sem base anterior para comparar."}
          </div>
        </div>
        <div className="card metric-card orange">
          <div className="metric-label">Pendências atuais</div>
          <div className="metric-value">{todaySubmission ? 0 : 1}</div>
          <div className="metric-note">{todaySubmission ? "Report de hoje recebido." : "Report de hoje ainda pendente."}</div>
        </div>
      </section>

      <section className="analytics-grid">
        <div className="card">
          <div className="panel-heading">
            <div>
              <h2 className="section-title">Evolução do SLA</h2>
              <p className="muted">Últimos reports enviados pela transportadora, com meta operacional de 93%.</p>
            </div>
            <span className="pill">Meta 93%</span>
          </div>
          <div className="trend-legend" aria-label="Legenda do SLA">
            <span><i className="legend-dot ok" /> Dentro da meta</span>
            <span><i className="legend-dot warning" /> Atenção</span>
            <span><i className="legend-dot critical" /> Crítico</span>
          </div>
          <div className="carrier-trend-list">
            {dailyTrend.map((item) => (
              <div className="carrier-trend-row" key={dateKey(item.date)}>
                <div>
                  <strong>{shortBrazilianDate(item.date)}</strong>
                  <span>{item.totalPedidos} ped.</span>
                </div>
                <div className="trend-bars">
                  <span className={`trend-sla ${slaClass(item.sla)}`} style={{ width: `${Math.max(4, item.sla * 100)}%` }} />
                </div>
                <div className="trend-result">
                  <strong>{asPercent(item.sla, 1)}</strong>
                  <span>{slaLabel(item.sla)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="panel-heading">
            <div>
              <h2 className="section-title">Pendências e qualidade</h2>
              <p className="muted">Dias ausentes e bloqueios de validação capturados no formulário.</p>
            </div>
            <AlertTriangle size={22} aria-hidden="true" />
          </div>
          <div className="quality-grid">
            <div>
              <span>Dias sem envio</span>
              <strong>{missingDays.length}</strong>
            </div>
            <div>
              <span>Bloqueios registrados</span>
              <strong>{transportadora.qualityLogs.length}</strong>
            </div>
            <div>
              <span>Insucessos</span>
              <strong>{asPercent(failureRate, 1)}</strong>
            </div>
            <div>
              <span>Devoluções</span>
              <strong>{asPercent(returnRate, 1)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="analytics-grid">
        <div className="card heatmap-panel">
          <div className="panel-heading">
            <div>
              <h2 className="section-title">Heatmap UF próprio</h2>
              <p className="muted">SLA por UF dentro da própria operação da transportadora.</p>
            </div>
          </div>
          <div className="uf-strip">
            {ufRows.map((row) => (
              <span className={`heat-cell ${slaClass(row.sla)}`} key={row.uf}>
                {row.uf}
                <strong>{row.sla !== null ? asPercent(row.sla, 0) : "-"}</strong>
                <small>{row.total ? `${row.total} ped.` : "sem volume"}</small>
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="panel-heading">
            <div>
              <h2 className="section-title">Responsáveis de envio</h2>
              <p className="muted">Usuários vinculados e status da entrega de credenciais.</p>
            </div>
            <UsersRound size={22} aria-hidden="true" />
          </div>
          <div className="responsible-list">
            {transportadora.users.length ? (
              transportadora.users.map((user) => (
                <div className="responsible-row" key={user.id}>
                  <div>
                    <strong>{user.nome}</strong>
                    <span>{user.username ?? user.email}</span>
                  </div>
                  <span className={`pill ${user.credentialSentAt ? "ok" : "pending"}`}>
                    {user.credentialSentAt ? "Credencial enviada" : "Credencial pendente"}
                  </span>
                </div>
              ))
            ) : (
              <div className="status-ok neutral">
                <UsersRound size={20} />
                <span>Nenhum usuário vinculado a esta transportadora.</span>
              </div>
            )}
          </div>
          {credentialPendingUsers.length ? (
            <p className="metric-note">{credentialPendingUsers.length} conta(s) ainda precisam de confirmação de entrega.</p>
          ) : null}
        </div>
      </section>

      <section className="analytics-grid">
        <div className="card">
          <div className="panel-heading">
            <div>
              <h2 className="section-title">Observações recentes</h2>
              <p className="muted">Anotações dos últimos reports enviados.</p>
            </div>
            <ClipboardList size={22} aria-hidden="true" />
          </div>
          {recentNotes.length ? (
            <div className="notes-list">
              {recentNotes.map((submission) => (
                <div className="note-row" key={submission.id}>
                  <strong>{formatBrazilianDate(submission.dataReport)}</strong>
                  <p>{submission.observacoes}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="status-ok">
              <ClipboardList size={20} />
              <span>Sem observações registradas nos reports recentes.</span>
            </div>
          )}
        </div>

        <div className="card">
          <div className="panel-heading">
            <div>
              <h2 className="section-title">Bloqueios recentes</h2>
              <p className="muted">Tentativas bloqueadas por inconsistência no formulário.</p>
            </div>
          </div>
          {transportadora.qualityLogs.length ? (
            <div className="notes-list">
              {transportadora.qualityLogs.map((log) => (
                <div className="note-row" key={log.id}>
                  <strong>{formatBrazilianDate(log.createdAt)}</strong>
                  <p>{parseReasons(log.reasons)}</p>
                  <span className="muted">{log.user?.nome ?? "Usuário não identificado"} · {formatBrazilianDate(log.dataReport)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="status-ok">
              <ClipboardList size={20} />
              <span>Nenhum bloqueio registrado no período.</span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
