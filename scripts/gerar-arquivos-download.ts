import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { buildPedidosXlsx } from "../lib/pedidos-xlsx";
import { getBaseCompletaWindowStart } from "../lib/base-completa-window";
import { salvarKpiSnapshot } from "../lib/pedidos-kpi-snapshot";

const prisma = new PrismaClient();
const BATCH_SIZE = 5_000;
const ADMIN_PART_SIZE = 100_000;
const ADMIN_MAX_BYTES = 40 * 1024 * 1024;
const SIGNED_URL_SECONDS = 7 * 24 * 60 * 60;

const PEDIDO_SELECT = {
  id: true,
  nomeDestinatario: true,
  canalVendas: true,
  cidadeDestinatario: true,
  uf: true,
  cepDestinatario: true,
  pedidoDeVenda: true,
  pedido: true,
  codigoRastreio: true,
  notaFiscal: true,
  metodoEnvio: true,
  transportadora: { select: { nome: true } },
  valorNota: true,
  pesoFisico: true,
  chaveNota: true,
  dataCriacaoPedido: true,
  dataEntregaOrigem: true,
  previsaoEntregaClienteOrigem: true,
  previsaoEntregaTransportadoraOrigem: true,
  dataDespacho: true,
  previsaoEntregaTransportadoraOriginal: true,
  microStatus: true,
  statusTransportador: true,
  quantidadeOcorrencias: true,
  ultimaOcorrenciaMicro: true,
  dataColetaProcessamento: true,
  dataPrevisao: true,
  prazoEntregaDiasUteis: true,
  dataEntrega: true,
  statusAtual: true,
  ocorrencia: true,
  motivoDevolucao: true,
  slaStatus: true,
  justificativaAtraso: true,
  novaDataPrevisao: true,
  dataResolucaoDevolucao: true,
} satisfies Prisma.PedidoSelect;

type PedidoExportacao = Prisma.PedidoGetPayload<{ select: typeof PEDIDO_SELECT }>;

function envObrigatoria(nome: string) {
  const valor = process.env[nome]?.trim();
  if (!valor) throw new Error(`Variável obrigatória ausente: ${nome}`);
  return valor.replace(/\/$/, "");
}

function storageObjectUrl(storagePath: string, sufixo = "") {
  const supabaseUrl = envObrigatoria("SUPABASE_URL");
  const bucket = envObrigatoria("SUPABASE_EXPORTS_BUCKET");
  const partes = [bucket, ...storagePath.split("/")].map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/object/${sufixo}${partes}`;
}

async function upload(storagePath: string, conteudo: Buffer, contentType: string) {
  const supabaseKey = envObrigatoria("SUPABASE_SERVICE_ROLE_KEY");
  const resposta = await fetch(storageObjectUrl(storagePath), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: new Uint8Array(conteudo),
  });
  if (!resposta.ok) throw new Error(`Falha no upload (${resposta.status}): ${await resposta.text()}`);
}

async function criarLinkAssinado(storagePath: string) {
  const supabaseUrl = envObrigatoria("SUPABASE_URL");
  const supabaseKey = envObrigatoria("SUPABASE_SERVICE_ROLE_KEY");
  const resposta = await fetch(storageObjectUrl(storagePath, "sign/"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS }),
  });
  if (!resposta.ok) throw new Error(`Falha ao assinar link (${resposta.status}): ${await resposta.text()}`);
  const dados = (await resposta.json()) as { signedURL?: string; signedUrl?: string };
  const link = dados.signedURL ?? dados.signedUrl;
  if (!link) throw new Error("Supabase não retornou o link assinado.");
  return link.startsWith("http") ? link : `${supabaseUrl}/storage/v1${link.startsWith("/") ? "" : "/"}${link}`;
}

async function publicar(params: {
  chave: string;
  escopo: "transportadora" | "admin";
  transportadoraId?: string;
  nomeArquivo: string;
  storagePath: string;
  conteudo: Buffer;
  contentType: string;
  totalLinhas: number;
  totalPartes?: number;
}) {
  await upload(params.storagePath, params.conteudo, params.contentType);
  const signedUrl = await criarLinkAssinado(params.storagePath);
  const expiresAt = new Date(Date.now() + SIGNED_URL_SECONDS * 1_000);
  const dados = {
    chave: params.chave,
    escopo: params.escopo,
    transportadoraId: params.transportadoraId,
    nomeArquivo: params.nomeArquivo,
    storagePath: params.storagePath,
    signedUrl,
    expiresAt,
    totalLinhas: params.totalLinhas,
    totalPartes: params.totalPartes ?? 1,
    status: "ready",
    geradoEm: new Date(),
  };
  await prisma.exportacaoArquivo.upsert({
    where: { chave: params.chave },
    create: dados,
    update: dados,
  });
}

async function buscarTodos(where: Prisma.PedidoWhereInput) {
  const todos: PedidoExportacao[] = [];
  let cursor: string | undefined;
  while (true) {
    const lote = await prisma.pedido.findMany({
      where,
      select: PEDIDO_SELECT,
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!lote.length) break;
    todos.push(...lote);
    cursor = lote.at(-1)!.id;
  }
  return todos;
}

function pedidoVisivelTransportadora(pedido: PedidoExportacao) {
  if (!pedido.dataEntregaOrigem) return true;
  const previsao = pedido.previsaoEntregaTransportadoraOrigem;
  return Boolean(previsao && pedido.dataEntregaOrigem > previsao);
}

function slug(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "transportadora";
}

async function gerarTransportadoras(inicio: Date) {
  const somenteSnapshots = process.argv.includes("--snapshots-only");
  const transportadoras = await prisma.transportadora.findMany({
    select: { id: true, nome: true, codigoSlug: true },
    orderBy: { nome: "asc" },
  });
  for (const transportadora of transportadoras) {
    console.log(`Gerando transportadora: ${transportadora.nome}`);
    const todos = await buscarTodos({ transportadoraId: transportadora.id, dataCriacaoPedido: { gte: inicio } });
    await salvarKpiSnapshot(transportadora.id, todos);
    console.log(`  Snapshot de KPIs salvo (${todos.length.toLocaleString("pt-BR")} pedidos).`);
    if (somenteSnapshots) continue;
    const pedidos = todos.filter(pedidoVisivelTransportadora);
    const conteudo = await buildPedidosXlsx(pedidos);
    const identificador = slug(transportadora.codigoSlug || transportadora.nome);
    const nomeArquivo = `base-${identificador}.xlsx`;
    await publicar({
      chave: `transportadora:${transportadora.id}`,
      escopo: "transportadora",
      transportadoraId: transportadora.id,
      nomeArquivo,
      storagePath: `current/transportadoras/${nomeArquivo}`,
      conteudo,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      totalLinhas: pedidos.length,
    });
    console.log(`  ${pedidos.length.toLocaleString("pt-BR")} linhas publicadas.`);
  }
}

const CSV_HEADERS = [
  "Nome do Destinatário", "Canal de Vendas", "Cidade do Destinatário", "UF",
  "CEP do destinatário", "Pedido de Venda", "Pedido", "Código de rastreio",
  "Nota Fiscal", "Método de envio", "Transportadora", "Valor da Nota",
  "Peso fisico", "Chave da Nota", "Data Despacho", "Previsão Entrega Transportadora",
  "DATA COLETA/PROCESSAMENTO", "DATA DE PREVISÃO", "PRAZO DE ENTREGA (DIAS ÚTEIS)",
  "DATA DE ENTREGA", "STATUS ATUAL", "OCORRÊNCIA", "MOTIVO DEVOLUÇÃO",
  "SLA (NO PRAZO/ATRASADO)", "JUSTIFICATIVA DE ATRASO",
  "NOVA DATA DE PREVISÃO (SE ATRASADO)", "DATA EM QUE O PEDIDO FOI RESOLVIDO PARA DEVOLUÇÃO",
];

function celulaCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const texto = valor instanceof Date ? valor.toISOString().slice(0, 10) : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

function linhaCsv(p: PedidoExportacao): string {
  const colunas: unknown[] = [
    p.nomeDestinatario, p.canalVendas, p.cidadeDestinatario, p.uf,
    p.cepDestinatario, p.pedidoDeVenda, p.pedido, p.codigoRastreio,
    p.notaFiscal, p.metodoEnvio, p.transportadora?.nome, p.valorNota,
    p.pesoFisico, p.chaveNota, p.dataDespacho, p.previsaoEntregaTransportadoraOrigem,
    p.dataColetaProcessamento, p.dataPrevisao, p.prazoEntregaDiasUteis,
    p.dataEntrega, p.statusAtual, p.ocorrencia, p.motivoDevolucao,
    p.slaStatus, p.justificativaAtraso, p.novaDataPrevisao, p.dataResolucaoDevolucao,
  ];
  return colunas.map(celulaCsv).join(";") + "\n";
}

async function gerarAdmin(inicio: Date) {
  console.log("Gerando Base Completa administrativa...");
  const temporario = await mkdtemp(path.join(tmpdir(), "forms-transp-export-"));
  try {
    const arquivos: Array<{ caminho: string; nome: string; linhas: number }> = [];
    const versao = Date.now();
    const csvChunks: Array<{ caminho: string; linhas: number }> = [];
    let csvLinhas: string[] = ["\ufeff" + CSV_HEADERS.map(celulaCsv).join(";") + "\n"];
    let csvTamanho = Buffer.byteLength(csvLinhas[0], "utf8");
    let csvQuantidade = 0;
    const salvarCsvChunk = async () => {
      if (!csvQuantidade) return;
      const caminho = path.join(temporario, `csv-${csvChunks.length + 1}.csv`);
      await writeFile(caminho, csvLinhas.join(""), "utf8");
      csvChunks.push({ caminho, linhas: csvQuantidade });
      csvLinhas = [];
      csvTamanho = 0;
      csvQuantidade = 0;
    };
    let cursor: string | undefined;
    let parte: PedidoExportacao[] = [];
    let total = 0;
    const salvarParte = async (pedidos: PedidoExportacao[]): Promise<void> => {
      const numero = arquivos.length + 1;
      const nome = `base-completa-parte-${String(numero).padStart(3, "0")}.xlsx`;
      const caminhoXlsx = path.join(temporario, nome);
      await writeFile(caminhoXlsx, await buildPedidosXlsx(pedidos));
      if ((await stat(caminhoXlsx)).size > ADMIN_MAX_BYTES) {
        await rm(caminhoXlsx, { force: true });
        if (pedidos.length <= 1) throw new Error("Uma única linha ultrapassou o limite da exportação administrativa.");
        const meio = Math.floor(pedidos.length / 2);
        await salvarParte(pedidos.slice(0, meio));
        await salvarParte(pedidos.slice(meio));
        return;
      }
      arquivos.push({ caminho: caminhoXlsx, nome, linhas: pedidos.length });
    };

    const gravarParte = async () => {
      if (!parte.length && arquivos.length) return;
      await salvarParte(parte);
      parte = [];
    };

    while (true) {
      const lote = await prisma.pedido.findMany({
        where: { dataCriacaoPedido: { gte: inicio } },
        select: PEDIDO_SELECT,
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!lote.length) break;
      cursor = lote.at(-1)!.id;
      for (const pedido of lote) {
        const linha = linhaCsv(pedido);
        const tamanho = Buffer.byteLength(linha, "utf8");
        if (csvQuantidade && csvTamanho + tamanho > ADMIN_MAX_BYTES) await salvarCsvChunk();
        csvLinhas.push(linha);
        csvTamanho += tamanho;
        csvQuantidade += 1;
        if (csvQuantidade >= 20_000) await salvarCsvChunk();
      }
      let restantes = lote;
      while (restantes.length) {
        const espaco = ADMIN_PART_SIZE - parte.length;
        parte.push(...restantes.slice(0, espaco));
        restantes = restantes.slice(espaco);
        if (parte.length === ADMIN_PART_SIZE) await gravarParte();
      }
      total += lote.length;
    }
    await gravarParte();
    await salvarCsvChunk();
    // Publica o CSV antes do marcador XLSX principal. O manifesto só oferece
    // os chunks quando todos pertencerem à mesma versão da Base Completa.
    for (const [indice, chunk] of csvChunks.entries()) {
      await publicar({
        chave: `admin:base-completa:csv:parte:${indice + 1}`,
        escopo: "admin",
        nomeArquivo: `base-consolidada-parte-${String(indice + 1).padStart(3, "0")}.csv`,
        storagePath: `current/admin/${versao}/csv/parte-${String(indice + 1).padStart(3, "0")}.csv`,
        conteudo: await readFile(chunk.caminho),
        contentType: "text/csv; charset=utf-8",
        totalLinhas: chunk.linhas,
        totalPartes: csvChunks.length,
      });
    }
    await publicar({
      chave: "admin:base-completa:csv",
      escopo: "admin",
      nomeArquivo: "base-consolidada.csv",
      storagePath: `current/admin/${versao}/csv/manifesto.csv`,
      conteudo: Buffer.from("CSV consolidado: utilize o botao de download do portal.\n"),
      contentType: "text/plain; charset=utf-8",
      totalLinhas: total,
      totalPartes: csvChunks.length,
    });

    // A parte 1 é publicada por último: ela sinaliza que a coleção inteira está pronta.
    for (const [indice, arquivo] of arquivos.entries()) {
      if (indice === 0) continue;
      await publicar({
        chave: `admin:base-completa:parte:${indice + 1}`,
        escopo: "admin",
        nomeArquivo: arquivo.nome,
        storagePath: `current/admin/${versao}/${arquivo.nome}`,
        conteudo: await readFile(arquivo.caminho),
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        totalLinhas: arquivo.linhas,
        totalPartes: arquivos.length,
      });
    }
    const primeira = arquivos[0];
    await publicar({
      chave: "admin:base-completa", escopo: "admin",
      nomeArquivo: primeira.nome,
      storagePath: `current/admin/${versao}/${primeira.nome}`,
      conteudo: await readFile(primeira.caminho),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", totalLinhas: total, totalPartes: arquivos.length,
    });
    console.log(`  ${total.toLocaleString("pt-BR")} linhas em ${arquivos.length} arquivo(s).`);
  } finally {
    await rm(temporario, { recursive: true, force: true });
  }
}

async function main() {
  const inicio = getBaseCompletaWindowStart();
  console.log(`Janela de dados iniciada em ${inicio.toISOString()}.`);
  if (!process.argv.includes("--admin-only")) await gerarTransportadoras(inicio);
  if (!process.argv.includes("--snapshots-only")) await gerarAdmin(inicio);
  console.log("Todos os downloads foram publicados com sucesso.");
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
