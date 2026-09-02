import { prisma } from "@/lib/prisma";
import { startOfLocalDay } from "@/lib/dates";
import { parseIntelipostPedidoRow, resolveTransportadora, type RowError } from "@/lib/pedidos-parsing";

export interface ImportPedidosResult {
  recebidos: number;
  inseridos: number;
  atualizados: number;
  errosValidacao: RowError[];
  transportadoraNaoEncontrada: RowError[];
  errosPersistencia: RowError[];
  avisos: RowError[];
}

/**
 * Upsert em lote dos pedidos recebidos da Intelipost.
 *
 * Regras:
 * - `pedido` é a chave única.
 * - Pedido novo: insere todos os campos de origem.
 * - Pedido existente: atualiza SOMENTE os campos de origem; os campos
 *   operacionais preenchidos pela transportadora nunca são tocados aqui.
 * - Transportadora não cadastrada: pedido não é gravado; erro registrado em
 *   AutomationLog com o pedido e o nome da transportadora recebido, e
 *   retornado no resultado (nunca descartado silenciosamente).
 * - Falha de persistência em uma linha não interrompe as demais.
 */
export async function upsertPedidosFromIntelipost(rows: unknown[]): Promise<ImportPedidosResult> {
  const result: ImportPedidosResult = {
    recebidos: rows.length,
    inseridos: 0,
    atualizados: 0,
    errosValidacao: [],
    transportadoraNaoEncontrada: [],
    errosPersistencia: [],
    avisos: [],
  };

  // Carrega transportadora + aliases numa única query (sem N+1). O
  // matching em si (ordem codigoSlug -> nome -> aliases) acontece em
  // resolveTransportadora, função pura em lib/pedidos-parsing.ts.
  interface TransportadoraComAliasesRaw {
    id: string;
    nome: string;
    codigoSlug: string;
    aliases: { alias: string }[];
  }

  const transportadorasRaw: TransportadoraComAliasesRaw[] = await prisma.transportadora.findMany({
    select: {
      id: true,
      nome: true,
      codigoSlug: true,
      aliases: { select: { alias: true } },
    },
  });
  const transportadoras = transportadorasRaw.map((t: TransportadoraComAliasesRaw) => ({
    id: t.id,
    nome: t.nome,
    codigoSlug: t.codigoSlug,
    aliases: t.aliases.map((a: { alias: string }) => a.alias),
  }));

  const dataReport = startOfLocalDay(new Date());

  for (let index = 0; index < rows.length; index += 1) {
    const parsed = parseIntelipostPedidoRow(rows[index], index);
    if (!parsed.ok) {
      result.errosValidacao.push(parsed.error);
      continue;
    }
    const data = parsed.data;

    if (data.avisos.length > 0) {
      for (const aviso of data.avisos) {
        result.avisos.push({ index, pedido: data.pedido, motivo: aviso });
      }
    }

    const transportadora = resolveTransportadora(data.transportadoraNomeOrigem, transportadoras);
    if (!transportadora) {
      const motivo = `Transportadora "${data.transportadoraNomeOrigem}" não encontrada no cadastro.`;
      result.transportadoraNaoEncontrada.push({ index, pedido: data.pedido, motivo });
      await prisma.automationLog.create({
        data: {
          transportadoraId: null,
          dataReport,
          tipo: "pedidos_import_transportadora_nao_encontrada",
          status: "error",
          mensagem: `Pedido ${data.pedido}: ${motivo}`,
          payload: JSON.stringify({ pedido: data.pedido, transportadoraRecebida: data.transportadoraNomeOrigem }),
        },
      });
      continue;
    }

    const origemFields = {
      nomeDestinatario: data.nomeDestinatario,
      canalVendas: data.canalVendas,
      cidadeDestinatario: data.cidadeDestinatario,
      uf: data.uf,
      cepDestinatario: data.cepDestinatario,
      pedidoDeVenda: data.pedidoDeVenda,
      codigoRastreio: data.codigoRastreio,
      notaFiscal: data.notaFiscal,
      metodoEnvio: data.metodoEnvio,
      transportadoraId: transportadora.id,
      valorNota: data.valorNota,
      pesoFisico: data.pesoFisico,
      chaveNota: data.chaveNota,
      dataCriacaoPedido: data.dataCriacaoPedido,
      dataEntregaOrigem: data.dataEntregaOrigem,
      previsaoEntregaClienteOrigem: data.previsaoEntregaClienteOrigem,
      previsaoEntregaTransportadoraOrigem: data.previsaoEntregaTransportadoraOrigem,
      dataDespacho: data.dataDespacho,
      previsaoEntregaTransportadoraOriginal: data.previsaoEntregaTransportadoraOriginal,
      microStatus: data.microStatus,
      statusTransportador: data.statusTransportador,
      origemAtualizadoEm: new Date(),
    };

    try {
      const existing = await prisma.pedido.findUnique({ where: { pedido: data.pedido }, select: { id: true } });
      await prisma.pedido.upsert({
        where: { pedido: data.pedido },
        create: { pedido: data.pedido, ...origemFields },
        update: origemFields, // nunca inclui campos operacionais
      });
      if (existing) {
        result.atualizados += 1;
      } else {
        result.inseridos += 1;
      }
    } catch (error) {
      const motivo = error instanceof Error ? error.message : "Erro desconhecido ao persistir o pedido.";
      result.errosPersistencia.push({ index, pedido: data.pedido, motivo });
    }
  }

  const status =
    result.errosValidacao.length > 0 || result.transportadoraNaoEncontrada.length > 0 || result.errosPersistencia.length > 0
      ? "error"
      : "success";

  await prisma.automationLog.create({
    data: {
      transportadoraId: null,
      dataReport,
      tipo: "pedidos_import",
      status,
      mensagem: `Importação de pedidos: ${result.recebidos} recebidos, ${result.inseridos} inseridos, ${result.atualizados} atualizados, ${result.errosValidacao.length} erro(s) de validação, ${result.transportadoraNaoEncontrada.length} transportadora(s) não encontrada(s), ${result.errosPersistencia.length} erro(s) de persistência.`,
      payload: JSON.stringify(result),
    },
  });

  return result;
}
