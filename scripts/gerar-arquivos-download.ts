import archiver from "archiver";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { buildPedidosXlsx } from "../lib/pedidos-xlsx";
import { getBaseCompletaWindowStart } from "../lib/base-completa-window";

const prisma = new PrismaClient();
const BATCH_SIZE = 5_000;
const ADMIN_PART_SIZE = 100_000;
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

const supabaseUrl = envObrigatoria("SUPABASE_URL");
const supabaseKey = envObrigatoria("SUPABASE_SERVICE_ROLE_KEY");
const bucket = envObrigatoria("SUPABASE_EXPORTS_BUCKET");

function storageObjectUrl(storagePath: string, sufixo = "") {
  const partes = [bucket, ...storagePath.split("/")].map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/object/${sufixo}${partes}`;
}

async function upload(storagePath: string, conteudo: Buffer, contentType: string) {
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
  const transportadoras = await prisma.transportadora.findMany({
    select: { id: true, nome: true, codigoSlug: true },
    orderBy: { nome: "asc" },
  });
  for (const transportadora of transportadoras) {
    console.log(`Gerando transportadora: ${transportadora.nome}`);
    const todos = await buscarTodos({ transportadoraId: transportadora.id, dataCriacaoPedido: { gte: inicio } });
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

async function zipar(arquivos: Array<{ caminho: string; nome: string }>, destino: string) {
  await new Promise<void>((resolve, reject) => {
    const saida = createWriteStream(destino);
    const zip = archiver("zip", { zlib: { level: 6 } });
    saida.on("close", resolve);
    saida.on("error", reject);
    zip.on("error", reject);
    zip.pipe(saida);
    for (const arquivo of arquivos) zip.file(arquivo.caminho, { name: arquivo.nome });
    void zip.finalize();
  });
}

async function gerarAdmin(inicio: Date) {
  console.log("Gerando Base Completa administrativa...");
  const temporario = await mkdtemp(path.join(tmpdir(), "forms-transp-export-"));
  try {
    const arquivos: Array<{ caminho: string; nome: string }> = [];
    let cursor: string | undefined;
    let parte: PedidoExportacao[] = [];
    let total = 0;
    let numeroParte = 1;

    const gravarParte = async () => {
      if (!parte.length && arquivos.length) return;
      const nome = `base-completa-parte-${String(numeroParte).padStart(3, "0")}.xlsx`;
      const caminho = path.join(temporario, nome);
      await writeFile(caminho, await buildPedidosXlsx(parte));
      arquivos.push({ caminho, nome });
      parte = [];
      numeroParte += 1;
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

    const caminhoZip = path.join(temporario, "base-completa.zip");
    await zipar(arquivos, caminhoZip);
    const conteudo = await readFile(caminhoZip);
    await publicar({
      chave: "admin:base-completa",
      escopo: "admin",
      nomeArquivo: "base-completa.zip",
      storagePath: "current/admin/base-completa.zip",
      conteudo,
      contentType: "application/zip",
      totalLinhas: total,
      totalPartes: arquivos.length,
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
  await gerarAdmin(inicio);
  console.log("Todos os downloads foram publicados com sucesso.");
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
