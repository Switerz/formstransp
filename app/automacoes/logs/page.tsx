import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { requireInternalUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBrazilianDate } from "@/lib/dates";

const statusLabels: Record<string, string> = {
  success: "Sucesso",
  pending: "Pendente",
  skipped: "Ignorado",
  error: "Erro",
};

const typeLabels: Record<string, string> = {
  scheduled_report: "Relatório agendado",
  webhook: "Webhook",
  email: "E-mail",
  pdf: "PDF",
  audit: "Auditoria",
};

export default async function AutomationLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tipo?: string }>;
}) {
  await requireInternalUser("/automacoes/logs");

  const filters = await searchParams;
  const logs = await prisma.automationLog.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.tipo ? { tipo: filters.tipo } : {}),
    },
    include: { transportadora: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <main className="shell">
      <div className="page-title">
        <div>
          <h1>Logs da automação</h1>
          <p className="muted">Últimos registros do envio diário, auditorias e exportações.</p>
        </div>
        <Link className="btn secondary" href="/">Voltar</Link>
      </div>

      <form className="card form-grid" style={{ marginBottom: 18 }}>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={filters.status ?? ""}>
            <option value="">Todos</option>
            <option value="success">Sucesso</option>
            <option value="skipped">Pendente ou ignorado</option>
            <option value="error">Erro</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={filters.tipo ?? ""}>
            <option value="">Todos</option>
            <option value="scheduled_report">Relatório agendado</option>
            <option value="webhook">Webhook</option>
            <option value="email">E-mail</option>
            <option value="pdf">PDF</option>
            <option value="audit">Auditoria</option>
          </select>
        </div>
        <div className="actions" style={{ alignItems: "end" }}>
          <button className="btn" type="submit">Filtrar</button>
          <Link className="btn secondary" href="/automacoes/logs">Limpar</Link>
        </div>
      </form>

      <section className="card">
        {!logs.length ? (
          <EmptyState
            title="Nenhum log encontrado"
            description="Quando o envio diário, a auditoria ou a exportação rodarem, os registros aparecem aqui."
            action={{ href: "/automacoes/logs", label: "Limpar filtros" }}
          />
        ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Criado em</th>
                <th>Transportadora</th>
                <th>Data do relatório</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatBrazilianDate(log.createdAt)}</td>
                  <td>{log.transportadora?.nome ?? "-"}</td>
                  <td>{formatBrazilianDate(log.dataReport)}</td>
                  <td>{typeLabels[log.tipo] ?? log.tipo}</td>
                  <td><span className={`pill ${log.status === "success" ? "ok" : "pending"}`}>{statusLabels[log.status] ?? log.status}</span></td>
                  <td>{log.mensagem}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </section>
    </main>
  );
}
