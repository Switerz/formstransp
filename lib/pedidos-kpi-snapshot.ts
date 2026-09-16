import { prisma } from "@/lib/prisma";
import { classificarMacroInsucesso, classificarMacroStatus } from "@/lib/pedidos-classificacao";

export const KPI_SNAPSHOT_TIPO = "pedidos_kpi_snapshot";

interface DiaKpi {
  total: number; abertos: number;
  slaTransTotal: number; slaTransOk: number;
  slaClienteTotal: number; slaClienteOk: number;
  slaAjusteTotal: number; slaAjusteOk: number;
  prometidos: number; insucesso: number; devolucao: number;
  tratativa: number; perdas: number; processado: number;
}

export interface KpiSnapshotPayload {
  versao: 1;
  geradoEm: string;
  criacao: Record<string, DiaKpi>;
  previsao: Record<string, number>;
}

export interface PedidoKpiSnapshot {
  canalVendas: string;
  dataCriacaoPedido: Date;
  dataEntregaOrigem: Date | null;
  previsaoEntregaClienteOrigem: Date | null;
  previsaoEntregaTransportadoraOrigem: Date | null;
  dataDespacho: Date | null;
  microStatus: string | null;
  statusTransportador: string | null;
  quantidadeOcorrencias: number | null;
  ultimaOcorrenciaMicro: string | null;
  motivoDevolucao: string | null;
  dataPrevisao: Date | null;
  dataEntrega: Date | null;
}

const vazio = (): DiaKpi => ({
  total: 0, abertos: 0, slaTransTotal: 0, slaTransOk: 0,
  slaClienteTotal: 0, slaClienteOk: 0, slaAjusteTotal: 0, slaAjusteOk: 0,
  prometidos: 0, insucesso: 0, devolucao: 0, tratativa: 0, perdas: 0, processado: 0,
});

function diaLocal(data: Date) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(data);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

export function criarKpiSnapshot(pedidos: PedidoKpiSnapshot[]): KpiSnapshotPayload {
  const payload: KpiSnapshotPayload = { versao: 1, geradoEm: new Date().toISOString(), criacao: {}, previsao: {} };
  for (const pedido of pedidos) {
    const chave = diaLocal(pedido.dataCriacaoPedido);
    const dia = (payload.criacao[chave] ??= vazio());
    dia.total += 1;
    if (!pedido.dataEntregaOrigem) dia.abertos += 1;

    if (pedido.dataEntregaOrigem && pedido.previsaoEntregaTransportadoraOrigem) {
      dia.slaTransTotal += 1;
      if (pedido.dataEntregaOrigem <= pedido.previsaoEntregaTransportadoraOrigem) dia.slaTransOk += 1;
    }
    if (pedido.dataEntregaOrigem && pedido.previsaoEntregaClienteOrigem) {
      dia.slaClienteTotal += 1;
      if (pedido.dataEntregaOrigem <= pedido.previsaoEntregaClienteOrigem) dia.slaClienteOk += 1;
    }
    if (pedido.dataEntrega && pedido.dataPrevisao) {
      dia.slaAjusteTotal += 1;
      if (pedido.dataEntrega <= pedido.dataPrevisao) dia.slaAjusteOk += 1;
    }

    const macro = classificarMacroStatus({
      microStatus: pedido.microStatus,
      statusTransportador: pedido.statusTransportador,
      quantidadeOcorrencias: pedido.quantidadeOcorrencias,
      ehGocase: pedido.canalVendas?.trim().toUpperCase() === "SITE BR (EXTREMA/MG)",
    });
    const prometido = macro !== "Não Processado";
    if (prometido) {
      dia.prometidos += 1;
      if (classificarMacroInsucesso(pedido.ultimaOcorrenciaMicro)) dia.insucesso += 1;
      if (macro === "Devolução" || macro === "Devolvido" || Boolean(pedido.motivoDevolucao?.trim())) dia.devolucao += 1;
      if (macro === "Tratativa CX" || macro === "Retirada Correios") dia.tratativa += 1;
      if (macro === "Extravio/Sinistro/Avaria") dia.perdas += 1;
      if (pedido.dataDespacho) dia.processado += 1;
    }

    if (!pedido.dataEntregaOrigem && pedido.previsaoEntregaTransportadoraOrigem) {
      const previsao = diaLocal(pedido.previsaoEntregaTransportadoraOrigem);
      payload.previsao[previsao] = (payload.previsao[previsao] ?? 0) + 1;
    }
  }
  return payload;
}

export async function salvarKpiSnapshot(transportadoraId: string, pedidos: PedidoKpiSnapshot[]) {
  const payload = criarKpiSnapshot(pedidos);
  await prisma.automationLog.create({ data: {
    transportadoraId, dataReport: new Date(), tipo: KPI_SNAPSHOT_TIPO,
    status: "success", mensagem: `Snapshot de KPIs com ${pedidos.length} pedidos`,
    payload: JSON.stringify(payload),
  }});
}

export async function obterKpiSnapshot(transportadoraId: string) {
  const log = await prisma.automationLog.findFirst({
    where: { transportadoraId, tipo: KPI_SNAPSHOT_TIPO, status: "success" },
    orderBy: { createdAt: "desc" }, select: { payload: true, createdAt: true },
  });
  if (!log?.payload) return null;
  try { return { payload: JSON.parse(log.payload) as KpiSnapshotPayload, criadoEm: log.createdAt }; }
  catch { return null; }
}

export function resumirKpiSnapshot(payload: KpiSnapshotPayload, de: string, ate: string) {
  const soma = vazio();
  for (const [dia, valores] of Object.entries(payload.criacao)) {
    if (dia < de || dia > ate) continue;
    for (const chave of Object.keys(soma) as Array<keyof DiaKpi>) soma[chave] += valores[chave];
  }
  let vencidos = 0;
  for (const [dia, total] of Object.entries(payload.previsao)) if (dia >= de && dia <= ate) vencidos += total;
  return { ...soma, vencidos };
}
