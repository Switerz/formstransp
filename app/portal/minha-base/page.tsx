import { requireCarrierUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { KpiCarousel } from "@/components/pedidos/KpiCarousel";
import { BasePanel } from "@/components/pedidos/BasePanel";
import { HelpPanel } from "@/components/pedidos/HelpPanel";
import { PeriodoFilter } from "@/components/pedidos/PeriodoFilter";
import { pedidoParaLinhaTabela, type PedidoParaTabela } from "@/lib/pedidos-table-row";
import { summarizeFillStatus } from "@/lib/pedidos-kpis";
import { montarDadosKpiCarousel } from "@/lib/pedidos-kpi-carousel";
import { uploadDevolucaoTransportadora } from "@/app/portal/minha-base/actions";
import "@/components/pedidos/minha-base.css";

export const dynamic = "force-dynamic";

export default async function MinhaBasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireCarrierUser("/portal/minha-base");
  const transportadoraId = user.transportadoraId!;
  const raw = await searchParams;

  // Mesma função usada pela aba Início - única fonte de verdade dos
  // Big Numbers, sem duplicar consulta/lógica entre as duas telas.
  const dadosKpi = await montarDadosKpiCarousel(transportadoraId, raw);

  const pedidosDb = await prisma.pedido.findMany({
    where: { transportadoraId, dataEntregaOrigem: null },
    include: { transportadora: { select: { nome: true } } },
    orderBy: { dataCriacaoPedido: "desc" },
    take: 1000,
  });

  const linhas = (pedidosDb as unknown as PedidoParaTabela[]).map(pedidoParaLinhaTabela);
  const preenchimento = summarizeFillStatus(pedidosDb as unknown as PedidoParaTabela[]);

  return (
    <div className="mb-html">
      <main className="page">
        <div className="page-header">
          <div>
            <h1>Envio, atualização e conferência de bases</h1>
            <p>
              A Intelipost disponibiliza a base de origem automaticamente, você faz o download, atualiza as informações
              operacionais e devolve a nova versão na mesma tela. O portal mantém as duas visões e destaca o que mudou.
            </p>
          </div>
        </div>

        <PeriodoFilter action="/portal/minha-base" de={dadosKpi.periodo.de} ate={dadosKpi.periodo.ate} />

        <section className="grid">
          <KpiCarousel {...dadosKpi.props} />

          <BasePanel
            linhas={linhas}
            lastBaseUpdateLabel={dadosKpi.ultimaCargaLabel}
            hasBaseUpdate={dadosKpi.hasBaseUpdate}
            fillPending={preenchimento.pending}
            fillPartial={preenchimento.partial}
            fillDone={preenchimento.done}
            downloadHref="/portal/minha-base/download"
            uploadAction={uploadDevolucaoTransportadora}
          />
        </section>
      </main>

      <HelpPanel />
    </div>
  );
}
