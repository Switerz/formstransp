"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireInternalAdmin } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/request-security";
import { startOfLocalDay } from "@/lib/dates";
import { readXlsxTable } from "@/lib/xlsx-table-reader";
import { type TransportadoraLookupEntry } from "@/lib/pedidos-parsing";
import {
  normalizarColunasLinha,
  processarLinhaDevolucao,
  type PedidoAtualDevolucao,
  type ResultadoLinha,
} from "@/lib/pedidos-devolucao-processar";
import { prepararLinhasBaseOriginal, gravarLoteBaseOriginal } from "@/lib/base-original-processar";
import type { DevolucaoResumo } from "@/app/portal/minha-base/actions";

// ---------------------------------------------------------------------------
// A) BASE ORIGINAL - sÃ³ existe aqui (acesso interno). NÃ£o existe em nenhum
// outro lugar do projeto: a base de origem sempre foi 100% automÃ¡tica via
// Intelipost (POST /api/jobs/import-pedidos -> lib/pedidos.ts, nÃ£o tocado).
// Esta action Ã© um caminho MANUAL adicional, exclusivo de internal_admin,
// para os mesmos 14 campos de origem - nunca mexe em campo operacional.
// ---------------------------------------------------------------------------

export interface BaseOriginalResumo {
  totalLinhas: number;
  inseridos: number;
  atualizados: number;
  erros: Array<{ linha: number; pedido: string; motivo: string }>;
}

/**
 * Upload manual da Base Original - exclusivo de internal_admin
 * (requireInternalAdmin, verificado no servidor - nunca no frontend).
 * Mesma semÃ¢ntica de upsert do job automÃ¡tico da Intelipost (atualiza
 * SOMENTE os 14 campos de origem; nunca toca em campo operacional
 * preenchido pela transportadora; chave Ãºnica Ã© "Pedido"), mas por
 * arquivo em vez de payload JSON da API. lib/pedidos.ts e a rota
 * /api/jobs/import-pedidos nÃ£o foram alterados nem chamados por aqui -
 * fluxo deliberadamente separado para nÃ£o arriscar o caminho automÃ¡tico
 * jÃ¡ homologado.
 */
export async function uploadBaseOriginalInterna(formData: FormData): Promise<BaseOriginalResumo> {
  await assertSameOrigin();
  await requireInternalAdmin("/base-completa");

  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecione um arquivo .xlsx preenchido antes de enviar.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows } = await readXlsxTable(buffer);

  const transportadorasRaw = await prisma.transportadora.findMany({
    select: { id: true, nome: true, codigoSlug: true, aliases: { select: { alias: true } } },
  });
  const transportadoras: TransportadoraLookupEntry[] = transportadorasRaw.map((t: (typeof transportadorasRaw)[number]) => ({
    id: t.id,
    nome: t.nome,
    codigoSlug: t.codigoSlug,
    aliases: t.aliases.map((a: { alias: string }) => a.alias),
  }));

  const { preparados, erros: errosParsing } = prepararLinhasBaseOriginal(rows, transportadoras);
  const { inseridos, atualizados, erros: errosGravacao } = await gravarLoteBaseOriginal(preparados);

  const resumo: BaseOriginalResumo = {
    totalLinhas: rows.length,
    inseridos,
    atualizados,
    erros: [...errosParsing, ...errosGravacao],
  };

  await prisma.automationLog.create({
    data: {
      transportadoraId: null,
      dataReport: startOfLocalDay(new Date()),
      // tipo prÃ³prio (nÃ£o "pedidos_import"): esta Ã© uma carga MANUAL pelo
      // admin, nÃ£o o job automÃ¡tico da Intelipost - mantidas
      // distinguÃ­veis de propÃ³sito, inclusive para o indicador "Base
      // atualizada hÃ¡ X horas" (que sÃ³ considera tipo="pedidos_import").
      tipo: "pedidos_base_original_manual",
      status: resumo.erros.length > 0 ? "error" : "success",
      mensagem: `Base original (upload manual interno): ${resumo.totalLinhas} linha(s), ${resumo.inseridos} inserida(s), ${resumo.atualizados} atualizada(s), ${resumo.erros.length} erro(s).`,
      payload: JSON.stringify(resumo),
    },
  });

  return resumo;
}

// ---------------------------------------------------------------------------
// B) DEVOLUÃ‡ÃƒO EM NOME DE UMA TRANSPORTADORA ESCOLHIDA (acesso interno) -
// reaproveita o MESMO nÃºcleo puro de app/portal/minha-base/actions.ts
// (processarLinhaDevolucao/normalizarColunasLinha), sÃ³ troca COMO a
// transportadora Ã© determinada: em vez de user.transportadoraId (sessÃ£o),
// vem de um campo do formulÃ¡rio, validado contra o cadastro real e
// protegido por requireInternalAdmin. app/portal/minha-base/actions.ts
// NÃƒO foi alterado - a transportadora continua isolada por
// requireCarrierUser exatamente como antes.
// ---------------------------------------------------------------------------

export async function uploadDevolucaoInterna(formData: FormData): Promise<DevolucaoResumo> {
  await assertSameOrigin();
  const user = await requireInternalAdmin("/base-completa");

  const transportadoraId = String(formData.get("transportadoraId") ?? "").trim();
  if (!transportadoraId) {
    throw new Error("Selecione a transportadora Ã  qual esta devoluÃ§Ã£o pertence.");
  }
  const transportadoraAlvo = await prisma.transportadora.findUnique({ where: { id: transportadoraId } });
  if (!transportadoraAlvo) {
    throw new Error("Transportadora selecionada nÃ£o encontrada.");
  }

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

  const pedidosDb = await prisma.pedido.findMany({
    where: {
      pedido: { in: pedidosChave },
    },
    include: {
      transportadora: { select: { nome: true } },
    },
  });

  const pedidosPorChave = new Map(
    pedidosDb.map((pedido) => [pedido.pedido, pedido]),
  );

  const tentativasParaCriar: Prisma.PedidoFieldChangeAttemptCreateManyInput[] = [];
  const atualizacoes: Array<{
    id: string;
    data: Prisma.PedidoUpdateInput;
  }> = [];

  for (let index = 0; index < rows.length; index += 1) {
    const linha = index + 2;
    const normalizado = normalizarColunasLinha(rows[index]);
    const pedidoChave = String(normalizado["Pedido"] ?? "").trim();

    if (!pedidoChave) {
      resumo.erros += 1;
      resumo.detalhes.push(linhaVazia(linha, "", "erro_validacao", "Coluna Pedido ausente ou vazia."));
      continue;
    }

    const pedidoDb = pedidosPorChave.get(pedidoChave);

    if (!pedidoDb) {
      resumo.pedidosNaoEncontrados += 1;
      resumo.detalhes.push(linhaVazia(linha, pedidoChave, "pedido_nao_encontrado"));
      continue;
    }

    // Mesma checagem de pertencimento da action da transportadora - aqui a
    // transportadora "alvo" Ã© a escolhida pelo admin no formulÃ¡rio, nÃ£o a
    // da sessÃ£o, mas a regra de rejeitar pedido de outra transportadora Ã©
    // idÃªntica.
    if (pedidoDb.transportadoraId !== transportadoraId) {
      resumo.pedidosDeOutraTransportadora += 1;
      resumo.detalhes.push(linhaVazia(linha, pedidoChave, "pedido_de_outra_transportadora"));
      continue;
    }

    const pedidoAtual: PedidoAtualDevolucao = {
      id: pedidoDb.id,
      pedido: pedidoDb.pedido,
      transportadoraId: pedidoDb.transportadoraId,
      protegidosAtuais: {
        "Nome do DestinatÃ¡rio": pedidoDb.nomeDestinatario,
        "Canal de Vendas": pedidoDb.canalVendas,
        "Cidade do DestinatÃ¡rio": pedidoDb.cidadeDestinatario,
        UF: pedidoDb.uf,
        "CEP do destinatÃ¡rio": pedidoDb.cepDestinatario,
        "Pedido de Venda": pedidoDb.pedidoDeVenda,
        Pedido: pedidoDb.pedido,
        "CÃ³digo de rastreio": pedidoDb.codigoRastreio,
        "Nota Fiscal": pedidoDb.notaFiscal,
        "MÃ©todo de envio": pedidoDb.metodoEnvio,
        Transportadora: pedidoDb.transportadora.nome,
        "Valor da Nota": pedidoDb.valorNota,
        "Peso fisico": pedidoDb.pesoFisico,
        "Chave da Nota": pedidoDb.chaveNota,
        "Data CriaÃ§Ã£o": pedidoDb.dataCriacaoPedido,
        "Data Entrega Origem": pedidoDb.dataEntregaOrigem,
        "PrevisÃ£o Entrega Cliente": pedidoDb.previsaoEntregaClienteOrigem,
        "Data Despacho": pedidoDb.dataDespacho,
        "PrevisÃ£o Entrega Transportadora": pedidoDb.previsaoEntregaTransportadoraOrigem,
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

    const tentativas = [
      ...resultado.violacoesProtegidas.map((v) => ({ ...v, tipo: "campo_protegido" as const })),
      ...resultado.tentativasBloqueadas.map((v) => ({ ...v, tipo: "campo_ja_respondido" as const })),
    ];
    for (const tentativa of tentativas) {
      tentativasParaCriar.push({
        pedidoId: pedidoDb.id,
        transportadoraId,
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

  if (tentativasParaCriar.length > 0) {
    await prisma.pedidoFieldChangeAttempt.createMany({
      data: tentativasParaCriar,
    });
  }

  const TAMANHO_LOTE_DEVOLUCAO = 25;

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

  await prisma.automationLog.create({
    data: {
      transportadoraId,
      dataReport: startOfLocalDay(new Date()),
      tipo: "pedidos_devolucao",
      status: resumo.erros > 0 || resumo.pedidosNaoEncontrados > 0 || resumo.pedidosDeOutraTransportadora > 0 ? "error" : "success",
      mensagem: `DevoluÃ§Ã£o de ${transportadoraAlvo.nome} (enviada por admin interno ${user.username ?? user.id}): ${resumo.totalLinhas} linha(s), ${resumo.aplicados} aplicada(s), ${resumo.semAlteracao} sem alteraÃ§Ã£o, ${resumo.erros} erro(s), ${resumo.pedidosNaoEncontrados} nÃ£o encontrado(s), ${resumo.pedidosDeOutraTransportadora} de outra transportadora.`,
      payload: JSON.stringify(resumo),
    },
  });

  return resumo;
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

