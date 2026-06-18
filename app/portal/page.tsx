import Link from "next/link";
import { CheckCircle2, ClipboardList, FileBarChart, History, Send, XCircle } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { requireCarrierUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBrazilianDate, startOfLocalDay } from "@/lib/dates";

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function PortalPage() {
  const user = await requireCarrierUser("/portal");
  const transportadoraId = user.transportadoraId!;
  const today = startOfLocalDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

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

  const sentToday = transportadora.submissions.some(
    (submission) => submission.dataReport >= today && submission.dataReport < tomorrow,
  );
  const formPath = "/portal/formulario";

  return (
    <main className="shell">
      <div className="page-title">
        <div>
          <h1>Portal da transportadora</h1>
          <p className="muted">{transportadora.nome}</p>
        </div>
        <Link className="btn" href={formPath}>
          <Send size={18} /> Enviar relatório
        </Link>
      </div>

      <section className="grid grid-3">
        <div className={`card metric-card ${sentToday ? "green" : "orange"}`}>
          <div className="metric-label">Status de hoje</div>
          <div className="portal-status">
            {sentToday ? <CheckCircle2 size={28} /> : <XCircle size={28} />}
            <strong>{sentToday ? "Recebido" : "Pendente"}</strong>
          </div>
          <p className="muted">Relatório de {formatBrazilianDate(today)}.</p>
        </div>
        <div className="card metric-card">
          <div className="metric-label">Últimos relatórios</div>
          <div className="metric-value">{transportadora.submissions.length}</div>
          <p className="muted">Registros recentes disponíveis para consulta.</p>
        </div>
        <div className="card metric-card">
          <div className="metric-label">Conta</div>
          <div className="metric-value">{user.nome}</div>
          <p className="muted">Perfil: {user.role === "carrier_admin" ? "admin da transportadora" : "operador"}</p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="panel-heading">
          <div>
            <h2 className="section-title">Rotina diária</h2>
            <p className="muted">Use o formulário para salvar rascunho ou enviar o fechamento do dia.</p>
          </div>
          <span className={`pill ${sentToday ? "ok" : "pending"}`}>{sentToday ? "Hoje enviado" : "Aguardando envio"}</span>
        </div>
        <div className="actions" style={{ marginTop: 14 }}>
          <Link className="btn" href={formPath}>
            <ClipboardList size={16} /> Abrir formulário
          </Link>
          <Link className="btn secondary" href={`/historico/${transportadora.id}`}>
            <History size={16} /> Ver histórico
          </Link>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
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
            action={{ href: formPath, label: "Abrir formulário", icon: <ClipboardList size={16} /> }}
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
                {transportadora.submissions.map((submission) => (
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
