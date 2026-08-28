import { NextRequest, NextResponse } from "next/server";
import { requireCarrierUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePedidosFilters, buildPedidosWhere } from "@/lib/pedidos-query";
import { buildPedidosXlsx } from "@/lib/pedidos-xlsx";
import { formatDateInput } from "@/lib/dates";

const MAX_EXPORT_ROWS = 50000;

export async function GET(request: NextRequest) {
  const user = await requireCarrierUser("/portal/minha-base");

  const filters = parsePedidosFilters(Object.fromEntries(request.nextUrl.searchParams));
  const where = buildPedidosWhere(filters, {
    transportadoraId: user.transportadoraId!,
    dataEntregaOrigem: null,
  });

  const pedidos = await prisma.pedido.findMany({
    where,
    include: { transportadora: { select: { nome: true } } },
    orderBy: { dataCriacaoPedido: "desc" },
    take: MAX_EXPORT_ROWS,
  });

  const buffer = await buildPedidosXlsx(pedidos);

  const filename = `minha-base-${formatDateInput(new Date())}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
