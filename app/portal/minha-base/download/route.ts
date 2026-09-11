import { NextRequest, NextResponse } from "next/server";
import { requireCarrierUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePedidosFilters, buildPedidosWhere } from "@/lib/pedidos-query";
import { buildPedidosXlsx } from "@/lib/pedidos-xlsx";
import { formatDateInput } from "@/lib/dates";

const MAX_EXPORT_ROWS = 50000;

export async function GET(request: NextRequest) {
  const user = await requireCarrierUser("/portal/minha-base");

  const filters = parsePedidosFilters(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  const where = buildPedidosWhere(filters, {
    transportadoraId: user.transportadoraId!,
  });

  const pedidosEncontrados = await prisma.pedido.findMany({
    where,
    include: {
      transportadora: {
        select: { nome: true },
      },
    },
    orderBy: {
      dataCriacaoPedido: "desc",
    },
  });

  // Inclui os pedidos em aberto e os finalizados entregues com atraso.
  const pedidos = pedidosEncontrados
    .filter((pedido) => {
      // Sem data de entrega da Intelipost: pedido em aberto.
      if (!pedido.dataEntregaOrigem) {
        return true;
      }

      // Sem previsão da transportadora não é possível calcular o atraso.
      if (!pedido.previsaoEntregaTransportadoraOrigem) {
        return false;
      }

      return (
        pedido.dataEntregaOrigem.getTime() >
        pedido.previsaoEntregaTransportadoraOrigem.getTime()
      );
    })
    .slice(0, MAX_EXPORT_ROWS);

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
