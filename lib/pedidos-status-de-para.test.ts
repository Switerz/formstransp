import { describe, expect, it } from "vitest";
import { getStatusPadrao, STATUS_DE_PARA } from "./pedidos-status-de-para";

describe("getStatusPadrao", () => {
  it("classifica valores nulos/vazios/traço como Transportadora (mesma regra do HTML)", () => {
    expect(getStatusPadrao(null)).toBe("Transportadora");
    expect(getStatusPadrao(undefined)).toBe("Transportadora");
    expect(getStatusPadrao("")).toBe("Transportadora");
    expect(getStatusPadrao("  ")).toBe("Transportadora");
    expect(getStatusPadrao("-")).toBe("Transportadora");
  });

  it("classifica um valor de cada categoria do DE/PARA oficial", () => {
    expect(getStatusPadrao("DESTINATARIO AUSENTE")).toBe("Ausente");
    expect(getStatusPadrao("EXTRAVIO TOTAL")).toBe("Extravio");
    expect(getStatusPadrao("DEVOLVIDO")).toBe("Devolução");
    expect(getStatusPadrao("CANCELADO")).toBe("Cancelado");
    expect(getStatusPadrao("ENDERECO INCORRETO")).toBe("End. Incorreto");
    expect(getStatusPadrao("PACOTE NÃO RETIRADO")).toBe("Retirada");
    expect(getStatusPadrao("PARADO NA FISCALIZACAO")).toBe("Ret. Fiscal");
  });

  it("ignora caixa e acentuação na comparação", () => {
    expect(getStatusPadrao("destinatario ausente")).toBe("Ausente");
    expect(getStatusPadrao("DESTINATÁRIO AUSENTE")).toBe("Ausente");
  });

  it("retorna null para valor fora do DE/PARA (não é erro, mesmo comportamento do Power Query)", () => {
    expect(getStatusPadrao("Status Totalmente Desconhecido")).toBeNull();
  });

  it("o DE/PARA tem todas as 8 categorias oficiais representadas", () => {
    const categorias = new Set(Object.values(STATUS_DE_PARA));
    expect(categorias).toEqual(
      new Set(["Transportadora", "Ausente", "Extravio", "Devolução", "Cancelado", "End. Incorreto", "Retirada", "Ret. Fiscal"]),
    );
  });
});
