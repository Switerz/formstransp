import "./admin-black-friday.css";
import BlackFridayBasesTable from "@/components/BlackFridayBasesTable";
import { medirEtapa } from "@/lib/diagnostico-tempo";

import { Layers3 } from "lucide-react";
import { requireInternalUser } from "@/lib/auth";
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

function formatarDataHora(valor: string | null) {
  if (!valor) return "\u2014";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "\u2014";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

function situacaoBase(
  ultimaDevolucao: string | null,
  pedidosAlterados: number,
  today: Date,
  tomorrow: Date,
) {
  if (!ultimaDevolucao) return "\u{1F534} Pendente";
  const upload = new Date(ultimaDevolucao);
  if (upload < today || upload >= tomorrow) return "\u{1F534} Pendente";
  if (pedidosAlterados === 0) return "\u{1F7E1} Sem altera\u00e7\u00e3o";
  return "\u{1F7E2} Atualizada";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ origem?: string; transportadoraId?: string }>;
}) {
  const [currentUser, filters] = await Promise.all([medirEtapa("admin:autenticacao", () => requireInternalUser("/")), searchParams]);

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
        ultimaAtualizacao: base.ultimaAtualizacao,
        ultimaDevolucao: base.ultimaDevolucao,
        pedidosAlterados: base.pedidosAlterados,
        ultimaAtualizacaoReal: base.ultimaAtualizacaoReal,
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
  const linhasTabela = [
    ...basesAtualizadas.map((item) => ({
      id: item.id,
      nome: item.nome,
      total: item.total.toLocaleString("pt-BR"),
      sla: item.sla.toFixed(2).replace(".", ","),
      atualizacao: formatarDataHora(item.ultimaAtualizacao),
      upload: formatarDataHora(item.ultimaDevolucao),
      situacao: situacaoBase(item.ultimaDevolucao, item.pedidosAlterados, today, tomorrow),
    })),
    {
      id: "__total_geral__",
      nome: "TOTAL GERAL",
      total: resumoBases.total.toLocaleString("pt-BR"),
      sla: slaGeral.toFixed(2).replace(".", ","),
      atualizacao: "--",
      upload: "--",
      situacao: "--",
    },
  ];

  return (
    <main className="shell admin-dashboard">
      <section className="bf-admin-hero">
        <div className="bf-admin-hero-kicker">
          ⚡ BLACK FRIDAY 2026 · OPERAÇÃO TRANSPORTES
        </div>

        <h1>
          Uma operação intensa.
          <br />
          <span>Controle absoluto.</span>
        </h1>

        <p>
          Acompanhe suas transportadoras, monitore as atualizações das bases
          e mantenha a operação sob controle em cada etapa.
        </p>

        <div className="bf-admin-hero-tags">
          <span>◉ {ativas} transportadoras acompanhadas</span>
          <span>▣ Gestão de bases</span>
          <span>⚡ Black Mode</span>
        </div>
      </section>
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

      <section className="grid grid-3 bf-admin-metrics">
        <div className="card metric-card bf-admin-metric">
          <div className="metric-label">Transportadoras ativas</div>
          <div className="metric-value">{ativas}</div>
        </div>
        <div className="card metric-card bf-admin-metric green">
          <div className="metric-label">RelatÃ³rios enviados hoje</div>
          <div className="metric-value">{relatoriosHoje}</div>
        </div>
        <div className="card metric-card bf-admin-metric orange">
          <div className="metric-label">RelatÃ³rios pendentes hoje</div>
          <div className="metric-value">{pendentes}</div>
        </div>
      </section>

      <BlackFridayBasesTable rows={linhasTabela} />

    </main>
  );
}
