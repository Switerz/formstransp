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

  const percentualSlaBase =
    base.total > 0
      ? ((base.slaNoPrazo / base.total) * 100).toFixed(2).replace(".", ",")
      : "0,00";

  const kpis = {
    total: card(
      "??",
      "Total",
      base.total.toLocaleString("pt-BR"),
      "Total de pedidos da base",
    ),
    pendentes: card(
      "?",
      "Pendentes",
      base.pending.toLocaleString("pt-BR"),
      "Pedidos ainda sem resposta operacional",
    ),
    respondido: card(
      "??",
      "Respondido",
      respondidos.toLocaleString("pt-BR"),
      `${percentualRespondido.toFixed(1).replace(".", ",")}% da base`,
    ),
    slaBaseCompleta: card(
      "??",
      "SLA com Base Completa",
      `${percentualSlaBase}%`,
      `${base.slaNoPrazo.toLocaleString("pt-BR")} pedidos no prazo sobre o total da base`,
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


