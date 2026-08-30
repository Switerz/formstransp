import { describe, expect, it } from "vitest";
import { processarLinhaDevolucao, type PedidoAtualDevolucao } from "./pedidos-devolucao-processar";

function pedidoBase(overrides: Partial<PedidoAtualDevolucao> = {}): PedidoAtualDevolucao {
  return {
    id: "p1",
    pedido: "BR123456789",
    transportadoraId: "t1",
    protegidosAtuais: {
      "Nome do Destinatário": "Maria da Silva",
      "Canal de Vendas": "LESCENT-ES",
      "Cidade do Destinatário": "São Paulo",
      UF: "SP",
      "CEP do destinatário": "01311-000",
      "Pedido de Venda": "PV-000123",
      Pedido: "BR123456789",
      "Código de rastreio": "BR123456789BR",
      "Nota Fiscal": "000123456",
      "Método de envio": "PAC",
      Transportadora: "Log Servicos",
      "Valor da Nota": "189.9",
      "Peso fisico": "0.55",
      "Chave da Nota": "3526...",
    },
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

describe("processarLinhaDevolucao — TESTE 7: upload legítimo altera só campo operacional permitido", () => {
  it("primeiro preenchimento de STATUS ATUAL e DATA DE ENTREGA é aplicado", () => {
    const resultado = processarLinhaDevolucao(
      { Pedido: "BR123456789", "STATUS ATUAL": "DEVOLVIDO", "DATA DE ENTREGA": "2026-08-25" },
      pedidoBase(),
      1,
    );
    expect(resultado.status).toBe("aplicado");
    expect(resultado.tentativasBloqueadas).toEqual([]);
    expect(resultado.violacoesProtegidas).toEqual([]);
    expect(resultado.updateData.statusAtual).toBe("DEVOLVIDO");
    expect(resultado.updateData.dataEntrega).toBeInstanceOf(Date);
    expect(resultado.alteracoesAplicadas).toHaveLength(2);
  });

  it("reenviar o mesmo valor já existente não gera alteração nem bloqueio (idempotente)", () => {
    const resultado = processarLinhaDevolucao(
      { Pedido: "BR123456789", "STATUS ATUAL": "DEVOLVIDO" },
      pedidoBase({ statusAtual: "DEVOLVIDO" }),
      1,
    );
    expect(resultado.status).toBe("sem_alteracao");
    expect(resultado.tentativasBloqueadas).toEqual([]);
    expect(resultado.updateData).toEqual({});
  });

  it("campo vazio no upload não mexe no valor já existente", () => {
    const resultado = processarLinhaDevolucao(
      { Pedido: "BR123456789", "STATUS ATUAL": "" },
      pedidoBase({ statusAtual: "DEVOLVIDO" }),
      1,
    );
    expect(resultado.updateData.statusAtual).toBeUndefined();
    expect(resultado.tentativasBloqueadas).toEqual([]);
  });

  it("aplica o 11º campo (DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO)", () => {
    const resultado = processarLinhaDevolucao(
      { Pedido: "BR123456789", "DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO": "2026-08-30" },
      pedidoBase(),
      1,
    );
    expect(resultado.status).toBe("aplicado");
    expect(resultado.updateData.dataResolucaoDevolucao).toBeInstanceOf(Date);
  });
});

describe("processarLinhaDevolucao — TESTE 8: campo protegido manipulado é rejeitado", () => {
  it("UF diferente da atual é bloqueada como violação, nada é aplicado na linha", () => {
    const resultado = processarLinhaDevolucao(
      { Pedido: "BR123456789", UF: "RJ", "STATUS ATUAL": "DEVOLVIDO" },
      pedidoBase(),
      1,
    );
    expect(resultado.status).toBe("erro_validacao");
    expect(resultado.violacoesProtegidas).toEqual([{ campo: "UF", antes: "SP", depois: "RJ" }]);
    expect(resultado.updateData).toEqual({});
    // mesmo o campo operacional válido (STATUS ATUAL) da mesma linha não é aplicado.
    expect(resultado.alteracoesAplicadas).toEqual([]);
  });

  it("reenviar o campo protegido com o MESMO valor não é violação", () => {
    const resultado = processarLinhaDevolucao(
      { Pedido: "BR123456789", UF: "SP", "STATUS ATUAL": "DEVOLVIDO" },
      pedidoBase(),
      1,
    );
    expect(resultado.status).toBe("aplicado");
    expect(resultado.violacoesProtegidas).toEqual([]);
  });
});

describe("processarLinhaDevolucao — bloqueio de campo operacional já respondido", () => {
  it("tentativa de mudar STATUS ATUAL já preenchido é bloqueada e o valor atual é preservado", () => {
    const resultado = processarLinhaDevolucao(
      { Pedido: "BR123456789", "STATUS ATUAL": "CANCELADO" },
      pedidoBase({ statusAtual: "DEVOLVIDO" }),
      1,
    );
    expect(resultado.status).toBe("sem_alteracao");
    expect(resultado.tentativasBloqueadas).toEqual([{ campo: "STATUS ATUAL", antes: "DEVOLVIDO", depois: "CANCELADO" }]);
    expect(resultado.updateData.statusAtual).toBeUndefined();
  });

  it("um campo bloqueado não impede que OUTRO campo (ainda vazio) da mesma linha seja aplicado", () => {
    const resultado = processarLinhaDevolucao(
      { Pedido: "BR123456789", "STATUS ATUAL": "CANCELADO", OCORRÊNCIA: "Cliente Ausente" },
      pedidoBase({ statusAtual: "DEVOLVIDO" }),
      1,
    );
    expect(resultado.status).toBe("aplicado");
    expect(resultado.tentativasBloqueadas).toHaveLength(1);
    expect(resultado.updateData.statusAtual).toBeUndefined();
    expect(resultado.updateData.ocorrencia).toBe("Cliente Ausente");
  });
});

describe("processarLinhaDevolucao — TESTE 11: campo de resolução de devolução", () => {
  it("rejeita formato de data inválido no 11º campo", () => {
    const resultado = processarLinhaDevolucao(
      { Pedido: "BR123456789", "DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO": "não é data" },
      pedidoBase(),
      1,
    );
    expect(resultado.status).toBe("erro_validacao");
    expect(resultado.errosValidacao[0].coluna).toBe("DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO");
  });

  it("aceita o 11º campo vazio sem gerar erro nem alteração", () => {
    const resultado = processarLinhaDevolucao(
      { Pedido: "BR123456789", "DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO": "" },
      pedidoBase(),
      1,
    );
    expect(resultado.status).toBe("sem_alteracao");
    expect(resultado.errosValidacao).toEqual([]);
  });
});

describe("processarLinhaDevolucao — erro de validação de formato bloqueia a linha inteira", () => {
  it("OCORRÊNCIA fora do de/para impede até o STATUS ATUAL válido da mesma linha", () => {
    const resultado = processarLinhaDevolucao(
      { Pedido: "BR123456789", "STATUS ATUAL": "DEVOLVIDO", OCORRÊNCIA: "Motivo Inventado" },
      pedidoBase(),
      1,
    );
    expect(resultado.status).toBe("erro_validacao");
    expect(resultado.updateData).toEqual({});
  });
});
