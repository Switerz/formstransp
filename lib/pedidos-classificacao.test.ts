import { describe, expect, it } from "vitest";
import {
  classificarMacroInsucesso,
  classificarMacroStatus,
} from "./pedidos-classificacao";

describe("classificarMacroStatus", () => {
  it("classifica entregue pelo Status Transportador", () => {
    expect(
      classificarMacroStatus({
        microStatus: "EM TR?NSITO",
        statusTransportador: "ENTREGUE",
      }),
    ).toBe("Entregue");
  });

  it("classifica devolvido pelo Status Transportador", () => {
    expect(
      classificarMacroStatus({
        statusTransportador: "DEVOLVIDO",
      }),
    ).toBe("Devolvido");
  });

  it("classifica devolu??o em andamento", () => {
    expect(
      classificarMacroStatus({
        statusTransportador: "EM DEVOLU\u00C7\u00C3O",
      }),
    ).toBe("Devolu\u00E7\u00E3o");
  });

  it("classifica perda", () => {
    expect(
      classificarMacroStatus({
        microStatus: "EXTRAVIO CONFIRMADO",
      }),
    ).toBe("Extravio/Sinistro/Avaria");
  });

  it("classifica n?o processado", () => {
    expect(
      classificarMacroStatus({
        microStatus: "ARQUIVO RECEBIDO",
      }),
    ).toBe("N\u00E3o Processado");
  });

  it("aplica regra extra de n?o processado da GoBeaut?", () => {
    expect(
      classificarMacroStatus({
        microStatus: "ETIQUETA CRIADA",
        ehGocase: false,
      }),
    ).toBe("N\u00E3o Processado");
  });

  it("n?o aplica regra exclusiva da GoBeaut? na Gocase", () => {
    expect(
      classificarMacroStatus({
        microStatus: "ETIQUETA CRIADA",
        ehGocase: true,
      }),
    ).toBe("Em Tr\u00E2nsito");
  });

  it("mant?m destinat?rio ausente em tr?nsito com 2 ocorr?ncias", () => {
    expect(
      classificarMacroStatus({
        microStatus: "DESTINATARIO AUSENTE",
        quantidadeOcorrencias: 2,
      }),
    ).toBe("Em Tr\u00E2nsito");
  });

  it("envia destinat?rio ausente para Tratativa CX com 3 ocorr?ncias", () => {
    expect(
      classificarMacroStatus({
        microStatus: "DESTINATARIO AUSENTE",
        quantidadeOcorrencias: 3,
      }),
    ).toBe("Tratativa CX");
  });

  it("mant?m estabelecimento fechado em tr?nsito antes da terceira tentativa", () => {
    expect(
      classificarMacroStatus({
        microStatus: "ESTABELECIMENTO FECHADO",
        quantidadeOcorrencias: 1,
      }),
    ).toBe("Em Tr\u00E2nsito");
  });

  it("envia estabelecimento fechado para Tratativa CX na terceira tentativa", () => {
    expect(
      classificarMacroStatus({
        microStatus: "ESTABELECIMENTO FECHADO",
        quantidadeOcorrencias: 3,
      }),
    ).toBe("Tratativa CX");
  });

  it("classifica retirada nos Correios", () => {
    expect(
      classificarMacroStatus({
        microStatus: "N\u00C3O FOI POSS\u00CDVEL ENTREGAR. AGUARDANDO RETIRADA.",
      }),
    ).toBe("Retirada Correios");
  });
});


describe("classificarMacroInsucesso", () => {
  it("classifica Cliente Ausente", () => {
    expect(classificarMacroInsucesso("DESTINATARIO AUSENTE"))
      .toBe("Cliente Ausente");

    expect(classificarMacroInsucesso("DESTINAT\u00C1RIO AUSENTE"))
      .toBe("Cliente Ausente");

    expect(classificarMacroInsucesso("DESTINAT\u00C1RIO N\u00C3O LOCALIZADO"))
      .toBe("Cliente Ausente");
  });

  it("classifica N?o Visitado", () => {
    expect(classificarMacroInsucesso("N\u00C3O VISITADO"))
      .toBe("N\u00E3o Visitado");
  });

  it("classifica Problemas De Endere?o", () => {
    expect(classificarMacroInsucesso("ENDERECO INCORRETO"))
      .toBe("Problemas De Endere\u00E7o");

    expect(classificarMacroInsucesso("ENDERE\u00C7O INSUFICIENTE"))
      .toBe("Problemas De Endere\u00E7o");

    expect(classificarMacroInsucesso("ENDERE\u00C7O N\u00C3O LOCALIZADO"))
      .toBe("Problemas De Endere\u00E7o");
  });

  it("classifica Destinat?rio Desconhecido", () => {
    expect(classificarMacroInsucesso("DESTINAT\u00C1RIO DESCONHECIDO"))
      .toBe("Destinat\u00E1rio Desconhecido");
  });

  it("classifica Destinat?rio Mudou-se", () => {
    expect(classificarMacroInsucesso("DESTINAT\u00C1RIO MUDOU-SE"))
      .toBe("Destinat\u00E1rio Mudou-se");
  });

  it("classifica Estabelecimento Fechado", () => {
    expect(classificarMacroInsucesso("ESTABELECIMENTO FECHADO"))
      .toBe("Estabelecimento Fechado");
  });

  it("classifica Carga Recusada Pelo Destinat?rio", () => {
    expect(classificarMacroInsucesso("CARGA RECUSADA PELO DESTINATARIO"))
      .toBe("Carga Recusada Pelo Destinat\u00E1rio");
  });

  it("classifica Bloqueio De Entrega Pelo Remetente", () => {
    expect(
      classificarMacroInsucesso(
        "BLOQUEADO PELO REMETENTE/ENTREGA BARRADA",
      ),
    ).toBe("Bloqueio De Entrega Pelo Remetente");
  });

  it("classifica Retirada Correios", () => {
    expect(
      classificarMacroInsucesso(
        "N\u00C3O FOI POSS\u00CDVEL ENTREGAR. AGUARDANDO RETIRADA.",
      ),
    ).toBe("Retirada Correios");
  });

  it("classifica Fatores Naturais", () => {
    expect(classificarMacroInsucesso("Acidentes de natureza"))
      .toBe("Fatores Naturais");

    expect(classificarMacroInsucesso("FATORES NATURAIS"))
      .toBe("Fatores Naturais");
  });

  it("n?o cria Macro Insucesso para ocorr?ncia n?o mapeada", () => {
    expect(classificarMacroInsucesso("ENTREGUE")).toBeNull();
    expect(classificarMacroInsucesso("")).toBeNull();
    expect(classificarMacroInsucesso(null)).toBeNull();
  });
});
