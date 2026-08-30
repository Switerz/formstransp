import { describe, expect, it } from "vitest";
import {
  DATE_ONLY_COLUMNS,
  FILL_COLUMNS,
  PROTECTED_COLUMNS,
  isFillColumn,
  isPrimaryColumn,
  isProtectedColumn,
  validarLinhaDevolucao,
} from "./pedidos-devolucao-validation";

describe("layout oficial de 25 colunas", () => {
  it("14 protegidas + 11 preenchíveis = 25", () => {
    expect(PROTECTED_COLUMNS.length).toBe(14);
    expect(FILL_COLUMNS.length).toBe(11);
  });

  it("inclui DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO entre as preenchíveis (decisão explícita)", () => {
    expect(isFillColumn("DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO")).toBe(true);
  });

  it("o 11º campo também é validado como data-ou-vazio", () => {
    expect(DATE_ONLY_COLUMNS).toContain("DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO");
  });

  it("Pedido e Nota Fiscal são as colunas principais", () => {
    expect(isPrimaryColumn("Pedido")).toBe(true);
    expect(isPrimaryColumn("Nota Fiscal")).toBe(true);
    expect(isPrimaryColumn("UF")).toBe(false);
  });

  it("reconhece coluna protegida ignorando caixa/acento (ex.: Peso fisico/Peso físico)", () => {
    expect(isProtectedColumn("peso físico")).toBe(true);
    expect(isProtectedColumn("PESO FISICO")).toBe(true);
  });
});

describe("validarLinhaDevolucao", () => {
  it("aceita uma linha totalmente válida, incluindo o 11º campo preenchido", () => {
    const erros = validarLinhaDevolucao(
      {
        "DATA COLETA/PROCESSAMENTO": "2026-08-20",
        "DATA DE PREVISÃO": "2026-08-25",
        "PRAZO DE ENTREGA (DIAS ÚTEIS)": "5",
        "DATA DE ENTREGA": "",
        "STATUS ATUAL": "DEVOLVIDO",
        OCORRÊNCIA: "Cliente Ausente",
        "MOTIVO DEVOLUÇÃO": "Devolução por Avaria",
        "SLA (NO PRAZO/ATRASADO)": "No prazo",
        "JUSTIFICATIVA DE ATRASO": "",
        "NOVA DATA DE PREVISÃO (SE ATRASADO)": "",
        "DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO": "2026-08-30",
      },
      1,
    );
    expect(erros).toEqual([]);
  });

  it("aceita o 11º campo vazio", () => {
    const erros = validarLinhaDevolucao({ "DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO": "" }, 1);
    expect(erros).toEqual([]);
  });

  it("rejeita o 11º campo com formato de data inválido", () => {
    const erros = validarLinhaDevolucao({ "DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO": "não é uma data" }, 1);
    expect(erros).toHaveLength(1);
    expect(erros[0].coluna).toBe("DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO");
  });

  it("rejeita OCORRÊNCIA fora do de/para", () => {
    const erros = validarLinhaDevolucao({ OCORRÊNCIA: "Motivo Inventado" }, 2);
    expect(erros).toHaveLength(1);
    expect(erros[0].mensagem).toMatch(/de\/para de ocorrência/);
  });

  it("rejeita MOTIVO DEVOLUÇÃO fora do de/para", () => {
    const erros = validarLinhaDevolucao({ "MOTIVO DEVOLUÇÃO": "Motivo Inventado" }, 3);
    expect(erros).toHaveLength(1);
  });

  it("rejeita SLA fora de No prazo/Atrasado", () => {
    const erros = validarLinhaDevolucao({ "SLA (NO PRAZO/ATRASADO)": "Talvez" }, 4);
    expect(erros).toHaveLength(1);
  });

  it("rejeita PRAZO DE ENTREGA não numérico", () => {
    const erros = validarLinhaDevolucao({ "PRAZO DE ENTREGA (DIAS ÚTEIS)": "cinco" }, 5);
    expect(erros).toHaveLength(1);
  });

  it("aceita PRAZO DE ENTREGA vazio", () => {
    const erros = validarLinhaDevolucao({ "PRAZO DE ENTREGA (DIAS ÚTEIS)": "" }, 6);
    expect(erros).toEqual([]);
  });
});
