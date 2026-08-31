import { describe, expect, it } from "vitest";
import { getDefaultPeriodoD1, parsePeriodoFilters, periodoParaIntervaloDatas } from "./pedidos-periodo";

describe("getDefaultPeriodoD1", () => {
  it("DE e ATÉ são ambos o dia anterior a 'hoje'", () => {
    const periodo = getDefaultPeriodoD1(new Date(2026, 7, 31)); // 31/08/2026
    expect(periodo.de).toBe("2026-08-30");
    expect(periodo.ate).toBe("2026-08-30");
  });

  it("funciona corretamente na virada de mês/ano", () => {
    expect(getDefaultPeriodoD1(new Date(2026, 0, 1)).de).toBe("2025-12-31");
  });
});

describe("parsePeriodoFilters", () => {
  const hoje = new Date(2026, 7, 31);

  it("sem parâmetros, usa D-1 (não hardcoda 'ontem' fora do default)", () => {
    const periodo = parsePeriodoFilters({}, hoje);
    expect(periodo).toEqual({ de: "2026-08-30", ate: "2026-08-30" });
  });

  it("usa exatamente o DE/ATÉ informado pelo usuário quando válido", () => {
    const periodo = parsePeriodoFilters({ de: "2026-08-01", ate: "2026-08-15" }, hoje);
    expect(periodo).toEqual({ de: "2026-08-01", ate: "2026-08-15" });
  });

  it("cai para o default se algum valor for inválido", () => {
    const periodo = parsePeriodoFilters({ de: "não-é-data", ate: "2026-08-15" }, hoje);
    expect(periodo.de).toBe("2026-08-30"); // default
    expect(periodo.ate).toBe("2026-08-15"); // válido, mantido
  });
});

describe("periodoParaIntervaloDatas", () => {
  it("ATÉ é exclusivo no dia seguinte (inclui o dia inteiro de 'até')", () => {
    const intervalo = periodoParaIntervaloDatas({ de: "2026-08-30", ate: "2026-08-30" });
    expect(intervalo.gte.getTime()).toBe(new Date(2026, 7, 30).getTime());
    expect(intervalo.lt.getTime()).toBe(new Date(2026, 7, 31).getTime());
  });
});
