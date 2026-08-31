import { describe, expect, it } from "vitest";
import { calcularKpisDerivaveis, rowFillStatus, summarizeFillStatus, isPedidoVencidoNoPeriodo, type PedidoOperacional } from "./pedidos-kpis";

const vazio: PedidoOperacional = {
  dataColetaProcessamento: null,
  dataPrevisao: null,
  prazoEntregaDiasUteis: null,
  dataEntrega: null,
  statusAtual: null,
  ocorrencia: null,
  motivoDevolucao: null,
  slaStatus: null,
  justificativaAtraso: null,
  novaDataPrevisao: null,
  dataResolucaoDevolucao: null,
};

describe("rowFillStatus", () => {
  it("pending quando nenhum campo operacional está preenchido", () => {
    expect(rowFillStatus(vazio)).toBe("pending");
  });

  it("done quando os 11 campos estão preenchidos", () => {
    const cheio: PedidoOperacional = {
      dataColetaProcessamento: new Date(),
      dataPrevisao: new Date(),
      prazoEntregaDiasUteis: 5,
      dataEntrega: new Date(),
      statusAtual: "DEVOLVIDO",
      ocorrencia: "Cliente Ausente",
      motivoDevolucao: "Devolução por Avaria",
      slaStatus: "No prazo",
      justificativaAtraso: "atraso na coleta",
      novaDataPrevisao: new Date(),
      dataResolucaoDevolucao: new Date(),
    };
    expect(rowFillStatus(cheio)).toBe("done");
  });

  it("partial quando só o 11º campo (dataResolucaoDevolucao) está preenchido", () => {
    const parcial: PedidoOperacional = { ...vazio, dataResolucaoDevolucao: new Date() };
    expect(rowFillStatus(parcial)).toBe("partial");
  });

  it("summarizeFillStatus soma corretamente", () => {
    const resumo = summarizeFillStatus([vazio, vazio, { ...vazio, statusAtual: "X" }]);
    expect(resumo).toEqual({ pending: 2, partial: 1, done: 0 });
  });
});

describe("calcularKpisDerivaveis", () => {
  it("calcula total, abertos e percentual", () => {
    const kpis = calcularKpisDerivaveis(200, 50, [vazio, vazio]);
    expect(kpis.totalPedidos).toBe(200);
    expect(kpis.pedidosAbertos).toBe(50);
    expect(kpis.percentualAbertoTotal).toBe(25);
  });

  it("não divide por zero quando não há pedidos", () => {
    const kpis = calcularKpisDerivaveis(0, 0, []);
    expect(kpis.percentualAbertoTotal).toBe(0);
  });
});

describe("isPedidoVencidoNoPeriodo — TESTE 7/8 (pedido vencido D-1 entra/não entra)", () => {
  const gte = new Date(2026, 7, 30);
  const lt = new Date(2026, 7, 31); // exclusivo - período é só 30/08

  it("entra: dataPrevisao dentro do período e não finalizado", () => {
    expect(isPedidoVencidoNoPeriodo({ dataPrevisao: new Date(2026, 7, 30), dataEntregaOrigem: null }, gte, lt)).toBe(true);
  });

  it("não entra: já finalizado (dataEntregaOrigem preenchida), mesmo com promessa no período", () => {
    expect(
      isPedidoVencidoNoPeriodo({ dataPrevisao: new Date(2026, 7, 30), dataEntregaOrigem: new Date() }, gte, lt),
    ).toBe(false);
  });

  it("não entra: dataPrevisao fora do período (dia seguinte)", () => {
    expect(isPedidoVencidoNoPeriodo({ dataPrevisao: new Date(2026, 7, 31), dataEntregaOrigem: null }, gte, lt)).toBe(false);
  });

  it("não entra: sem Promessa Transporte definida", () => {
    expect(isPedidoVencidoNoPeriodo({ dataPrevisao: null, dataEntregaOrigem: null }, gte, lt)).toBe(false);
  });
});
