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
import "./goblack-v10.css";

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
    <div className="mb-html goblack-v10">
      <main className="page">
        <div className="goblack-mission-strip">
          <span className="goblack-live-dot" />
          <strong>MISSÃO GOBLACK</strong>
          <span className="goblack-mission-separator">/</span>
          <span className="goblack-mission-text">
            CENTRO DE COMANDO 2026 · VISIBILIDADE TOTAL · TRANSPORTES EM MOVIMENTO
          </span>
          <span className="goblack-energy">⚡ ENERGIA</span>
        </div>

        <header className="goblack-hero">
          <div className="goblack-hero-glow" aria-hidden="true" />
          <div className="goblack-radar" aria-hidden="true">
            <div className="goblack-radar-sweep" />
            <div className="goblack-radar-center" />
          </div>

          <div className="goblack-hero-copy">
            <span className="goblack-eyebrow">
              CONTROLE DE DADOS · TRANSPORTES
            </span>
            <h1>
              Base Completa<span>.</span>
            </h1>
            <p>
              Sua operação em alta velocidade. Dados no radar, decisões em tempo real e transportadoras conectadas em uma única central.
            </p>
          </div>

          <span className="goblack-hero-tag">
            ⚡ GOBLACK 2026 · ON FIRE
          </span>
          <span className="goblack-truck-note">
            OPERAÇÃO SEM FREIO
          </span>

          <div className="goblack-road" aria-hidden="true">
            <div className="goblack-truck">
              <span className="goblack-fire-trail" />
              <span className="goblack-fire-sparks">✦ ✧ ✦</span>
              <svg viewBox="0 0 160 70" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="14" width="91" height="38" rx="5" fill="#e53649" />
                <rect x="12" y="20" width="77" height="26" rx="2" fill="#bd2237" />
                <path d="M98 25h25l18 18v10H98Z" fill="#f3f4f7" />
                <path d="M108 29h14l11 12h-25Z" fill="#1c3047" />
                <path d="M100 45h40v8h-40Z" fill="#e53649" />
                <rect x="135" y="45" width="8" height="4" rx="1" fill="#ffd58b" />
                <rect x="7" y="47" width="133" height="6" rx="2" fill="#a6172c" />
                <text x="48" y="36" textAnchor="middle" fill="#fff" fontFamily="Arial,sans-serif" fontSize="10" fontWeight="900" textLength="69" lengthAdjust="spacingAndGlyphs">GOBLACK</text>
                <g className="goblack-svg-wheel">
                  <circle cx="35" cy="55" r="10" fill="#15171e" />
                  <circle cx="35" cy="55" r="5" fill="#cdd2dc" />
                </g>
                <g className="goblack-svg-wheel">
                  <circle cx="116" cy="55" r="10" fill="#15171e" />
                  <circle cx="116" cy="55" r="5" fill="#cdd2dc" />
                </g>
              </svg>
            </div>
          </div>
        </header>
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


