import { medirEtapa } from "@/lib/diagnostico-tempo";
import Link from "next/link";
import { ClipboardList, Layers3, Plus } from "lucide-react";
import { isInternalAdmin, requireInternalUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfLocalDay } from "@/lib/dates";

export const dynamic = "force-dynamic";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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

  const today = startOfLocalDay(new Date());
  const tomorrow = addDays(today, 1);

  const transportadoras = await medirEtapa("admin:relatorios", () => prisma.transportadora.findMany({
    include: {
      submissions: {
        where: { dataReport: { gte: today, lt: tomorrow } },
        orderBy: { dataReport: "desc" },
      },
    },
    orderBy: { nome: "asc" },
  }));

  const filteredTransportadoras = transportadoras.filter((item) => {
    const matchesOrigem = origemFilter === "todos" || item.origem === origemFilter;
    const matchesTransportadora = !transportadoraFilter || item.id === transportadoraFilter;
    return matchesOrigem && matchesTransportadora;
  });
  const transportadorasOcultasAdmin = new Set([
    "arquivo inativo transportes",
    "bh transportes",
    "litoral cargo",
    "nordeste rapido",
    "rota forte log",
    "transportadora demo",
    "transportes exemplo ltda",
  ]);

  const normalizarNomeTransportadora = (nome: string) =>
    nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

  const activeTransportadoras = filteredTransportadoras.filter(
    (item) => item.ativo && !transportadorasOcultasAdmin.has(normalizarNomeTransportadora(item.nome)),
  );
  const relatoriosHoje = activeTransportadoras.filter((transportadora) =>
    transportadora.submissions.some((submission) => submission.dataReport >= today && submission.dataReport < tomorrow),
  ).length;
  const ativas = activeTransportadoras.length;
  const pendentes = Math.max(0, ativas - relatoriosHoje);

  return (
    <main className="shell admin-dashboard">
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
                .filter(
                  (item) =>
                    item.ativo &&
                    !transportadorasOcultasAdmin.has(normalizarNomeTransportadora(item.nome)) &&
                    (origemFilter === "todos" || item.origem === origemFilter),
                )
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
          <div className="metric-label">Relatórios enviados hoje</div>
          <div className="metric-value">{relatoriosHoje}</div>
        </div>
        <div className="card metric-card orange">
          <div className="metric-label">Relatórios pendentes hoje</div>
          <div className="metric-value">{pendentes}</div>
        </div>
      </section>

    </main>
  );
}
