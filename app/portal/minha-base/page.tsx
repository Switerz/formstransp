import { requireCarrierUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { KpiCarousel } from "@/components/pedidos/KpiCarousel";
import { BasePanel } from "@/components/pedidos/BasePanel";
import { HelpPanel } from "@/components/pedidos/HelpPanel";
import { PeriodoFilter } from "@/components/pedidos/PeriodoFilter";
import {
  pedidoParaLinhaTabela,
  type PedidoParaTabela,
} from "@/lib/pedidos-table-row";
import { obterResumoPreenchimentoCompleto } from "@/lib/pedidos-preenchimento";
import { montarDadosKpiCarousel } from "@/lib/pedidos-kpi-carousel";
import {
  uploadDevolucaoTransportadora,
  type DevolucaoResumo,
} from "@/app/portal/minha-base/actions";
import "@/components/pedidos/minha-base.css";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_TABLE_ROWS = 500;

export default async function MinhaBasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireCarrierUser("/portal/minha-base");
  const transportadoraId = user.transportadoraId!;
  const raw = await searchParams;

  const periodoDisponivel = await prisma.pedido.aggregate({
    where: {
      transportadoraId,
      dataEntregaOrigem: null,
      previsaoEntregaTransportadoraOrigem: {
        not: null,
      },
    },
    _min: {
      previsaoEntregaTransportadoraOrigem: true,
    },
    _max: {
      previsaoEntregaTransportadoraOrigem: true,
    },
  });

  const dataParaIso = (data: Date | null) => {
    if (!data) return undefined;

    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
  };

  const parametrosComPeriodoPadrao = {
    ...raw,
    de:
      raw.de ??
      dataParaIso(
        periodoDisponivel._min.previsaoEntregaTransportadoraOrigem,
      ),
    ate:
      raw.ate ??
      dataParaIso(
        periodoDisponivel._max.previsaoEntregaTransportadoraOrigem,
      ),
  };

  const dadosKpi = await montarDadosKpiCarousel(
    transportadoraId,
    parametrosComPeriodoPadrao,
  );

  const [ultimaDevolucao, pedidosDb, preenchimento] = await Promise.all([
    prisma.automationLog.findFirst({
      where: {
        transportadoraId,
        tipo: "pedidos_devolucao",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
        payload: true,
      },
    }),

    // A tela exibe somente uma prévia dos pedidos mais recentes.
    // A base maior continua disponível pelo botão de download.
    prisma.pedido.findMany({
      where: {
        transportadoraId,
        dataEntregaOrigem: null,
      },
      include: {
        transportadora: {
          select: {
            nome: true,
          },
        },
      },
      orderBy: {
        dataCriacaoPedido: "desc",
      },
      take: MAX_TABLE_ROWS,
    }),
    obterResumoPreenchimentoCompleto(transportadoraId),
  ]);

  let resumoPersistido: DevolucaoResumo | null = null;

  if (ultimaDevolucao?.payload) {
    try {
      resumoPersistido = JSON.parse(
        ultimaDevolucao.payload,
      ) as DevolucaoResumo;
    } catch {
      resumoPersistido = null;
    }
  }

  const formatarDataSaoPaulo = (data: Date) =>
    data.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });

  const ultimaDevolucaoLabel = ultimaDevolucao
    ? ultimaDevolucao.createdAt.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Nenhuma devolução recebida";

  const hasDevolucaoHoje = ultimaDevolucao
    ? formatarDataSaoPaulo(ultimaDevolucao.createdAt) ===
      formatarDataSaoPaulo(new Date())
    : false;

  const pedidosTabela =
    pedidosDb as unknown as PedidoParaTabela[];

  const datasDisponiveis = Array.from(
    new Set(
      pedidosTabela
        .map(
          (pedido) =>
            pedido.previsaoEntregaTransportadoraOrigem,
        )
        .filter(
          (data): data is Date => data instanceof Date,
        )
        .map((data) => {
          const ano = data.getFullYear();
          const mes = String(data.getMonth() + 1).padStart(
            2,
            "0",
          );
          const dia = String(data.getDate()).padStart(2, "0");

          return `${ano}-${mes}-${dia}`;
        }),
    ),
  ).sort();

  const todasAsLinhas = pedidosTabela.map(
    pedidoParaLinhaTabela,
  );

  const filtroPreenchimento =
    raw.preenchimento === "preenchidas"
      ? "preenchidas"
      : "todas";

  const linhas =
    filtroPreenchimento === "preenchidas"
      ? todasAsLinhas.filter(
          (linha) => linha.fillStatus !== "pending",
        )
      : todasAsLinhas;

  const criarHrefPreenchimento = (
    valor: "todas" | "preenchidas",
  ) => {
    const parametros = new URLSearchParams();

    parametros.set("de", dadosKpi.periodo.de);
    parametros.set("ate", dadosKpi.periodo.ate);

    if (valor === "preenchidas") {
      parametros.set("preenchimento", "preenchidas");
    }

    return `/portal/minha-base?${parametros.toString()}`;
  };

  const allHref = criarHrefPreenchimento("todas");
  const filledHref = criarHrefPreenchimento("preenchidas");

  return (
    <div className="mb-html">
      <main className="page">
        <div className="page-header">
          <div>
            <h1>
              Envio, atualização e conferência de bases
            </h1>

            <p>
              A Intelipost disponibiliza a base de origem
              automaticamente, você faz o download, atualiza as
              informações operacionais e devolve a nova versão na
              mesma tela. O portal mantém as duas visões e destaca
              o que mudou.
            </p>
          </div>
        </div>

        <PeriodoFilter
          action="/portal/minha-base"
          de={dadosKpi.periodo.de}
          ate={dadosKpi.periodo.ate}
          datasDisponiveis={datasDisponiveis}
        />

        <section className="grid">
          <KpiCarousel {...dadosKpi.props} />

          <BasePanel
            linhas={linhas}
            lastBaseUpdateLabel={dadosKpi.ultimaCargaLabel}
            hasBaseUpdate={dadosKpi.hasBaseUpdate}
            initialResumo={resumoPersistido}
            lastDevolucaoLabel={ultimaDevolucaoLabel}
            hasDevolucaoHoje={hasDevolucaoHoje}
            fillPending={preenchimento.pending}
            fillPartial={preenchimento.partial}
            fillDone={preenchimento.done}
            serverFillFilter={filtroPreenchimento}
            allHref={allHref}
            filledHref={filledHref}
            toolbarDateFilter={
              <PeriodoFilter
                key="filtro-combinado-minha-base"
                action="/portal/minha-base"
                de={dadosKpi.periodo.de}
                ate={dadosKpi.periodo.ate}
                datasDisponiveis={datasDisponiveis}
                hiddenFields={{
                  preenchimento: filtroPreenchimento,
                }}
                fillFilter={filtroPreenchimento}
                allHref={allHref}
                filledHref={filledHref}
                compact
              />
            }
            downloadHref="/portal/minha-base/download"
            uploadAction={uploadDevolucaoTransportadora}
          />
        </section>
      </main>

      <HelpPanel />
    </div>
  );
}
