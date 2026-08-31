import Link from "next/link";
import { FileBarChart, History, Package } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { requireCarrierUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBrazilianDate } from "@/lib/dates";
import { KpiCarousel } from "@/components/pedidos/KpiCarousel";
import { PeriodoFilter } from "@/components/pedidos/PeriodoFilter";
import { montarDadosKpiCarousel } from "@/lib/pedidos-kpi-carousel";

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireCarrierUser("/portal");
  const transportadoraId = user.transportadoraId!;
  const raw = await searchParams;

  const transportadora = await prisma.transportadora.findUnique({
    where: { id: transportadoraId },
    include: {
      submissions: {
        orderBy: { dataReport: "desc" },
        take: 8,
        include: { previousDayMetrics: true },
      },
    },
  });

  if (!transportadora) {
    return (
      <main className="shell">
        <EmptyState
          title="Acesso sem transportadora vinculada"
          description="Seu usuário existe, mas ainda não está associado a uma transportadora ativa."
        />
      </main>
    );
  }

  // Mesma função usada por /portal/minha-base - única fonte de verdade dos
  // Big Numbers, sem duplicar consulta/lógica entre as duas telas.
  const dadosKpi = await montarDadosKpiCarousel(transportadoraId, raw);

  return (
    <main className="shell">
      <div className="page-title">
        <div>
          <h1>Portal da transportadora</h1>
          <p className="muted">{transportadora.nome}</p>
        </div>
      </div>

      <PeriodoFilter action="/portal" de={dadosKpi.periodo.de} ate={dadosKpi.periodo.ate} />

      <section className="card" style={{ marginBottom: 18 }}>
        <h2 className="section-title">Números</h2>
        <KpiCarousel {...dadosKpi.props} />
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="panel-heading">
          <div>
            <h2 className="section-title">Rotina diária</h2>
          </div>
        </div>
        <div className="actions" style={{ marginTop: 14 }}>
          <Link className="btn secondary" href="/portal/minha-base">
            <Package size={16} /> Minha Base
          </Link>
          <Link className="btn secondary" href={`/historico/${transportadora.id}`}>
            <History size={16} /> Ver histórico
          </Link>
        </div>
      </section>

      <section className="card">
        <div className="panel-heading">
          <div>
            <h2 className="section-title">Histórico recente</h2>
            <p className="muted">Últimos relatórios enviados ou salvos pela transportadora.</p>
          </div>
        </div>

        {!transportadora.submissions.length ? (
          <EmptyState
            title="Nenhum relatório enviado"
            description="Quando o primeiro relatório for salvo ou enviado, ele aparecerá aqui."
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
                {transportadora.submissions.map((submission: (typeof transportadora.submissions)[number]) => (
                  <tr key={submission.id}>
                    <td>{formatBrazilianDate(submission.dataReport)}</td>
                    <td>
                      <span className={`pill ${submission.status === "draft" ? "pending" : "ok"}`}>
                        {submission.status === "draft" ? "Rascunho" : "Enviado"}
                      </span>
                    </td>
                    <td>{submission.previousDayMetrics?.totalPedidos ?? "-"}</td>
                    <td>{submission.submittedAt ? formatBrazilianDate(submission.submittedAt) : "-"}</td>
                    <td>
                      <Link className="btn secondary" href={`/reports/${transportadora.id}/${dateKey(submission.dataReport)}`}>
                        <FileBarChart size={16} /> Relatório
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
