import { NextResponse } from "next/server";
import { requireCarrierUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfLocalDay } from "@/lib/dates";
import { buildDailyReportTemplate } from "@/lib/xlsx-template";

export async function GET() {
  const user = await requireCarrierUser("/portal/formulario");
  const transportadora = await prisma.transportadora.findUnique({
    where: { id: user.transportadoraId! },
    include: {
      submissions: {
        orderBy: { dataReport: "desc" },
        take: 1,
        include: {
          previousDayMetrics: true,
          currentDayPreviewMetrics: true,
          ufMetrics: true,
        },
      },
    },
  });

  if (!transportadora || !transportadora.ativo) {
    return NextResponse.json({ error: "Transportadora inválida ou inativa." }, { status: 404 });
  }

  const last = transportadora.submissions[0];
  const today = startOfLocalDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const buffer = await buildDailyReportTemplate({
    transportadoraId: transportadora.id,
    transportadoraNome: transportadora.nome,
    dataReport: today,
    dataResultadoDiaAnterior: yesterday,
    dataPreviaDiaAtual: today,
    responsavelNome: last?.submittedByName || user.nome,
    responsavelEmail: last?.submittedByEmail || user.email,
    observacoes: last?.observacoes ?? "",
    previousDayMetrics: last?.previousDayMetrics,
    currentDayPreviewMetrics: last?.currentDayPreviewMetrics,
    ufMetrics: last?.ufMetrics ?? [],
  });

  const filename = `modelo-relatorio-${transportadora.codigoSlug}-${today.toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
