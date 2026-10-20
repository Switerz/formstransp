import { medirEtapa } from "@/lib/diagnostico-tempo";
import Link from "next/link";
import { ClipboardList, Layers3, Plus } from "lucide-react";
import { isInternalAdmin, requireInternalUser } from "@/lib/auth";
import { listRemoteTransportadoras } from "@/lib/godeploy-db";
import { startOfLocalDay } from "@/lib/dates";
import { carregarResumosBasesDrive } from "@/lib/bases-drive";

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

export const dynamic = "force-dynamic";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ origem?: string; transportadoraId?: string }>;
}) {
  const [currentUser, filters] = await Promise.all([medirEtapa("admin:autenticacao", () => requireInternalUser("/")), searchParams]);
  const canManage = isInternalAdmin(currentUser.role);
  const origemFilter = filters.origem === "demo" || filters.origem === "todos" ? filters.origem : "real";
  const transportadoraFilter = filters.transportadoraId ?? "";

  const today = startOfLocalDay(new Date());
  const tomorrow = addDays(today, 1);

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
  const activeTransportadoras = filteredTransportadoras.filter(
    (item) =>
      item.ativo &&
      !transportadorasOcultasAdmin.has(normalizarNomeTransportadora(item.nome)),
  );

  const resumosDrive = await carregarResumosBasesDrive(
    activeTransportadoras.map((transportadora) => transportadora.id),
  );

  const basesAtualizadas = activeTransportadoras
    .map((transportadora) => {
      const base = resumosDrive.get(transportadora.id);
      if (!base) return null;

      const respondidos = base.partial + base.done;
      const sla =
        base.total > 0
          ? (base.slaNoPrazo / base.total) * 100
          : 0;

      return {
        id: transportadora.id,
        nome: transportadora.nome,
        total: base.total,
        pendentes: base.pending,
        respondidos,
        sla,
        slaNoPrazo: base.slaNoPrazo,
        ultimaDevolucao: base.ultimaDevolucao,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const resumoBases = basesAtualizadas.reduce(
    (acc, item) => {
      acc.total += item.total;
      acc.pendentes += item.pendentes;
      acc.respondidos += item.respondidos;
      return acc;
    },
    { total: 0, pendentes: 0, respondidos: 0 },
  );

  const slaNoPrazoGeral = basesAtualizadas.reduce(
    (total, item) => total + item.slaNoPrazo,
    0,
  );
  const slaGeral =
    resumoBases.total > 0
      ? (slaNoPrazoGeral / resumoBases.total) * 100
      : 0;

  const relatoriosHoje = basesAtualizadas.filter((item) => {
    if (!item.ultimaDevolucao) return false;
    const devolucao = new Date(item.ultimaDevolucao);
    return devolucao >= today && devolucao < tomorrow;
  }).length;

  const ativas = activeTransportadoras.length;
  const pendentes = Math.max(0, ativas - relatoriosHoje);

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
                .filter(
                  (item) =>
                    (origemFilter === "todos" || item.origem === origemFilter) &&
                    item.ativo &&
                    !transportadorasOcultasAdmin.has(normalizarNomeTransportadora(item.nome)),
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
          <div className="metric-label">RelatÃ³rios enviados hoje</div>
          <div className="metric-value">{relatoriosHoje}</div>
        </div>
        <div className="card metric-card orange">
          <div className="metric-label">RelatÃ³rios pendentes hoje</div>
          <div className="metric-value">{pendentes}</div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="panel-heading">
          <div>
            <h2 className="section-title">Resumo das bases atualizadas</h2>
            <p className="muted">
              Transportadoras com base oficial publicada no Drive.
            </p>
          </div>
        </div>

        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="risk-table">
            <thead>
              <tr>
                <th>Transportadora</th>
                <th>Total da base</th>
                <th>Pendentes</th>
                <th>Respondidos</th>
                <th>SLA</th>
              </tr>
            </thead>
            <tbody>
              {basesAtualizadas.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.nome}</strong></td>
                  <td>{item.total.toLocaleString("pt-BR")}</td>
                  <td>{item.pendentes.toLocaleString("pt-BR")}</td>
                  <td>{item.respondidos.toLocaleString("pt-BR")}</td>
                  <td>{item.sla.toFixed(2).replace(".", ",")}%</td>
                </tr>
              ))}
              <tr>
                <td><strong>TOTAL GERAL</strong></td>
                <td><strong>{resumoBases.total.toLocaleString("pt-BR")}</strong></td>
                <td><strong>{resumoBases.pendentes.toLocaleString("pt-BR")}</strong></td>
                <td><strong>{resumoBases.respondidos.toLocaleString("pt-BR")}</strong></td>
                <td><strong>{slaGeral.toFixed(2).replace(".", ",")}%</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

    </main>
  );
}
