import { requireCarrierUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBrazilianDate } from "@/lib/dates";
import { KpiCarousel, type KpiCard } from "@/components/pedidos/KpiCarousel";
import { PedidosTable } from "@/components/pedidos/PedidosTable";
import { UploadDevolucao } from "@/components/pedidos/UploadDevolucao";
import { HelpPanel } from "@/components/pedidos/HelpPanel";
import { pedidoParaLinhaTabela, type PedidoParaTabela } from "@/lib/pedidos-table-row";
import { calcularKpisDerivaveis } from "@/lib/pedidos-kpis";

export const dynamic = "force-dynamic";

const CARDS_SEM_REGRA: Array<{ icon: string; label: string }> = [
  { icon: "◎", label: "SLA Ajuste Transporte" },
  { icon: "▣", label: "SLA Transporte" },
  { icon: "●", label: "SLA Cliente" },
  { icon: "!", label: "Taxa de Insucesso" },
  { icon: "↺", label: "Taxa de Devolução" },
  { icon: "×", label: "Tratativa CX" },
  { icon: "◷", label: "Risco de Atraso" },
  { icon: "↗", label: "Processado" },
  { icon: "◇", label: "Perdas Extr/Sint/Avar" },
];

function formatarHaQuanto(data: Date | null): string {
  if (!data) return "Sem carga registrada ainda";
  const diffMs = Date.now() - data.getTime();
  const horas = Math.floor(diffMs / (1000 * 60 * 60));
  if (horas < 1) return "Base atualizada há menos de 1 hora";
  if (horas === 1) return "Base atualizada há 1 hora";
  if (horas < 48) return `Base atualizada há ${horas} horas`;
  const dias = Math.floor(horas / 24);
  return `Base atualizada há ${dias} dia${dias === 1 ? "" : "s"}`;
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
      select: { payload: true, createdAt: true },
    }),
  ]);

  const linhas = (pedidosDb as unknown as PedidoParaTabela[]).map(pedidoParaLinhaTabela);
  const kpis = calcularKpisDerivaveis(totalPedidos, pedidosAbertosCount, pedidosDb as unknown as PedidoParaTabela[]);

  let integridadeValue = "Aguardando";
  let integridadeHint = "Envie a devolução da base";
  let statusValue = "Aguardando";
  let statusHint = "Nenhuma devolução recebida ainda";

  if (ultimaDevolucao?.payload) {
    try {
      const resumo = JSON.parse(ultimaDevolucao.payload) as {
        detalhes?: Array<{ violacoesProtegidas?: unknown[] }>;
      };
      const temViolacao = (resumo.detalhes ?? []).some((d) => (d.violacoesProtegidas?.length ?? 0) > 0);
      integridadeValue = temViolacao ? "NOK" : "OK";
      integridadeHint = temViolacao ? "Revisão necessária - campo protegido divergente" : "Campos protegidos sem alteração";
      statusValue = "Recebida";
      statusHint = formatBrazilianDate(ultimaDevolucao.createdAt);
    } catch {
      // payload malformado - mantém "Aguardando" (não quebra a página)
    }
  }

  const geral: KpiCard[] = [
    { icon: "▥", label: "Total de Pedidos", value: kpis.totalPedidos.toLocaleString("pt-BR"), hint: "Todos os pedidos da transportadora", calc: true },
    { icon: "□", label: "Pedidos em Aberto", value: kpis.pedidosAbertos.toLocaleString("pt-BR"), hint: "dataEntregaOrigem em aberto", calc: true },
    { icon: "□", label: "% Aberto/Total", value: `${kpis.percentualAbertoTotal}%`, hint: "Sobre o total da transportadora", calc: true },
    ...CARDS_SEM_REGRA.map((c) => ({ ...c, value: "—", hint: "Aguardando regra", calc: false })),
  ];

  const integridade: KpiCard[] = [
    { icon: "✓", label: "Integridade da devolução", value: integridadeValue, hint: integridadeHint, calc: true },
    { icon: "•", label: "Status", value: statusValue, hint: statusHint, calc: true },
  ];

  return (
    <main className="shell minha-base-view">
      <div className="page-title">
        <div>
          <h1>Minha Base</h1>
          <p className="muted">Pedidos em aberto da sua transportadora. {formatarHaQuanto(ultimaCarga?.createdAt ?? null)}.</p>
        </div>
        <a className="btn" href="/portal/minha-base/download">
          Baixar Minha Base
        </a>
      </div>

      <KpiCarousel geral={geral} integridade={integridade} />

      <section className="card">
        <PedidosTable linhas={linhas} />
      </section>

      <UploadDevolucao />

      <HelpPanel />
    </main>
  );
}
