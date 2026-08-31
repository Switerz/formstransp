import { requireInternalUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { KpiCarousel } from "@/components/pedidos/KpiCarousel";
import { BasePanel } from "@/components/pedidos/BasePanel";
import { HelpPanel } from "@/components/pedidos/HelpPanel";
import { PeriodoFilter } from "@/components/pedidos/PeriodoFilter";
import { pedidoParaLinhaTabela, type PedidoParaTabela } from "@/lib/pedidos-table-row";
import { summarizeFillStatus } from "@/lib/pedidos-kpis";
import { montarDadosKpiCarousel } from "@/lib/pedidos-kpi-carousel";
import "@/components/pedidos/minha-base.css";

export const dynamic = "force-dynamic";

export default async function BaseCompletaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // Único ponto de divergência de segurança: perfil interno em vez de
  // transportadora, e nenhum transportadoraId vindo da sessão para
  // restringir o escopo - o resto da página é literalmente a mesma
  // estrutura de /portal/minha-base/page.tsx.
  await requireInternalUser("/base-completa");
  const raw = await searchParams;

  // Filtro OPCIONAL de transportadora - só existe aqui (Minha Base não
  // precisa, a transportadora já vem da sessão). Sem seleção = todas.
  const transportadoraIdFiltro = raw.transportadoraId?.trim() || null;

  // Mesma função usada por Minha Base/Início - única fonte de verdade dos
  // Big Numbers. transportadoraIdFiltro null = consolidado de todas.
  const [transportadoras, dadosKpi] = await Promise.all([
    prisma.transportadora.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    montarDadosKpiCarousel(transportadoraIdFiltro, raw),
  ]);

  // Mesma estratégia de consulta/paginação de Minha Base: sem "Carregar
  // mais", take:1000 fixo (o filtro de transportadora + a busca da
  // PedidosTable permitem estreitar quando necessário) - nunca carrega
  // centenas de milhares de linhas no navegador. Única diferença de
  // dados: SEM dataEntregaOrigem:null (finalizados aparecem) e SEM
  // transportadoraId obrigatório (só filtra se o ADM escolher uma).
  const where = transportadoraIdFiltro ? { transportadoraId: transportadoraIdFiltro } : {};

  const pedidosDb = await prisma.pedido.findMany({
    where,
    include: { transportadora: { select: { nome: true } } },
    orderBy: { dataCriacaoPedido: "desc" },
    take: 1000,
  });

  const linhas = (pedidosDb as unknown as PedidoParaTabela[]).map(pedidoParaLinhaTabela);
  const preenchimento = summarizeFillStatus(pedidosDb as unknown as PedidoParaTabela[]);

  const downloadHref = transportadoraIdFiltro
    ? `/base-completa/download?transportadoraId=${transportadoraIdFiltro}`
    : "/base-completa/download";

  return (
    <div className="mb-html">
      <main className="page">
        <div className="page-header">
          <div>
            <h1>Base Completa</h1>
            <p>
              Visão interna de todos os pedidos, de todas as transportadoras, incluindo finalizados. Use o filtro de
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
            downloadHref={downloadHref}
            downloadLabel="Baixar Base Completa"
            backendNote="Visão interna - mostra todas as transportadoras, incluindo pedidos finalizados. Sem devolução: essa ação pertence ao fluxo de cada transportadora."
          />
        </section>
      </main>

      <HelpPanel />
    </div>
  );
}
