import { describe, expect, it } from "vitest";
import { linhaCorrespondeABusca, pedidoParaLinhaTabela, type PedidoParaTabela } from "./pedidos-table-row";

function pedido(overrides: Partial<PedidoParaTabela> = {}): PedidoParaTabela {
  return {
    id: "p1",
    pedido: "BR123456789",
    nomeDestinatario: "Maria da Silva",
    canalVendas: "LESCENT-ES",
    cidadeDestinatario: "São Paulo",
    uf: "SP",
    cepDestinatario: "01311-000",
    pedidoDeVenda: "PV-000123",
    codigoRastreio: "BR123456789BR",
    notaFiscal: "000123456",
    metodoEnvio: "PAC",
    transportadora: { nome: "Log Servicos" },
    valorNota: "189.9",
    pesoFisico: "0.55",
    chaveNota: "3526...",
    dataCriacaoPedido: new Date(2026, 7, 20),
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
    ...overrides,
  };
}

describe("pedidoParaLinhaTabela", () => {
  it("monta as 25 colunas nomeadas + status de preenchimento + Ofensor GB", () => {
    const linha = pedidoParaLinhaTabela(pedido({ statusAtual: "DEVOLVIDO" }));
    expect(linha.colunas["Pedido"]).toBe("BR123456789");
    expect(linha.colunas["Transportadora"]).toBe("Log Servicos");
    expect(linha.colunas["DATA DE ENTREGA"]).toBe("");
    expect(linha.fillStatus).toBe("partial");
    expect(linha.ofensorGb).toBe("Devolução");
  });
});

describe("linhaCorrespondeABusca — TESTE 5", () => {
  const linha = pedidoParaLinhaTabela(pedido());

  it("encontra valor em coluna de origem (protegida)", () => {
    expect(linhaCorrespondeABusca(linha, "são paulo")).toBe(true);
  });

  it("encontra valor em coluna preenchível", () => {
    const linhaComStatus = pedidoParaLinhaTabela(pedido({ statusAtual: "DEVOLVIDO" }));
    expect(linhaCorrespondeABusca(linhaComStatus, "devolvido")).toBe(true);
  });

  it("ignora caixa", () => {
    expect(linhaCorrespondeABusca(linha, "MARIA")).toBe(true);
  });

  it("busca vazia sempre corresponde", () => {
    expect(linhaCorrespondeABusca(linha, "")).toBe(true);
  });

  it("não encontra valor inexistente", () => {
    expect(linhaCorrespondeABusca(linha, "xyz-nao-existe")).toBe(false);
  });
});
