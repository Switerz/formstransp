import { describe, expect, it } from "vitest";
import {
  calculateMonthlySLA,
  calculatePartialDaySLA,
  calculateStatusParticipation,
  calculateUFSLA,
  safeRate,
} from "./calculations";

describe("indicadores operacionais", () => {
  it("trata divisao por zero sem quebrar", () => {
    expect(safeRate(10, 0)).toBe(0);
    expect(calculatePartialDaySLA({ totalPedidos: 0, totalFinalizado: 0, finalizadosNoPrazo: 0 })).toBe(0);
  });

  it("calcula SLA mensal acumulado", () => {
    expect(
      calculateMonthlySLA([
        { totalPedidos: 100, totalNoPrazo: 90, totalForaDoPrazo: 10, totalTentativaInsucesso: 3, totalDevolucao: 1 },
        { totalPedidos: 200, totalNoPrazo: 190, totalForaDoPrazo: 10, totalTentativaInsucesso: 4, totalDevolucao: 2 },
      ]),
    ).toBeCloseTo(280 / 300);
  });

  it("calcula SLA por UF e participacao de status", () => {
    expect(calculateUFSLA({ uf: "CE", dentroDoPrazo: 45, foraDoPrazo: 5, total: 50 })).toBe(0.9);
    expect(calculateStatusParticipation([{ status: "Entregue", quantidade: 80 }], 100)[0].participacao).toBe(0.8);
  });
});
