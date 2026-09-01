import { describe, expect, it } from "vitest";
import { parseIntelipostPedidoRow, resolveTransportadora } from "./pedidos-parsing";

const linhaValida = {
  pedido: "BR123456789",
  nome_destinatario: "Maria da Silva",
  canal_vendas: "LESCENT-ES",
  cidade_destinatario: "São Paulo",
  uf: "sp",
  cep_destinatario: "01311-000",
  pedido_de_venda: "PV-000123",
  codigo_rastreio: "BR123456789BR",
  nota_fiscal: "000123456",
  metodo_envio: "PAC",
  transportadora: "Log Servicos",
  valor_nota: 189.9,
  peso_fisico: 0.55,
  chave_nota: "35260812345678000199550010000123451123456789",
  data_criacao: "2026-08-20",
  data_entrega: null,
  previsao_entrega_cliente: "2026-08-27",
  previsao_entrega_transportadora: "2026-08-25",
};

describe("parseIntelipostPedidoRow", () => {
  it("aceita uma linha válida e normaliza UF para maiúsculo", () => {
    const parsed = parseIntelipostPedidoRow(linhaValida, 0);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.pedido).toBe("BR123456789");
      expect(parsed.data.uf).toBe("SP");
      expect(parsed.data.dataEntregaOrigem).toBeNull();
      expect(parsed.data.dataCriacaoPedido.getFullYear()).toBe(2026);
      expect(parsed.data.previsaoEntregaClienteOrigem?.getDate()).toBe(27);
      expect(parsed.data.previsaoEntregaTransportadoraOrigem?.getDate()).toBe(25);
    }
  });

  it("rejeita linha sem campo obrigatório", () => {
    const { pedido, ...semPedido } = linhaValida;
    void pedido;
    const parsed = parseIntelipostPedidoRow(semPedido, 1);
    expect(parsed.ok).toBe(false);
  });

  it("rejeita data_criacao em formato inválido", () => {
    const parsed = parseIntelipostPedidoRow({ ...linhaValida, data_criacao: "não é uma data" }, 2);
    expect(parsed.ok).toBe(false);
  });

  it("marca pedido finalizado quando data_entrega vem preenchida", () => {
    const parsed = parseIntelipostPedidoRow({ ...linhaValida, data_entrega: "2026-08-25" }, 3);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.dataEntregaOrigem).not.toBeNull();
    }
  });

  it("não derruba a linha por valor_nota/peso_fisico ausentes ou inválidos, só avisa", () => {
    const parsed = parseIntelipostPedidoRow(
      { ...linhaValida, valor_nota: null, peso_fisico: "abc" },
      4,
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.valorNota).toBeNull();
      expect(parsed.data.pesoFisico).toBeNull();
      expect(parsed.data.avisos.length).toBeGreaterThan(0);
    }
  });

  it("aceita valor decimal em formato brasileiro (vírgula)", () => {
    const parsed = parseIntelipostPedidoRow({ ...linhaValida, valor_nota: "1.234,56" }, 5);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.valorNota).toBeCloseTo(1234.56);
    }
  });
});

describe("resolveTransportadora", () => {
  const transportadoras = [
    { id: "t1", nome: "Log Servicos", codigoSlug: "log-servicos", aliases: ["LogExpress Serviços"] },
    { id: "t2", nome: "Rápido Expresso", codigoSlug: "rapido-expresso", aliases: [] },
    { id: "t3", nome: "J&T", codigoSlug: "jt", aliases: ["J&T Express"] },
    { id: "t4", nome: "Diálogo", codigoSlug: "dialogo", aliases: ["Diálogo Logística"] },
  ];

  it("resolve por nome, ignorando caixa e acentuação", () => {
    const found = resolveTransportadora("LOG SERVIÇOS", transportadoras);
    expect(found?.id).toBe("t1");
  });

  it("resolve por codigoSlug", () => {
    const found = resolveTransportadora("rapido-expresso", transportadoras);
    expect(found?.id).toBe("t2");
  });

  it("resolve por alias, ignorando caixa e acentuação", () => {
    expect(resolveTransportadora("j&t express", transportadoras)?.id).toBe("t3");
    expect(resolveTransportadora("DIALOGO LOGISTICA", transportadoras)?.id).toBe("t4");
    expect(resolveTransportadora("logexpress serviços", transportadoras)?.id).toBe("t1");
  });

  it("não resolve por um alias que não existe", () => {
    const found = resolveTransportadora("Logan Express", transportadoras);
    expect(found).toBeNull();
  });

  it("retorna null quando não encontra correspondência em nome, codigoSlug nem alias", () => {
    const found = resolveTransportadora("Transportadora Inexistente", transportadoras);
    expect(found).toBeNull();
  });

  it("prioriza codigoSlug sobre nome e alias quando há ambiguidade proposital", () => {
    // Cenário artificial: o alias de "t2" é igual ao codigoSlug de "t1".
    // A ordem documentada é codigoSlug -> nome -> alias, então deve
    // ganhar t1 (o dono do codigoSlug), não t2 (o dono do alias).
    const ambiguo = [
      { id: "t1", nome: "Transportadora Um", codigoSlug: "ambiguo", aliases: [] },
      { id: "t2", nome: "Transportadora Dois", codigoSlug: "outro-slug", aliases: ["ambiguo"] },
    ];
    expect(resolveTransportadora("ambiguo", ambiguo)?.id).toBe("t1");
  });

  it("prioriza nome oficial sobre alias quando há ambiguidade proposital", () => {
    const ambiguo = [
      { id: "t1", nome: "Nome Ambiguo", codigoSlug: "slug-1", aliases: [] },
      { id: "t2", nome: "Transportadora Dois", codigoSlug: "slug-2", aliases: ["Nome Ambiguo"] },
    ];
    expect(resolveTransportadora("Nome Ambiguo", ambiguo)?.id).toBe("t1");
  });
});
