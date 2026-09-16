"use server";

import { prisma } from "@/lib/prisma";
import { requireCarrierUser } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/request-security";
import { startOfLocalDay } from "@/lib/dates";
import { readXlsxTable } from "@/lib/xlsx-table-reader";
import {
  normalizarColunasLinha,
  processarLinhaDevolucao,
  type PedidoAtualDevolucao,
  type ResultadoLinha,
} from "@/lib/pedidos-devolucao-processar";

export interface DevolucaoResumo {
  totalLinhas: number;
  aplicados: number;
  semAlteracao: number;
  erros: number;
  pedidosNaoEncontrados: number;
  pedidosDeOutraTransportadora: number;
  detalhes: ResultadoLinha[];
  erroSistema?: string;
  arquivoNome?: string;
  loteAtual?: number;
  totalLotes?: number;
}

const TAMANHO_LOTE_CONSULTA = 2_000;
const TAMANHO_LOTE_DEVOLUCAO = 25;
const MAX_DETALHES_RETORNO = 250;

function adicionarDetalhe(resumo: DevolucaoResumo, detalhe: ResultadoLinha) {
  if (resumo.detalhes.length < MAX_DETALHES_RETORNO) {
    resumo.detalhes.push(detalhe);
  }
}

function linhaVazia(linha: number, pedido: string, status: ResultadoLinha["status"], mensagem?: string): ResultadoLinha {
  return {
    linha,
    pedido,
    status,
    errosValidacao: mensagem ? [{ linha, coluna: "Pedido", valor: pedido, mensagem }] : [],
    violacoesProtegidas: [],
    tentativasBloqueadas: [],
    alteracoesAplicadas: [],
    updateData: {},
  };
}

/**
 * Recebe o XLSX de devolução da transportadora autenticada (sessão via
 * requireCarrierUser - NUNCA aceita transportadoraId vindo do formulário).
 * Para cada linha: identifica o pedido pela chave, confirma que pertence à
 * transportadora da sessão, valida e aplica somente os campos operacionais
 * permitidos (núcleo puro em lib/pedidos-devolucao-processar.ts). Tentativas
 * de alterar campo protegido ou reescrever campo operacional já respondido
 * são bloqueadas e registradas em PedidoFieldChangeAttempt.
 */
export async function uploadDevolucaoTransportadora(formData: FormData): Promise<DevolucaoResumo> {
  let etapa = "seguranca da requisicao";

  try {
    await assertSameOrigin();

    etapa = "autenticacao da transportadora";
    const user = await requireCarrierUser("/portal/minha-base");

  const loteJson = formData.get("loteJson");
  let arquivoNome = String(formData.get("arquivoNome") ?? "").trim();
  const loteAtual = Number(formData.get("loteAtual") ?? 1);
  const totalLotes = Number(formData.get("totalLotes") ?? 1);
  const linhaInicial = Number(formData.get("linhaInicial") ?? 2);
  const ultimoLote = String(formData.get("ultimoLote") ?? "false") === "true";

  let rows: Record<string, unknown>[];

  if (typeof loteJson === "string" && loteJson) {
    etapa = "leitura do lote enviado";
    const parsed = JSON.parse(loteJson) as unknown;
    if (!Array.isArray(parsed)) throw new Error("O lote enviado é inválido.");
    rows = parsed as Record<string, unknown>[];
  } else {
    const file = formData.get("arquivo");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Selecione um arquivo .xlsx preenchido antes de enviar.");
    }
    arquivoNome = file.name;

    etapa = "leitura do arquivo enviado";
    const buffer = Buffer.from(await file.arrayBuffer());

    etapa = "leitura da planilha XLSX";
    ({ rows } = await readXlsxTable(buffer));
  }

  const resumo: DevolucaoResumo = {
    totalLinhas: rows.length,
    aplicados: 0,
    semAlteracao: 0,
    erros: 0,
    pedidosNaoEncontrados: 0,
    pedidosDeOutraTransportadora: 0,
    detalhes: [],
    arquivoNome: arquivoNome || undefined,
    loteAtual,
    totalLotes,
  };

  const pedidosChave = Array.from(
    new Set(
      rows
        .map((row) => {
          const normalizado = normalizarColunasLinha(row);
          return String(normalizado["Pedido"] ?? "").trim();
        })
        .filter(Boolean),
    ),
  );

  etapa = "consulta dos pedidos no banco";

  const pedidosDb = [];
  for (let offset = 0; offset < pedidosChave.length; offset += TAMANHO_LOTE_CONSULTA) {
    const lote = pedidosChave.slice(offset, offset + TAMANHO_LOTE_CONSULTA);
    const encontrados = await prisma.pedido.findMany({
      where: { pedido: { in: lote } },
      include: { transportadora: { select: { nome: true } } },
    });
    pedidosDb.push(...encontrados);
  }

  const pedidosPorChave = new Map(
    pedidosDb.map((pedido) => [pedido.pedido, pedido]),
  );

  const tentativasParaCriar = [];
  const atualizacoes: Array<{
    id: string;
    data: Parameters<typeof prisma.pedido.update>[0]["data"];
  }> = [];

  etapa = "validacao e processamento das linhas";

  for (let index = 0; index < rows.length; index += 1) {
    const linha = linhaInicial + index;
    const normalizado = normalizarColunasLinha(rows[index]);
    const pedidoChave = String(normalizado["Pedido"] ?? "").trim();

    if (!pedidoChave) {
      resumo.erros += 1;
      adicionarDetalhe(resumo, linhaVazia(linha, "", "erro_validacao", "Coluna Pedido ausente ou vazia."));
      continue;
    }

    const pedidoDb = pedidosPorChave.get(pedidoChave);

    if (!pedidoDb) {
      resumo.pedidosNaoEncontrados += 1;
      adicionarDetalhe(resumo, linhaVazia(linha, pedidoChave, "pedido_nao_encontrado"));
      continue;
    }

    // TESTE 9: pedido de outra transportadora - rejeitado sem detalhar para quem pertence.
    if (pedidoDb.transportadoraId !== user.transportadoraId) {
      resumo.pedidosDeOutraTransportadora += 1;
      adicionarDetalhe(resumo, linhaVazia(linha, pedidoChave, "pedido_de_outra_transportadora"));
      continue;
    }

    const pedidoAtual: PedidoAtualDevolucao = {
      id: pedidoDb.id,
      pedido: pedidoDb.pedido,
      transportadoraId: pedidoDb.transportadoraId,
      protegidosAtuais: {
        "Nome do Destinatário": pedidoDb.nomeDestinatario,
        "Canal de Vendas": pedidoDb.canalVendas,
        "Cidade do Destinatário": pedidoDb.cidadeDestinatario,
        UF: pedidoDb.uf,
        "CEP do destinatário": pedidoDb.cepDestinatario,
        "Pedido de Venda": pedidoDb.pedidoDeVenda,
        Pedido: pedidoDb.pedido,
        "Código de rastreio": pedidoDb.codigoRastreio,
        "Nota Fiscal": pedidoDb.notaFiscal,
        "Método de envio": pedidoDb.metodoEnvio,
        Transportadora: pedidoDb.transportadora.nome,
        "Valor da Nota": pedidoDb.valorNota,
        "Peso fisico": pedidoDb.pesoFisico,
        "Chave da Nota": pedidoDb.chaveNota,
        "Data Criação": pedidoDb.dataCriacaoPedido,
        "Data Entrega Origem": pedidoDb.dataEntregaOrigem,
        "Previsão Entrega Cliente": pedidoDb.previsaoEntregaClienteOrigem,
        "Previsão Entrega Transportadora": pedidoDb.previsaoEntregaTransportadoraOrigem,
      },
      dataColetaProcessamento: pedidoDb.dataColetaProcessamento,
      dataPrevisao: pedidoDb.dataPrevisao,
      prazoEntregaDiasUteis: pedidoDb.prazoEntregaDiasUteis,
      dataEntrega: pedidoDb.dataEntrega,
      statusAtual: pedidoDb.statusAtual,
      ocorrencia: pedidoDb.ocorrencia,
      motivoDevolucao: pedidoDb.motivoDevolucao,
      slaStatus: pedidoDb.slaStatus,
      justificativaAtraso: pedidoDb.justificativaAtraso,
      novaDataPrevisao: pedidoDb.novaDataPrevisao,
      dataResolucaoDevolucao: pedidoDb.dataResolucaoDevolucao,
    };

    const resultado = processarLinhaDevolucao(rows[index], pedidoAtual, linha);
    adicionarDetalhe(resumo, resultado);

    if (resultado.status === "erro_validacao") resumo.erros += 1;
    else if (resultado.status === "sem_alteracao") resumo.semAlteracao += 1;
    else resumo.aplicados += 1;

    // Registra toda tentativa bloqueada (protegida OU operacional já
    // respondida) em PedidoFieldChangeAttempt - nunca descartada em silêncio.
    const tentativas = [
      ...resultado.violacoesProtegidas.map((v) => ({ ...v, tipo: "campo_protegido" as const })),
      ...resultado.tentativasBloqueadas.map((v) => ({ ...v, tipo: "campo_ja_respondido" as const })),
    ];
    for (const tentativa of tentativas) {
      tentativasParaCriar.push({
        pedidoId: pedidoDb.id,
        transportadoraId: user.transportadoraId!,
        userId: user.id,
        campo: tentativa.campo,
        valorAtual: tentativa.antes === null || tentativa.antes === undefined ? null : String(tentativa.antes),
        valorTentado: tentativa.depois === null || tentativa.depois === undefined ? null : String(tentativa.depois),
        status: "blocked",
      });
    }

    if (Object.keys(resultado.updateData).length > 0) {
      atualizacoes.push({
        id: pedidoDb.id,
        data: { ...resultado.updateData, operacionalAtualizadoEm: new Date() },
      });
    }
  }

  etapa = "registro das tentativas bloqueadas";

  if (tentativasParaCriar.length > 0) {
    await prisma.pedidoFieldChangeAttempt.createMany({
      data: tentativasParaCriar,
    });
  }

  etapa = "atualizacao dos pedidos no banco";

  for (let offset = 0; offset < atualizacoes.length; offset += TAMANHO_LOTE_DEVOLUCAO) {
    const lote = atualizacoes.slice(offset, offset + TAMANHO_LOTE_DEVOLUCAO);

    await prisma.$transaction(
      lote.map((item) =>
        prisma.pedido.update({
          where: { id: item.id },
          data: item.data,
        }),
      ),
    );
  }

  etapa = "registro do log da devolucao";

  let resumoFinal = resumo;
  const acumuladoJson = formData.get("resumoAcumuladoJson");
  if (ultimoLote && typeof acumuladoJson === "string" && acumuladoJson) {
    const anterior = JSON.parse(acumuladoJson) as DevolucaoResumo;
    resumoFinal = {
      ...resumo,
      totalLinhas: anterior.totalLinhas + resumo.totalLinhas,
      aplicados: anterior.aplicados + resumo.aplicados,
      semAlteracao: anterior.semAlteracao + resumo.semAlteracao,
      erros: anterior.erros + resumo.erros,
      pedidosNaoEncontrados: anterior.pedidosNaoEncontrados + resumo.pedidosNaoEncontrados,
      pedidosDeOutraTransportadora:
        anterior.pedidosDeOutraTransportadora + resumo.pedidosDeOutraTransportadora,
      detalhes: [...anterior.detalhes, ...resumo.detalhes].slice(0, MAX_DETALHES_RETORNO),
    };
  }

  if (!loteJson || ultimoLote) await prisma.automationLog.create({
    data: {
      transportadoraId: user.transportadoraId,
      dataReport: startOfLocalDay(new Date()),
      tipo: "pedidos_devolucao",
      status: resumoFinal.erros > 0 || resumoFinal.pedidosNaoEncontrados > 0 || resumoFinal.pedidosDeOutraTransportadora > 0 ? "error" : "success",
      mensagem: `Devolução${arquivoNome ? ` ${arquivoNome}` : ""} de ${user.transportadoraId}: ${resumoFinal.totalLinhas} linha(s), ${resumoFinal.aplicados} aplicada(s), ${resumoFinal.semAlteracao} sem alteração, ${resumoFinal.erros} erro(s), ${resumoFinal.pedidosNaoEncontrados} não encontrado(s), ${resumoFinal.pedidosDeOutraTransportadora} de outra transportadora.`,
      payload: JSON.stringify({ ...resumoFinal, detalhesLimitados: resumoFinal.totalLinhas > resumoFinal.detalhes.length }),
    },
  });

  // Cada chamada em lote devolve somente o próprio lote. A interface soma os
  // resultados progressivamente; o log final usa resumoFinal acima.
  return resumo;
  } catch (err) {
    console.error(`[uploadDevolucaoTransportadora] Falha em: ${etapa}`, err);

    return {
      totalLinhas: 0,
      aplicados: 0,
      semAlteracao: 0,
      erros: 1,
      pedidosNaoEncontrados: 0,
      pedidosDeOutraTransportadora: 0,
      detalhes: [],
      erroSistema: `Falha na etapa: ${etapa}.`,
    };
  }
}
