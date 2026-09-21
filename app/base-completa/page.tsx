import { requireInternalUser, isInternalAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { KpiCarousel } from "@/components/pedidos/KpiCarousel";
import { BasePanel } from "@/components/pedidos/BasePanel";
import { HelpPanel } from "@/components/pedidos/HelpPanel";
import { PeriodoFilter } from "@/components/pedidos/PeriodoFilter";
import { pedidoParaLinhaTabela, type PedidoParaTabela } from "@/lib/pedidos-table-row";
import { summarizeFillStatus } from "@/lib/pedidos-kpis";
import { montarDadosKpiCarousel } from "@/lib/pedidos-kpi-carousel";
import { uploadBaseOriginalInterna, uploadDevolucaoInterna } from "@/app/base-completa/actions";
import { getBaseCompletaWindowWhere } from "@/lib/base-completa-window";
import { obterExportacaoPronta, EXPORTACAO_ADMIN_CHAVE } from "@/lib/exportacoes-download";
import { DownloadAdminZip } from "@/app/base-completa/DownloadAdminZip";
import "@/components/pedidos/minha-base.css";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function BaseCompletaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // Único ponto de divergência de segurança: perfil interno em vez de
  // transportadora, e nenhum transportadoraId vindo da sessão para
  // restringir o escopo - o resto da página é literalmente a mesma
  // estrutura de /portal/minha-base/page.tsx.
  const user = await requireInternalUser("/base-completa");
  const raw = await searchParams;

  // Input de bases (upload de Base Original e devolução em nome de uma
  // transportadora escolhida) só é OFERECIDO na interface para
  // internal_admin - internal_viewer continua com acesso de leitura,
  // igual já era antes desta mudança. A garantia de verdade está no
  // servidor: as duas Server Actions chamam requireInternalAdmin() por
  // conta própria (app/base-completa/actions.ts), então mesmo que
  // alguém forjasse a chamada por fora desta página, ela seria recusada.
  const podeGerenciarBases = isInternalAdmin(user.role);
  const exportacaoAdmin = podeGerenciarBases
    ? await obterExportacaoPronta(EXPORTACAO_ADMIN_CHAVE)
    : null;

  // Filtro OPCIONAL de transportadora - só existe aqui (Minha Base não
  // precisa, a transportadora já vem da sessão). Sem seleção = todas.
  const transportadoraIdFiltro = raw.transportadoraId?.trim() || null;
  const janelaBaseCompleta = getBaseCompletaWindowWhere();

  // Mesma função usada por Minha Base/Início - única fonte de verdade dos
  // Big Numbers. transportadoraIdFiltro null = consolidado de todas.
  const [transportadoras, dadosKpi] = await Promise.all([
    prisma.transportadora.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    montarDadosKpiCarousel(transportadoraIdFiltro, raw, janelaBaseCompleta),
  ]);

  // Mesma estratégia de consulta/paginação de Minha Base: sem "Carregar
  // mais", take:1000 fixo (o filtro de transportadora + a busca da
  // PedidosTable permitem estreitar quando necessário) - nunca carrega
  // centenas de milhares de linhas no navegador. Única diferença de
  // dados: SEM dataEntregaOrigem:null (finalizados aparecem) e SEM
  // transportadoraId obrigatório (só filtra se o ADM escolher uma).
  const where = {
    ...janelaBaseCompleta,
    ...(transportadoraIdFiltro ? { transportadoraId: transportadoraIdFiltro } : {}),
  };

  const paginaRaw = Number(raw.pagina ?? "1");
  const pagina = Number.isFinite(paginaRaw) && paginaRaw > 0 ? Math.floor(paginaRaw) : 1;
  const filtroPreenchimento = raw.preenchimento === "preenchidas" ? "preenchidas" : "todas";
  const porPagina = 1000;

  const whereAlgumPreenchido = {
    OR: [
      { dataColetaProcessamento: { not: null } },
      { dataPrevisao: { not: null } },
      { prazoEntregaDiasUteis: { not: null } },
      { dataEntrega: { not: null } },
      { statusAtual: { not: null } },
      { ocorrencia: { not: null } },
      { motivoDevolucao: { not: null } },
      { slaStatus: { not: null } },
      { justificativaAtraso: { not: null } },
      { novaDataPrevisao: { not: null } },
      { dataResolucaoDevolucao: { not: null } },
    ],
  };

  const whereTodosPreenchidos = {
    AND: [
      { dataColetaProcessamento: { not: null } },
      { dataPrevisao: { not: null } },
      { prazoEntregaDiasUteis: { not: null } },
      { dataEntrega: { not: null } },
      { statusAtual: { not: null } },
      { ocorrencia: { not: null } },
      { motivoDevolucao: { not: null } },
      { slaStatus: { not: null } },
      { justificativaAtraso: { not: null } },
      { novaDataPrevisao: { not: null } },
      { dataResolucaoDevolucao: { not: null } },
    ],
  };

  const [totalBase, totalPreenchidos, totalRespondidos] = await Promise.all([
    prisma.pedido.count({ where }),
    prisma.pedido.count({
      where: {
        AND: [where, whereAlgumPreenchido],
      },
    }),
    prisma.pedido.count({
      where: {
        AND: [where, whereTodosPreenchidos],
      },
    }),
  ]);

  const preenchimento = {
    pending: totalBase - totalPreenchidos,
    partial: totalPreenchidos - totalRespondidos,
    done: totalRespondidos,
  };

  const totalPaginas = Math.max(1, Math.ceil(totalBase / porPagina));

  const datasDisponiveisDb = await prisma.pedido.findMany({
    where: {
      AND: [
        where,
        {
          previsaoEntregaTransportadoraOrigem: {
            not: null,
          },
        },
      ],
    },
    select: {
      previsaoEntregaTransportadoraOrigem: true,
    },
    distinct: ["previsaoEntregaTransportadoraOrigem"],
    orderBy: {
      previsaoEntregaTransportadoraOrigem: "asc",
    },
  });

  const datasDisponiveis = Array.from(
    new Set(
      datasDisponiveisDb
        .map((pedido) => pedido.previsaoEntregaTransportadoraOrigem)
        .filter((data): data is Date => data instanceof Date)
        .map((data) => {
          const ano = data.getFullYear();
          const mes = String(data.getMonth() + 1).padStart(2, "0");
          const dia = String(data.getDate()).padStart(2, "0");
          return `${ano}-${mes}-${dia}`;
        }),
    ),
  ).sort();

  const pedidosDb =
    filtroPreenchimento === "preenchidas"
      ? await prisma.pedido.findMany({
          where: {
            AND: [where, whereAlgumPreenchido],
          },
          include: { transportadora: { select: { nome: true } } },
          orderBy: { dataCriacaoPedido: "desc" },
        })
      : await prisma.pedido.findMany({
          where,
          include: { transportadora: { select: { nome: true } } },
          orderBy: { dataCriacaoPedido: "desc" },
          skip: (pagina - 1) * porPagina,
          take: porPagina,
        });

  const linhas = (pedidosDb as unknown as PedidoParaTabela[]).map(pedidoParaLinhaTabela);

  const montarHref = (novaPagina: number, novoFiltro: "todas" | "preenchidas") => {
    const params = new URLSearchParams();

    if (raw.de) params.set("de", raw.de);
    if (raw.ate) params.set("ate", raw.ate);
    if (transportadoraIdFiltro) params.set("transportadoraId", transportadoraIdFiltro);

    if (novoFiltro === "preenchidas") {
      params.set("preenchimento", "preenchidas");
    } else {
      params.set("pagina", String(novaPagina));
    }

    return `/base-completa?${params.toString()}`;
  };

  const downloadHref = transportadoraIdFiltro
    ? `/base-completa/download?transportadoraId=${transportadoraIdFiltro}`
    : undefined;

  return (
    <div className="mb-html">
      <main className="page">
        <div className="page-header">
          <div>
            <h1>Base Completa</h1>
            <p>
              Visão interna dos pedidos dos últimos 45 dias pela Data Criação, de todas as transportadoras, incluindo finalizados. Use o filtro de
              transportadora para restringir a uma específica.
            </p>
          </div>
        </div>

        <PeriodoFilter
          action="/base-completa"
          de={dadosKpi.periodo.de}
          ate={dadosKpi.periodo.ate}
          transportadoras={transportadoras}
          transportadoraId={transportadoraIdFiltro ?? undefined}
                    datasDisponiveis={datasDisponiveis}
          />

        <section className="grid">
          <KpiCarousel {...dadosKpi.props} />

          <BasePanel
            linhas={linhas}
            lastBaseUpdateLabel={dadosKpi.ultimaCargaLabel}
            hasBaseUpdate={dadosKpi.hasBaseUpdate}
            fillPending={preenchimento.pending}
            fillPartial={preenchimento.partial}
            fillDone={preenchimento.done}
            serverFillFilter={filtroPreenchimento}
            totalRows={filtroPreenchimento === "preenchidas" ? totalPreenchidos : totalBase}
            page={pagina}
            totalPages={totalPaginas}
            previousHref={pagina > 1 ? montarHref(pagina - 1, "todas") : undefined}
            nextHref={pagina < totalPaginas ? montarHref(pagina + 1, "todas") : undefined}
            allHref={montarHref(1, "todas")}
            filledHref={montarHref(1, "preenchidas")}
              toolbarDateFilter={
                <PeriodoFilter
                  action="/base-completa"
                  de={dadosKpi.periodo.de}
                  ate={dadosKpi.periodo.ate}
                  transportadoras={transportadoras}
                  transportadoraId={transportadoraIdFiltro ?? undefined}
                  datasDisponiveis={datasDisponiveis}
                  hiddenFields={{
                    preenchimento:
                      filtroPreenchimento === "preenchidas"
                        ? "preenchidas"
                        : "",
                  }}
                  compact
                />
              }
              adminDownloadControl={!transportadoraIdFiltro && podeGerenciarBases && exportacaoAdmin?.nomeArquivo.endsWith(".xlsx") ? <DownloadAdminZip /> : undefined}
              downloadHref={downloadHref}
            downloadLabel="Baixar Base Completa"
            backendNote="Visão interna - últimos 45 dias pela Data Criação, todas as transportadoras, incluindo pedidos finalizados."
            uploadAction={podeGerenciarBases ? uploadDevolucaoInterna : undefined}
            uploadOriginalAction={podeGerenciarBases ? uploadBaseOriginalInterna : undefined}
            transportadorasParaSelecao={podeGerenciarBases ? transportadoras : undefined}
          />
        </section>
      </main>

      <HelpPanel />
    </div>
  );
}
