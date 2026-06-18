import { chromium } from "playwright";
import { NextRequest, NextResponse } from "next/server";
import { requireTransportadoraAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDateInput } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transportadoraId: string; data: string }> },
) {
  const { transportadoraId, data } = await params;
  await requireTransportadoraAccess(transportadoraId, `/reports/${transportadoraId}/${data}`);

  const dataReport = parseDateInput(data);
  const submission = await prisma.dailyReportSubmission.findUnique({
    where: { transportadoraId_dataReport: { transportadoraId, dataReport } },
    include: { transportadora: true },
  });

  if (!submission) {
    return NextResponse.json({ error: "Relatório não encontrado." }, { status: 404 });
  }

  const reportUrl = `${request.nextUrl.origin}/reports/${transportadoraId}/${data}?print=1&exportToken=${encodeURIComponent(process.env.REPORT_JOB_SECRET ?? "")}`;
  const fileSlug = submission.transportadora.codigoSlug || "transportadora";
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    await page.goto(reportUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await page.emulateMedia({ media: "print" });

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: {
        top: "10mm",
        right: "10mm",
        bottom: "10mm",
        left: "10mm",
      },
    });

    await prisma.automationLog.create({
      data: {
        transportadoraId,
        dataReport,
        tipo: "pdf",
        status: "success",
        mensagem: "PDF do relatório gerado manualmente.",
        payload: JSON.stringify({ reportUrl }),
      },
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="report-${fileSlug}-${data}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido ao gerar PDF.";
    await prisma.automationLog.create({
      data: {
        transportadoraId,
        dataReport,
        tipo: "pdf",
        status: "error",
        mensagem: message,
        payload: JSON.stringify({ reportUrl }),
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await browser?.close();
  }
}
