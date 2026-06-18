import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asPercent, calculateMonthlySLA, calculatePartialDaySLA } from "@/lib/calculations";
import { monthBounds, parseDateInput } from "@/lib/dates";

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret") ?? request.headers.get("x-report-job-secret");
  const expectedSecret = process.env.REPORT_JOB_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") !== "false";
  const dataParam = request.nextUrl.searchParams.get("date");
  const dataReport = dataParam ? parseDateInput(dataParam) : new Date();
  dataReport.setHours(0, 0, 0, 0);
  const { start, end } = monthBounds(dataReport);
  const baseUrl = process.env.REPORT_BASE_URL ?? "http://localhost:3000";
  const webhookUrl = process.env.REPORT_WEBHOOK_URL;

  const transportadoras = await prisma.transportadora.findMany({ where: { ativo: true } });
  const results = [];

  for (const transportadora of transportadoras) {
    const submission = await prisma.dailyReportSubmission.findUnique({
      where: { transportadoraId_dataReport: { transportadoraId: transportadora.id, dataReport } },
      include: { previousDayMetrics: true, currentDayPreviewMetrics: true },
    });
    const monthSubmissions = await prisma.dailyReportSubmission.findMany({
      where: { transportadoraId: transportadora.id, dataReport: { gte: start, lt: end } },
      include: { previousDayMetrics: true },
    });
    const monthMetrics = monthSubmissions
      .filter((item) => item.previousDayMetrics)
      .map((item) => item.previousDayMetrics!);
    const status = submission ? submission.status : "pendente";
    const linkDashboard = `${baseUrl}/reports/${transportadora.id}/${dataReport.toISOString().slice(0, 10)}`;
    const payload = {
      transportadora: transportadora.nome,
      data_report: dataReport.toISOString().slice(0, 10),
      status,
      link_dashboard: linkDashboard,
      kpis: submission?.previousDayMetrics && submission.currentDayPreviewMetrics
        ? {
            sla_acumulado_mes: asPercent(calculateMonthlySLA(monthMetrics)),
            total_pedidos_dia_anterior: submission.previousDayMetrics.totalPedidos,
            total_entregue_dia_anterior: submission.previousDayMetrics.totalEntregue,
            total_em_aberto_dia_anterior: submission.previousDayMetrics.totalEmAberto,
            sla_parcial_dia: asPercent(calculatePartialDaySLA(submission.currentDayPreviewMetrics)),
          }
        : null,
    };

    let logStatus: "success" | "skipped" | "error" = submission ? "success" : "skipped";
    let mensagem = submission ? "Relatório diário disponibilizado." : "Relatório pendente para a data.";

    if (submission && webhookUrl && !dryRun) {
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`Webhook retornou ${response.status}`);
        mensagem = "Webhook enviado com sucesso.";
      } catch (error) {
        logStatus = "error";
        mensagem = error instanceof Error ? error.message : "Erro desconhecido no webhook.";
      }
    }

    await prisma.automationLog.create({
      data: {
        transportadoraId: transportadora.id,
        dataReport,
        tipo: webhookUrl && !dryRun ? "webhook" : "scheduled_report",
        status: logStatus,
        mensagem: dryRun ? `${mensagem} Dry-run ativo.` : mensagem,
        payload: JSON.stringify(payload),
      },
    });
    results.push({ transportadora: transportadora.nome, status: logStatus, payload });
  }

  return NextResponse.json({ dryRun, count: results.length, results });
}
