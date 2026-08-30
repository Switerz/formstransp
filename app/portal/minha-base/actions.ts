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
  await assertSameOrigin();
  const user = await requireCarrierUser("/portal/minha-base");

  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecione um arquivo .xlsx preenchido antes de enviar.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows } = await readXlsxTable(buffer);

  const resumo: DevolucaoResumo = {
    totalLinhas: rows.length,
    aplicados: 0,
    semAlteracao: 0,
    erros: 0,
    pedidosNaoEncontrados: 0,
    pedidosDeOutraTransportadora: 0,
    detalhes: [],
  };

  for (let index = 0; index < rows.length; index += 1) {
    const linha = index + 2; // linha 1 = cabeçalho
    const normalizado = normalizarColunasLinha(rows[index]);
    const pedidoChave = String(normalizado["Pedido"] ?? "").trim();

    if (!pedidoChave) {
      resumo.erros += 1;
      resumo.detalhes.push(linhaVazia(linha, "", "erro_validacao", "Coluna Pedido ausente ou vazia."));
      continue;
    }

    const pedidoDb = await prisma.pedido.findUnique({
      where: { pedido: pedidoChave },
      include: { transportadora: { select: { nome: true } } },
    });

    if (!pedidoDb) {
      resumo.pedidosNaoEncontrados += 1;
      resumo.detalhes.push(linhaVazia(linha, pedidoChave, "pedido_nao_encontrado"));
      continue;
    }

    // TESTE 9: pedido de outra transportadora - rejeitado sem detalhar para quem pertence.
    if (pedidoDb.transportadoraId !== user.transportadoraId) {
      resumo.pedidosDeOutraTransportadora += 1;
      resumo.detalhes.push(linhaVazia(linha, pedidoChave, "pedido_de_outra_transportadora"));
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
    resumo.detalhes.push(resultado);

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
      await prisma.pedidoFieldChangeAttempt.create({
        data: {
          pedidoId: pedidoDb.id,
          transportadoraId: user.transportadoraId!,
          userId: user.id,
          campo: tentativa.campo,
          valorAtual: tentativa.antes === null || tentativa.antes === undefined ? null : String(tentativa.antes),
          valorTentado: tentativa.depois === null || tentativa.depois === undefined ? null : String(tentativa.depois),
          status: "blocked",
        },
      });
    }

    if (Object.keys(resultado.updateData).length > 0) {
      await prisma.pedido.update({
        where: { id: pedidoDb.id },
        data: { ...resultado.updateData, operacionalAtualizadoEm: new Date() },
      });
    }
  }

  await prisma.automationLog.create({
    data: {
      transportadoraId: user.transportadoraId,
      dataReport: startOfLocalDay(new Date()),
      tipo: "pedidos_devolucao",
      status: resumo.erros > 0 || resumo.pedidosNaoEncontrados > 0 || resumo.pedidosDeOutraTransportadora > 0 ? "error" : "success",
      mensagem: `Devolução de ${user.transportadoraId}: ${resumo.totalLinhas} linha(s), ${resumo.aplicados} aplicada(s), ${resumo.semAlteracao} sem alteração, ${resumo.erros} erro(s), ${resumo.pedidosNaoEncontrados} não encontrado(s), ${resumo.pedidosDeOutraTransportadora} de outra transportadora.`,
      payload: JSON.stringify(resumo),
    },
  });

  return resumo;
}
