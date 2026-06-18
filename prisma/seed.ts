import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const oneDay = 24 * 60 * 60 * 1000;
const ufRows = ["CE", "RN", "PB", "PE", "BA"] as const;

type CarrierSeed = {
  nome: string;
  cnpj: string;
  codigoSlug: string;
  tokenPublicoFormulario: string;
  emailsDestinatarios: string;
  ativo?: boolean;
  basePedidos: number;
  crescimentoDiario: number;
  slaBase: number;
  slaOscilacao: number;
  skipDaysAgo?: number[];
  observacaoHoje?: string;
};

const carriers: CarrierSeed[] = [
  {
    nome: "Transportes Exemplo Ltda",
    cnpj: "12.345.678/0001-90",
    codigoSlug: "transportes-exemplo",
    tokenPublicoFormulario: "demo-token-transportes-exemplo",
    emailsDestinatarios: "operacoes@example.com;logistica@example.com",
    basePedidos: 620,
    crescimentoDiario: 18,
    slaBase: 0.92,
    slaOscilacao: 0.012,
    observacaoHoje: "Ponto de atenção em entregas do interior por concentração de tentativas no período da tarde.",
  },
  {
    nome: "Nordeste Rapido",
    cnpj: "23.456.789/0001-01",
    codigoSlug: "nordeste-rapido",
    tokenPublicoFormulario: "demo-token-nordeste-rapido",
    emailsDestinatarios: "malha@example.com",
    basePedidos: 780,
    crescimentoDiario: 10,
    slaBase: 0.948,
    slaOscilacao: 0.008,
    skipDaysAgo: [0, 6],
  },
  {
    nome: "Rota Forte Log",
    cnpj: "34.567.890/0001-12",
    codigoSlug: "rota-forte-log",
    tokenPublicoFormulario: "demo-token-rota-forte-log",
    emailsDestinatarios: "qualidade@example.com",
    basePedidos: 510,
    crescimentoDiario: 22,
    slaBase: 0.887,
    slaOscilacao: 0.02,
    skipDaysAgo: [3, 9],
    observacaoHoje: "Atrasos concentrados em BA e PE por reforço de rota ainda em andamento.",
  },
  {
    nome: "Litoral Cargo",
    cnpj: "45.678.901/0001-23",
    codigoSlug: "litoral-cargo",
    tokenPublicoFormulario: "demo-token-litoral-cargo",
    emailsDestinatarios: "litoral@example.com",
    basePedidos: 430,
    crescimentoDiario: 14,
    slaBase: 0.916,
    slaOscilacao: 0.014,
    skipDaysAgo: [0, 1, 8],
  },
  {
    nome: "Arquivo Inativo Transportes",
    cnpj: "56.789.012/0001-34",
    codigoSlug: "arquivo-inativo",
    tokenPublicoFormulario: "demo-token-arquivo-inativo",
    emailsDestinatarios: "arquivo@example.com",
    ativo: false,
    basePedidos: 260,
    crescimentoDiario: 4,
    slaBase: 0.905,
    slaOscilacao: 0.01,
    skipDaysAgo: [0, 1, 2, 3, 4, 5, 6],
  },
];

function atLocalDate(daysAgo: number) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
}

function boundedSla(value: number) {
  return Math.min(0.98, Math.max(0.84, value));
}

async function createSubmission(carrier: CarrierSeed, transportadoraId: string, daysAgo: number) {
  const dataReport = atLocalDate(daysAgo);
  const ageIndex = 13 - daysAgo;
  const totalPedidos = carrier.basePedidos + ageIndex * carrier.crescimentoDiario;
  const sla = boundedSla(carrier.slaBase + ((ageIndex % 5) - 2) * carrier.slaOscilacao);
  const totalNoPrazo = Math.round(totalPedidos * sla);
  const totalForaDoPrazo = totalPedidos - totalNoPrazo;
  const totalEntregue = Math.round(totalPedidos * (0.86 + (ageIndex % 3) * 0.015));
  const totalEmAberto = Math.max(0, totalPedidos - totalEntregue - Math.round(totalPedidos * 0.03));
  const totalTentativaInsucesso = Math.round(totalPedidos * (0.026 + (ageIndex % 4) * 0.004));
  const totalDevolucao = Math.round(totalPedidos * (0.012 + (ageIndex % 3) * 0.003));
  const totalCancelado = Math.max(0, totalPedidos - totalEntregue - totalEmAberto - totalTentativaInsucesso - totalDevolucao);
  const totalFinalizado = Math.round(totalPedidos * (0.58 + (ageIndex % 4) * 0.025));
  const finalizadosNoPrazo = Math.round(totalFinalizado * boundedSla(sla + 0.006));

  const submission = await prisma.dailyReportSubmission.create({
    data: {
      transportadoraId,
      dataReport,
      dataResultadoDiaAnterior: new Date(dataReport.getTime() - oneDay),
      dataPreviaDiaAtual: dataReport,
      status: "submitted",
      submittedAt: new Date(dataReport.getTime() + (8 + (ageIndex % 3)) * 60 * 60 * 1000),
      submittedByName: "Operação Demo",
      submittedByEmail: "operacao.demo@example.com",
      observacoes: daysAgo === 0 ? carrier.observacaoHoje ?? null : null,
      previousDayMetrics: {
        create: {
          totalPedidos,
          totalEntregue,
          totalEmAberto,
          totalTentativaInsucesso,
          totalDevolucao,
          totalCancelado,
          totalNoPrazo,
          totalForaDoPrazo,
        },
      },
      currentDayPreviewMetrics: {
        create: {
          totalPedidos: Math.round(totalPedidos * 0.76),
          totalFinalizado,
          totalEmAberto: Math.round(totalPedidos * 0.28),
          totalEntregue: Math.round(totalFinalizado * 0.9),
          totalTentativaInsucesso: Math.round(totalPedidos * 0.02),
          totalDevolucao: Math.round(totalPedidos * 0.01),
          totalCancelado: Math.round(totalPedidos * 0.004),
          finalizadosNoPrazo,
          finalizadosForaDoPrazo: totalFinalizado - finalizadosNoPrazo,
        },
      },
    },
  });

  const totalPorUf = Math.floor(totalPedidos / ufRows.length);

  for (const [index, uf] of ufRows.entries()) {
    const ufSla = boundedSla(sla + (index - 2) * 0.007);
    const total = uf === "BA" ? totalPedidos - totalPorUf * 4 : totalPorUf;
    const dentroDoPrazo = Math.round(total * ufSla);
    await prisma.previousDayUFMetric.create({
      data: {
        submissionId: submission.id,
        uf,
        dentroDoPrazo,
        foraDoPrazo: total - dentroDoPrazo,
        total,
      },
    });
  }
}

async function main() {
  await prisma.automationLog.deleteMany();
  await prisma.previousDayUFMetric.deleteMany();
  await prisma.dailyCurrentDayPreviewMetrics.deleteMany();
  await prisma.dailyPreviousDayMetrics.deleteMany();
  await prisma.dailyReportSubmission.deleteMany();
  await prisma.appUser.deleteMany();
  await prisma.transportadora.deleteMany();

  const transportadorasCriadas: Record<string, string> = {};

  for (const carrier of carriers) {
    const transportadora = await prisma.transportadora.create({
      data: {
        nome: carrier.nome,
        cnpj: carrier.cnpj,
        codigoSlug: carrier.codigoSlug,
        ativo: carrier.ativo ?? true,
        origem: "demo",
        tokenPublicoFormulario: carrier.tokenPublicoFormulario,
        emailsDestinatarios: carrier.emailsDestinatarios,
      },
    });
    transportadorasCriadas[carrier.codigoSlug] = transportadora.id;

    for (let daysAgo = 13; daysAgo >= 0; daysAgo -= 1) {
      if (carrier.skipDaysAgo?.includes(daysAgo)) continue;
      await createSubmission(carrier, transportadora.id, daysAgo);
    }
  }

  await prisma.appUser.createMany({
    data: [
      {
        nome: "Administrador Operacional",
        email: "admin.forms-transp@example.com",
        role: "internal_admin",
      },
      {
        nome: "Analista de Logística",
        email: "analista.forms-transp@example.com",
        role: "internal_viewer",
      },
      {
        nome: "Operação Nordeste Rápido",
        email: "operacao.nordeste@example.com",
        role: "carrier_admin",
        transportadoraId: transportadorasCriadas["nordeste-rapido"],
      },
      {
        nome: "Operação Litoral Cargo",
        email: "operacao.litoral@example.com",
        role: "carrier_operator",
        transportadoraId: transportadorasCriadas["litoral-cargo"],
      },
    ],
  });

  const today = atLocalDate(0);
  const transportadoras = await prisma.transportadora.findMany({ orderBy: { nome: "asc" } });
  for (const transportadora of transportadoras) {
    const hasReportToday = await prisma.dailyReportSubmission.findUnique({
      where: { transportadoraId_dataReport: { transportadoraId: transportadora.id, dataReport: today } },
    });
    await prisma.automationLog.create({
      data: {
        transportadoraId: transportadora.id,
        dataReport: today,
        tipo: "scheduled_report",
        status: hasReportToday ? "success" : "pending",
        mensagem: hasReportToday
          ? "Seed: relatório de demonstração recebido em modo dry-run."
          : "Seed: relatório ainda pendente para demonstrar a fila operacional.",
        payload: JSON.stringify({ dryRun: true, seeded: true }),
      },
    });
  }

  console.log(`Seed concluido: ${carriers.length} transportadoras e calendario operacional populado.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
