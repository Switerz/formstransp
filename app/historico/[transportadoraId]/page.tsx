import Link from "next/link";
import { notFound } from "next/navigation";
import { FileBarChart } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { requireTransportadoraAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBrazilianDate, parseDateInput } from "@/lib/dates";

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Enviado",
  validated: "Validado",
  sent: "Disparado",
};

function pillClassForStatus(status: string) {
  return status === "draft" ? "pending" : "ok";
}

export default async function HistoricoPage({
  params,
  searchParams,
}: {
  params: Promise<{ transportadoraId: string }>;
  searchParams: Promise<{ dataInicio?: string; dataFim?: string; status?: string }>;
}) {
  const { transportadoraId } = await params;
  await requireTransportadoraAccess(transportadoraId, `/historico/${transportadoraId}`);

  const filters = await searchParams;
  const inicioDate = filters.dataInicio ? parseDateInput(filters.dataInicio) : null;
  const fimDate = filters.dataFim ? parseDateInput(filters.dataFim) : null;
  const invertedRange = Boolean(inicioDate && fimDate && inicioDate > fimDate);

  const dateFilter: { gte?: Date; lt?: Date } = {};
  if (inicioDate && !invertedRange) {
    dateFilter.gte = inicioDate;
  }
  if (fimDate && !invertedRange) {
    const end = new Date(fimDate);
    end.setDate(end.getDate() + 1);
    dateFilter.lt = end;
  }

  const transportadora = await prisma.transportadora.findUnique({
    where: { id: transportadoraId },
  });
  if (!transportadora) notFound();

  const hasAnyFilter = Boolean(filters.dataInicio || filters.dataFim || filters.status);

  const submissions = invertedRange
    ? []
    : await prisma.dailyReportSubmission.findMany({
        where: {
          transportadoraId,
          ...(Object.keys(dateFilter).length ? { dataReport: dateFilter } : {}),
          ...(filters.status ? { status: filters.status } : {}),
        },
        orderBy: { dataReport: "desc" },
        include: { previousDayMetrics: true },
      });

  return (
    <main className="shell">
      <div className="page-title">
        <div>
          <h1>Histórico de relatórios</h1>
          <p className="muted">{transportadora.nome}</p>
        </div>
        <Link className="btn secondary" href="/">Voltar</Link>
      </div>

      <form className="card form-grid" style={{ marginBottom: 18 }}>
        <div className="field">
          <label htmlFor="dataInicio">Data inicial</label>
          <input id="dataInicio" name="dataInicio" type="date" defaultValue={filters.dataInicio ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="dataFim">Data final</label>
          <input id="dataFim" name="dataFim" type="date" defaultValue={filters.dataFim ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={filters.status ?? ""}>
            <option value="">Todos</option>
            <option value="draft">Rascunho</option>
            <option value="submitted">Enviado</option>
            <option value="validated">Validado</option>
            <option value="sent">Disparado</option>
          </select>
        </div>
        <div className="actions" style={{ alignItems: "end" }}>
          <button className="btn" type="submit">Filtrar</button>
          <Link className="btn secondary" href={`/historico/${transportadora.id}`}>Limpar</Link>
        </div>
      </form>

      {invertedRange ? (
        <div className="alert" style={{ marginBottom: 16 }}>
          <strong>Intervalo de datas inválido:</strong> a data inicial é depois da data final. Ajuste o filtro.
        </div>
      ) : null}

      <section className="card">
        {!submissions.length ? (
          <EmptyState
            title={hasAnyFilter ? "Nenhum relatório encontrado para este filtro" : "Nenhum relatório encontrado"}
            description={
              hasAnyFilter
                ? "Ajuste ou limpe os filtros para ver o histórico completo desta transportadora."
                : "Aguarde o primeiro envio da transportadora."
            }
            action={{ href: `/historico/${transportadora.id}`, label: "Limpar filtros" }}
          />
        ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Status</th>
                <th>Total de pedidos</th>
                <th>Enviado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((report) => (
                <tr key={report.id}>
                  <td>{formatBrazilianDate(report.dataReport)}</td>
                  <td><span className={`pill ${pillClassForStatus(report.status)}`}>{statusLabels[report.status] ?? report.status}</span></td>
                  <td>{report.previousDayMetrics?.totalPedidos ?? "-"}</td>
                  <td>{report.submittedAt ? formatBrazilianDate(report.submittedAt) : "-"}</td>
                  <td>
                    <Link className="btn secondary" href={`/reports/${transportadora.id}/${report.dataReport.toISOString().slice(0, 10)}`}>
                      <FileBarChart size={16} /> Abrir relatório
                    </Link>
                  </td>
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
