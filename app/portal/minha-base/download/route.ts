import { NextRequest, NextResponse } from "next/server";
import { requireCarrierUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parsePedidosFilters,
  buildPedidosWhere,
} from "@/lib/pedidos-query";
import {
  buildPedidosXlsx,
  type PedidoParaXlsx,
} from "@/lib/pedidos-xlsx";
import { formatDateInput } from "@/lib/dates";

const MAX_EXPORT_ROWS = 50000;
const QUERY_BATCH_SIZE = 2000;

export async function GET(request: NextRequest) {
  const user = await requireCarrierUser("/portal/minha-base");

  const filters = parsePedidosFilters(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  const where = buildPedidosWhere(filters, {
    transportadoraId: user.transportadoraId!,
  });

  const pedidos: PedidoParaXlsx[] = [];
  let offset = 0;

  while (pedidos.length < MAX_EXPORT_ROWS) {
    const lote = await prisma.pedido.findMany({
      where,
      select: {
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
        transportadora: {
          select: { nome: true },
        },
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
      },
      orderBy: {
        dataCriacaoPedido: "desc",
      },
      skip: offset,
      take: QUERY_BATCH_SIZE,
    });

    if (lote.length === 0) {
      break;
    }

    for (const pedido of lote) {
      const estaEmAberto = !pedido.dataEntregaOrigem;

      const foiEntregueComAtraso =
        pedido.dataEntregaOrigem !== null &&
        pedido.previsaoEntregaTransportadoraOrigem !== null &&
        pedido.dataEntregaOrigem.getTime() >
          pedido.previsaoEntregaTransportadoraOrigem.getTime();

      if (estaEmAberto || foiEntregueComAtraso) {
        pedidos.push(pedido);

        if (pedidos.length >= MAX_EXPORT_ROWS) {
          break;
        }
      }
    }

    offset += lote.length;

    if (lote.length < QUERY_BATCH_SIZE) {
      break;
    }
  }

  const buffer = await buildPedidosXlsx(pedidos);

  const filename = `minha-base-${formatDateInput(new Date())}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}