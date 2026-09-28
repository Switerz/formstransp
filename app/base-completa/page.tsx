import { medirEtapa } from "@/lib/diagnostico-tempo";
import {
  requireInternalUser,
  isInternalAdmin,
} from "@/lib/auth";
import { listRemoteTransportadoras } from "@/lib/godeploy-db";
import { carregarBasesDrive } from "@/lib/bases-drive";
import { BasePanel } from "@/components/pedidos/BasePanel";
import {
  KpiCarousel,
  type KpiCard,
} from "@/components/pedidos/KpiCarousel";
import { HelpPanel } from "@/components/pedidos/HelpPanel";
import { PeriodoFilter } from "@/components/pedidos/PeriodoFilter";
import {
  uploadBaseOriginalInterna,
  uploadDevolucaoInterna,
} from "@/app/base-completa/actions";
import "@/components/pedidos/minha-base.css";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function card(
  icon: string,
  label: string,
  value: string,
  hint: string,
): KpiCard {
  return { icon, label, value, hint };
}

export default async function BaseCompletaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await medirEtapa(
    "base:autenticacao",
    () => requireInternalUser("/base-completa"),
  );

  const raw = await searchParams;
  const podeGerenciarBases = isInternalAdmin(user.role);

  const transportadoras = await medirEtapa(
    "base:transportadoras",
    () => listRemoteTransportadoras(),
  );

  const transportadoraIdFiltro =
    raw.transportadoraId?.trim() || null;

  const filtroPreenchimento =
    raw.preenchimento === "preenchidas"
      ? "preenchidas"
      : "todas";

  const transportadorasFiltro = transportadoras.map(
    (transportadora) => ({
      id: transportadora.id,
      nome: transportadora.nome,
    }),
  );

  const base = await medirEtapa(
    "base:drive-xlsx",
    () =>
      carregarBasesDrive({
        transportadoraId: transportadoraIdFiltro,
        somentePreenchidas:
          filtroPreenchimento === "preenchidas",
        limiteLinhas: 500,
      }),
  );

  const montarHref = (
    novoFiltro: "todas" | "preenchidas",
  ) => {
    const params = new URLSearchParams();

    if (raw.de) params.set("de", raw.de);
    if (raw.ate) params.set("ate", raw.ate);

    if (transportadoraIdFiltro) {
      params.set(
        "transportadoraId",
        transportadoraIdFiltro,
      );
    }

    if (novoFiltro === "preenchidas") {
      params.set("preenchimento", "preenchidas");
    }

    return `/base-completa?${params.toString()}`;
  };

  const downloadHref = transportadoraIdFiltro
    ? `/base-completa/download?transportadoraId=${encodeURIComponent(
        transportadoraIdFiltro,
      )}`
    : undefined;

  const respondidos = base.partial + base.done;

  const percentualRespondido =
    base.total > 0
      ? (respondidos / base.total) * 100
      : 0;

  const totalSla =
    base.slaNoPrazo + base.slaAtrasado;

  const percentualSla =
    totalSla > 0
      ? (base.slaNoPrazo / totalSla) * 100
      : 0;

  const semDado = "Sem dado disponível no XLSX atual";

  const kpis = {
    slaAjusteTransporte: card(
      "⏱️",
      "SLA ajuste transporte",
      totalSla > 0
        ? `${percentualSla.toFixed(1)}%`
        : "—",
      totalSla > 0
        ? `${base.slaNoPrazo.toLocaleString("pt-BR")} no prazo`
        : semDado,
    ),
    slaTransporte: card(
      "🚚",
      "SLA transporte",
      totalSla > 0
        ? `${percentualSla.toFixed(1)}%`
        : "—",
      totalSla > 0
        ? `${base.slaAtrasado.toLocaleString("pt-BR")} atrasados`
        : semDado,
    ),
    slaCliente: card(
      "👤",
      "SLA cliente",
      "—",
      semDado,
    ),
    taxaInsucesso: card(
      "⚠️",
      "Taxa de insucesso",
      "—",
      semDado,
    ),
    taxaDevolucao: card(
      "↩️",
      "Taxa de devolução",
      "—",
      semDado,
    ),
    pedidosAbertos: card(
      "📦",
      "Pedidos pendentes",
      base.pending.toLocaleString("pt-BR"),
      "Sem preenchimento nos 11 campos operacionais",
    ),
    tratativaCx: card(
      "📝",
      "Em tratativa",
      base.partial.toLocaleString("pt-BR"),
      "Preenchimento parcial",
    ),
    riscoAtraso: card(
      "🚨",
      "Risco de atraso",
      "—",
      semDado,
    ),
    processado: card(
      "✅",
      "Processado",
      `${percentualRespondido.toFixed(1)}%`,
      `${respondidos.toLocaleString("pt-BR")} com alguma resposta`,
    ),
    perdas: card(
      "📉",
      "Perdas",
      "—",
      semDado,
    ),
    totalPedidos: card(
      "📊",
      "Total de pedidos",
      base.total.toLocaleString("pt-BR"),
      `${base.arquivos} base(s) atual(is) do Drive`,
    ),
    abertoTotal: card(
      "📂",
      "Respondidos",
      base.done.toLocaleString("pt-BR"),
      "11 de 11 campos operacionais preenchidos",
    ),
    integridade: card(
      "🧩",
      "Integridade",
      base.total > 0 ? "OK" : "—",
      base.total > 0
        ? "Bases atuais lidas diretamente do Drive"
        : "Nenhuma linha encontrada",
    ),
    status: card(
      "☁️",
      "Status da base",
      base.arquivos > 0 ? "Disponível" : "Sem base",
      `${base.arquivos} arquivo(s) carregado(s)`,
    ),
  };

  const atualizacaoLabel = base.ultimaAtualizacao
    ? `Atualizada em ${new Date(
        base.ultimaAtualizacao,
      ).toLocaleString("pt-BR")}`
    : "Base disponível no Google Drive";

  return (
    <div className="mb-html">
      <main className="page">
        <div className="page-header">
          <div>
            <h1>Base Completa</h1>
            <p>
              Visão interna das bases das transportadoras.
              Os arquivos atuais são mantidos no Google Drive.
            </p>
          </div>
        </div>

        <PeriodoFilter
          action="/base-completa"
          de={raw.de ?? ""}
          ate={raw.ate ?? ""}
          transportadoras={transportadorasFiltro}
          transportadoraId={
            transportadoraIdFiltro ?? undefined
          }
          datasDisponiveis={[]}
        />

        <KpiCarousel {...kpis} />

        <section className="grid">
          <BasePanel
            linhas={base.linhas}
            totalRows={base.total}
            lastBaseUpdateLabel={atualizacaoLabel}
            hasBaseUpdate={base.total > 0}
            initialResumo={null}
            lastDevolucaoLabel="Consulte a base atualizada"
            hasDevolucaoHoje={false}
            fillPending={base.pending}
            fillPartial={base.partial}
            fillDone={base.done}
            serverFillFilter={filtroPreenchimento}
            allHref={montarHref("todas")}
            filledHref={montarHref("preenchidas")}
            toolbarDateFilter={
              <PeriodoFilter
                key="filtro-combinado-base-completa"
                action="/base-completa"
                de={raw.de ?? ""}
                ate={raw.ate ?? ""}
                transportadoras={transportadorasFiltro}
                transportadoraId={
                  transportadoraIdFiltro ?? undefined
                }
                datasDisponiveis={[]}
                hiddenFields={{
                  preenchimento:
                    filtroPreenchimento === "preenchidas"
                      ? "preenchidas"
                      : "",
                }}
                compact
              />
            }
            downloadHref={downloadHref}
            downloadLabel="Baixar base da transportadora"
            backendNote={`Visualização direta das bases XLSX do Google Drive. Exibindo até 500 registros na tabela; indicadores calculados sobre ${base.total.toLocaleString(
              "pt-BR",
            )} registros.`}
            uploadAction={
              podeGerenciarBases
                ? uploadDevolucaoInterna
                : undefined
            }
            uploadOriginalAction={
              podeGerenciarBases
                ? uploadBaseOriginalInterna
                : undefined
            }
            transportadorasParaSelecao={
              podeGerenciarBases
                ? transportadorasFiltro
                : undefined
            }
          />
        </section>
      </main>

      <HelpPanel />
    </div>
  );
}


