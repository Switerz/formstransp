import { requireCarrierUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBrazilianDate } from "@/lib/dates";
import { KpiCarousel, type KpiCard } from "@/components/pedidos/KpiCarousel";
import { BasePanel } from "@/components/pedidos/BasePanel";
import { HelpPanel } from "@/components/pedidos/HelpPanel";
import { pedidoParaLinhaTabela, type PedidoParaTabela } from "@/lib/pedidos-table-row";
import { calcularKpisDerivaveis } from "@/lib/pedidos-kpis";
import { uploadDevolucaoTransportadora } from "@/app/portal/minha-base/actions";
import "@/components/pedidos/minha-base.css";

export const dynamic = "force-dynamic";

const SEM_REGRA: KpiCard = { icon: "", label: "", value: "—", hint: "Aguardando dados" };

function formatarUltimaAtualizacao(data: Date | null): string {
  if (!data) return "Aguardando carga";
  return formatBrazilianDate(data);
}

export default async function MinhaBasePage() {
  const user = await requireCarrierUser("/portal/minha-base");
  const transportadoraId = user.transportadoraId!;

  const [pedidosDb, totalPedidos, pedidosAbertosCount, ultimaCarga, ultimaDevolucao] = await Promise.all([
    prisma.pedido.findMany({
      where: { transportadoraId, dataEntregaOrigem: null },
      include: { transportadora: { select: { nome: true } } },
      orderBy: { dataCriacaoPedido: "desc" },
      take: 1000,
    }),
    prisma.pedido.count({ where: { transportadoraId } }),
    prisma.pedido.count({ where: { transportadoraId, dataEntregaOrigem: null } }),
    prisma.automationLog.findFirst({
      where: { tipo: "pedidos_import" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.automationLog.findFirst({
      where: { tipo: "pedidos_devolucao", transportadoraId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const linhas = (pedidosDb as unknown as PedidoParaTabela[]).map(pedidoParaLinhaTabela);
  const kpis = calcularKpisDerivaveis(totalPedidos, pedidosAbertosCount, pedidosDb as unknown as PedidoParaTabela[]);

  const totalPedidosCard: KpiCard = {
    icon: "▥",
    label: "Total de Pedidos",
    value: kpis.totalPedidos.toLocaleString("pt-BR"),
    hint: "Todos os pedidos da transportadora",
  };
  const pedidosAbertosCard: KpiCard = {
    icon: "□",
    label: "Pedidos em Aberto",
    value: kpis.pedidosAbertos.toLocaleString("pt-BR"),
    hint: "dataEntregaOrigem em aberto",
  };
  const abertoTotalCard: KpiCard = {
    icon: "□",
    label: "% Aberto/Total",
    value: `${kpis.percentualAbertoTotal}%`,
    hint: "Sobre o total da transportadora",
  };

  const integridadeCard: KpiCard = {
    icon: "✓",
    label: "Integridade da devolução",
    value: "Aguardando",
    hint: "Envie a devolução da base",
    id: "iIntegrity",
  };
  const statusCard: KpiCard = {
    icon: "•",
    label: "Status",
    value: ultimaDevolucao ? "Recebida" : "Aguardando",
    hint: ultimaDevolucao ? formatBrazilianDate(ultimaDevolucao.createdAt) : "Nenhuma devolução recebida ainda",
    id: "mStatus",
  };

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

        <section className="grid">
          <KpiCarousel
            slaAjusteTransporte={{ ...SEM_REGRA, icon: "◎", label: "SLA Ajuste Transporte" }}
            slaTransporte={{ ...SEM_REGRA, icon: "▣", label: "SLA Transporte" }}
            slaCliente={{ ...SEM_REGRA, icon: "●", label: "SLA Cliente" }}
            taxaInsucesso={{ ...SEM_REGRA, icon: "!", label: "Taxa de Insucesso" }}
            taxaDevolucao={{ ...SEM_REGRA, icon: "↺", label: "Taxa de Devolução" }}
            pedidosAbertos={pedidosAbertosCard}
            tratativaCx={{ ...SEM_REGRA, icon: "×", label: "Tratativa CX" }}
            riscoAtraso={{ ...SEM_REGRA, icon: "◷", label: "Risco de Atraso" }}
            processado={{ ...SEM_REGRA, icon: "↗", label: "Processado" }}
            perdas={{ ...SEM_REGRA, icon: "◇", label: "Perdas Extr/Sint/Avar" }}
            totalPedidos={totalPedidosCard}
            abertoTotal={abertoTotalCard}
            integridade={integridadeCard}
            status={statusCard}
          />

          <BasePanel
            linhas={linhas}
            lastBaseUpdateLabel={formatarUltimaAtualizacao(ultimaCarga?.createdAt ?? null)}
            hasBaseUpdate={Boolean(ultimaCarga)}
            fillPending={kpis.preenchimento.pending}
            fillPartial={kpis.preenchimento.partial}
            fillDone={kpis.preenchimento.done}
            downloadHref="/portal/minha-base/download"
            uploadAction={uploadDevolucaoTransportadora}
          />
        </section>
      </main>

      <HelpPanel />
    </div>
  );
}
