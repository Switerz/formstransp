/**
 * Gera pedidos de teste sintéticos (mas com formato real) e envia para o
 * endpoint POST /api/jobs/import-pedidos, exatamente como a rotina Python
 * fará em produção. Use para validar a Fase 2 (ingestão/upsert) contra o
 * ambiente de vocês (com o Prisma Client de verdade, migration já aplicada).
 *
 * Uso:
 *   PEDIDOS_IMPORT_SECRET=<secret> \
 *   PEDIDOS_TEST_TRANSPORTADORA="Log Servicos" \
 *   npx tsx scripts/test-import-pedidos.ts
 *
 * Variáveis de ambiente:
 *   PEDIDOS_IMPORT_URL          default: http://localhost:3000/api/jobs/import-pedidos
 *   PEDIDOS_IMPORT_SECRET       obrigatória - precisa bater com a configurada no servidor
 *   PEDIDOS_TEST_TRANSPORTADORA obrigatória - nome (ou codigoSlug) de uma
 *                                transportadora JÁ CADASTRADA no ambiente,
 *                                para os pedidos serem vinculados de verdade
 *   PEDIDOS_TEST_COUNT          default: 50
 *   PEDIDOS_TEST_RUN_ID         opcional - se definida, usada literalmente
 *                                (sem gerar timestamp) na chave dos 50
 *                                pedidos, ex.: "TESTE-VALIDACAO-01-0001" ...
 *                                "TESTE-VALIDACAO-01-0050". Rodar o script
 *                                duas vezes com o mesmo valor gera os MESMOS
 *                                50 "pedido" - útil para testar o upsert de
 *                                verdade (1ª execução: 50 inseridos; 2ª
 *                                execução: 50 atualizados). Se não definida,
 *                                mantém o comportamento anterior (runId por
 *                                timestamp, pedidos novos a cada execução).
 *   PEDIDOS_TEST_WITH_EDGE_CASES default: false - se "true", acrescenta 2
 *                                pedidos extras (1 inválido, 1 com
 *                                transportadora inexistente) para conferir
 *                                o tratamento de erro. NÃO conta para o
 *                                PEDIDOS_TEST_COUNT.
 */

const IMPORT_URL = process.env.PEDIDOS_IMPORT_URL ?? "http://localhost:3000/api/jobs/import-pedidos";
const SECRET = process.env.PEDIDOS_IMPORT_SECRET;
const TRANSPORTADORA = process.env.PEDIDOS_TEST_TRANSPORTADORA;
const COUNT = Number(process.env.PEDIDOS_TEST_COUNT ?? "50");
const WITH_EDGE_CASES = process.env.PEDIDOS_TEST_WITH_EDGE_CASES === "true";
// Se definido, usado literalmente na chave dos pedidos (sem gerar timestamp),
// garantindo que duas execuções produzam exatamente os mesmos 50 "pedido" -
// necessário para de fato exercitar o upsert (2ª execução = 50 atualizados).
const RUN_ID = process.env.PEDIDOS_TEST_RUN_ID;

const CANAIS = ["LESCENT-ES", "YENZAH-ES", "BY SAMIA-ES", "RITUARIA-ES", "BARBOURS-ES", "AUA-ES", "KOKESHI-ES"];
const CIDADES: Array<[string, string]> = [
  ["São Paulo", "SP"],
  ["Rio de Janeiro", "RJ"],
  ["Belo Horizonte", "MG"],
  ["Curitiba", "PR"],
  ["Recife", "PE"],
  ["Salvador", "BA"],
];

function pad(n: number, size: number) {
  return String(n).padStart(size, "0");
}

function isoDateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

interface PedidoTeste {
  pedido: string;
  nome_destinatario: string;
  canal_vendas: string;
  cidade_destinatario: string;
  uf: string;
  cep_destinatario: string;
  pedido_de_venda: string;
  codigo_rastreio?: string;
  nota_fiscal?: string;
  metodo_envio?: string;
  transportadora: string;
  valor_nota?: number;
  peso_fisico?: number;
  chave_nota?: string;
  data_criacao: string;
  data_entrega?: string | null;
}

function buildPedidos(count: number, transportadora: string, runId: string): PedidoTeste[] {
  const pedidos: PedidoTeste[] = [];
  for (let i = 1; i <= count; i += 1) {
    const [cidade, uf] = CIDADES[i % CIDADES.length];
    const finalizado = i % 5 === 0; // ~20% já finalizados na origem, pra exercitar os dois casos
    pedidos.push({
      pedido: `TESTE-${runId}-${pad(i, 4)}`,
      nome_destinatario: `Cliente Teste ${i}`,
      canal_vendas: CANAIS[i % CANAIS.length],
      cidade_destinatario: cidade,
      uf,
      cep_destinatario: `${pad(10000 + i, 5)}-${pad(i % 1000, 3)}`,
      pedido_de_venda: `PV-TESTE-${pad(i, 4)}`,
      codigo_rastreio: `BR${pad(i, 9)}BR`,
      nota_fiscal: pad(100000 + i, 9),
      metodo_envio: i % 2 === 0 ? "PAC" : "SEDEX",
      transportadora,
      valor_nota: Number((50 + i * 3.37).toFixed(2)),
      peso_fisico: Number((0.2 + i * 0.01).toFixed(3)),
      chave_nota: `3526${pad(i, 40)}`.slice(0, 44),
      data_criacao: isoDateDaysAgo(count - i),
      data_entrega: finalizado ? isoDateDaysAgo(count - i - 2) : null,
    });
  }
  return pedidos;
}

function buildEdgeCases(): PedidoTeste[] {
  return [
    {
      // inválido: falta cep_destinatario
      pedido: "TESTE-EDGE-SEM-CEP",
      nome_destinatario: "Edge Case Inválido",
      canal_vendas: "LESCENT-ES",
      cidade_destinatario: "São Paulo",
      uf: "SP",
      cep_destinatario: "",
      pedido_de_venda: "PV-EDGE-001",
      transportadora: "Log Servicos",
      data_criacao: isoDateDaysAgo(1),
    },
    {
      // transportadora não cadastrada
      pedido: "TESTE-EDGE-TRANSPORTADORA-FANTASMA",
      nome_destinatario: "Edge Case Transportadora",
      canal_vendas: "LESCENT-ES",
      cidade_destinatario: "São Paulo",
      uf: "SP",
      cep_destinatario: "01311-000",
      pedido_de_venda: "PV-EDGE-002",
      transportadora: "Transportadora Que Certamente Não Existe Aqui",
      data_criacao: isoDateDaysAgo(1),
    },
  ];
}

async function main() {
  if (!SECRET) {
    console.error("Defina PEDIDOS_IMPORT_SECRET (mesmo valor configurado no servidor).");
    process.exit(1);
  }
  if (!TRANSPORTADORA) {
    console.error(
      "Defina PEDIDOS_TEST_TRANSPORTADORA com o nome (ou codigoSlug) de uma transportadora já cadastrada no ambiente.",
    );
    process.exit(1);
  }

  const runId = RUN_ID && RUN_ID.trim() !== "" ? RUN_ID.trim() : Date.now().toString(36).toUpperCase();
  console.log(
    RUN_ID && RUN_ID.trim() !== ""
      ? `Usando PEDIDOS_TEST_RUN_ID="${runId}" (fixo - pedidos idênticos entre execuções).`
      : `PEDIDOS_TEST_RUN_ID não definido - gerando runId automático "${runId}" (pedidos novos a cada execução).`,
  );

  const pedidos = buildPedidos(COUNT, TRANSPORTADORA, runId);
  if (WITH_EDGE_CASES) pedidos.push(...buildEdgeCases());

  console.log(`Enviando ${pedidos.length} pedido(s) para ${IMPORT_URL} ...`);

  const response = await fetch(IMPORT_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-pedidos-import-secret": SECRET,
    },
    body: JSON.stringify({ pedidos }),
  });

  const body = await response.json();
  console.log(`\nStatus HTTP: ${response.status}`);
  console.log(JSON.stringify(body, null, 2));

  if (response.status >= 500 || response.status === 401 || response.status === 400) {
    console.error("\nRequisição falhou de forma inesperada (ver status acima).");
    process.exit(1);
  }

  console.log("\nDica: rode o mesmo comando de novo - os pedidos já existentes devem ir para 'atualizados', não 'inseridos'.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
