"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AppUser, Transportadora } from "@prisma/client";
import { requireCarrierUser, requireInternalAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDateInput, startOfLocalDay } from "@/lib/dates";
import { assertSameOrigin } from "@/lib/request-security";
import { BRAZILIAN_UFS } from "@/lib/ufs";

function intFrom(formData: FormData, key: string) {
  const value = Number(formData.get(key) ?? 0);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Valor inválido para ${key}`);
  }
  return Math.trunc(value);
}

function textFrom(formData: FormData, key: string, maxLength = 500) {
  return sanitizeText(String(formData.get(key) ?? ""), maxLength);
}

function sanitizeText(value: string, maxLength = 500) {
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function safeRedirectPath(value: string, fallback: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function redirectWithFormError(message: string, formData: FormData, fallback = "/portal/formulario") {
  const errorPath = formData ? safeRedirectPath(textFrom(formData, "errorPath", 220), fallback) : fallback;
  redirect(`${errorPath}?error=${encodeURIComponent(message)}`);
}

function validateSubmissionConsistency(input: {
  totalPedidosAnterior: number;
  totalPedidosAtual: number;
  previousStatus: Record<string, number>;
  currentStatus: Record<string, number>;
  ufRows: Array<{ total: number }>;
  totalNoPrazo: number;
  totalForaDoPrazo: number;
  totalFinalizado: number;
  finalizadosNoPrazo: number;
  finalizadosForaDoPrazo: number;
}) {
  const errors: string[] = [];
  const previousStatusTotal = Object.values(input.previousStatus).reduce((sum, value) => sum + value, 0);
  const currentStatusTotal = Object.values(input.currentStatus).reduce((sum, value) => sum + value, 0);
  const ufTotal = input.ufRows.reduce((sum, row) => sum + row.total, 0);
  const prazoTotal = input.totalNoPrazo + input.totalForaDoPrazo;
  const finalizadosPrazo = input.finalizadosNoPrazo + input.finalizadosForaDoPrazo;

  if (ufTotal !== input.totalPedidosAnterior) errors.push("O total por UF está diferente do total de pedidos do dia anterior.");
  if (previousStatusTotal !== input.totalPedidosAnterior) errors.push("A soma dos status do dia anterior está diferente do total de pedidos.");
  if (prazoTotal !== input.totalPedidosAnterior) errors.push("A soma de no prazo + fora do prazo está diferente do total de pedidos.");
  if (currentStatusTotal !== input.totalPedidosAtual) errors.push("A soma dos status do dia atual está diferente do total de pedidos.");
  if (finalizadosPrazo > input.totalFinalizado) errors.push("Finalizados no prazo + fora do prazo está acima do total finalizado.");

  return errors;
}

async function auditLog(data: {
  tipo: string;
  mensagem: string;
  transportadoraId?: string;
  payload?: Record<string, unknown>;
}) {
  await prisma.automationLog.create({
    data: {
      transportadoraId: data.transportadoraId,
      dataReport: startOfLocalDay(new Date()),
      tipo: data.tipo,
      status: "success",
      mensagem: data.mensagem,
      payload: data.payload ? JSON.stringify(data.payload) : null,
    },
  });
}

async function qualityLog(data: {
  transportadoraId: string;
  userId?: string;
  dataReport: Date;
  action: string;
  reasons: string[];
  payloadSummary: Record<string, unknown>;
}) {
  await prisma.submissionQualityLog.create({
    data: {
      transportadoraId: data.transportadoraId,
      userId: data.userId,
      dataReport: data.dataReport,
      action: data.action,
      status: "blocked",
      reasons: JSON.stringify(data.reasons),
      payloadSummary: JSON.stringify(data.payloadSummary),
    },
  });
}

export async function createTransportadora(formData: FormData) {
  await assertSameOrigin();
  await requireInternalAdmin("/transportadoras/nova");

  const nome = textFrom(formData, "nome");
  if (!nome) throw new Error("Informe o nome da transportadora.");

  const codigoSlug = slugify(textFrom(formData, "codigoSlug") || nome);
  await prisma.transportadora.create({
    data: {
      nome,
      cnpj: textFrom(formData, "cnpj", 32) || null,
      codigoSlug,
      ativo: formData.get("ativo") === "on",
      origem: textFrom(formData, "origem", 12) === "demo" ? "demo" : "real",
      emailsDestinatarios: textFrom(formData, "emailsDestinatarios", 500) || null,
      tokenPublicoFormulario: randomBytes(24).toString("hex"),
    },
  });
  await auditLog({ tipo: "audit", mensagem: "Transportadora criada.", payload: { codigoSlug } });

  revalidatePath("/");
  redirect("/");
}

export async function updateTransportadora(id: string, formData: FormData) {
  await assertSameOrigin();
  await requireInternalAdmin(`/transportadoras/${id}/editar`);

  const nome = textFrom(formData, "nome");
  if (!nome) throw new Error("Informe o nome da transportadora.");

  const codigoSlug = slugify(textFrom(formData, "codigoSlug") || nome);
  await prisma.transportadora.update({
    where: { id },
    data: {
      nome,
      cnpj: textFrom(formData, "cnpj", 32) || null,
      codigoSlug,
      ativo: formData.get("ativo") === "on",
      origem: textFrom(formData, "origem", 12) === "demo" ? "demo" : "real",
      emailsDestinatarios: textFrom(formData, "emailsDestinatarios", 500) || null,
    },
  });
  await auditLog({
    tipo: "audit",
    transportadoraId: id,
    mensagem: "Transportadora editada.",
    payload: { codigoSlug, ativo: formData.get("ativo") === "on" },
  });

  revalidatePath("/");
  revalidatePath(`/transportadoras/${id}/editar`);
  redirect("/");
}

async function upsertDailySubmissionForTransportadora(
  transportadora: Transportadora,
  formData: FormData,
  user?: Pick<AppUser, "id">,
) {
  const action = textFrom(formData, "intent");
  const dataReport = startOfLocalDay(parseDateInput(textFrom(formData, "dataReport")));
  const status = action === "submit" ? "submitted" : "draft";
  const existingSubmission = await prisma.dailyReportSubmission.findUnique({
    where: { transportadoraId_dataReport: { transportadoraId: transportadora.id, dataReport } },
  });
  if (existingSubmission && ["submitted", "validated", "sent"].includes(existingSubmission.status)) {
    redirectWithFormError("Este relatório já foi enviado e está bloqueado para edição.", formData);
  }

  const totalPedidosAnterior = intFrom(formData, "prev_totalPedidos");
  const totalPedidosAtual = intFrom(formData, "cur_totalPedidos");

  const previousStatus = {
    totalEntregue: intFrom(formData, "prev_totalEntregue"),
    totalEmAberto: intFrom(formData, "prev_totalEmAberto"),
    totalTentativaInsucesso: intFrom(formData, "prev_totalTentativaInsucesso"),
    totalDevolucao: intFrom(formData, "prev_totalDevolucao"),
    totalCancelado: intFrom(formData, "prev_totalCancelado"),
  };
  const currentStatus = {
    totalEntregue: intFrom(formData, "cur_totalEntregue"),
    totalEmAberto: intFrom(formData, "cur_totalEmAberto"),
    totalTentativaInsucesso: intFrom(formData, "cur_totalTentativaInsucesso"),
    totalDevolucao: intFrom(formData, "cur_totalDevolucao"),
    totalCancelado: intFrom(formData, "cur_totalCancelado"),
  };

  const ufRows = BRAZILIAN_UFS.map((uf) => {
    const dentroDoPrazo = intFrom(formData, `uf_${uf}_dentro`);
    const foraDoPrazo = intFrom(formData, `uf_${uf}_fora`);
    return { uf, dentroDoPrazo, foraDoPrazo, total: dentroDoPrazo + foraDoPrazo };
  });
  const totalNoPrazo = intFrom(formData, "prev_totalNoPrazo");
  const totalForaDoPrazo = intFrom(formData, "prev_totalForaDoPrazo");
  const totalFinalizado = intFrom(formData, "cur_totalFinalizado");
  const finalizadosNoPrazo = intFrom(formData, "cur_finalizadosNoPrazo");
  const finalizadosForaDoPrazo = intFrom(formData, "cur_finalizadosForaDoPrazo");

  if (status === "submitted") {
    const consistencyErrors = validateSubmissionConsistency({
      totalPedidosAnterior,
      totalPedidosAtual,
      previousStatus,
      currentStatus,
      ufRows,
      totalNoPrazo,
      totalForaDoPrazo,
      totalFinalizado,
      finalizadosNoPrazo,
      finalizadosForaDoPrazo,
    });
    if (consistencyErrors.length) {
      await qualityLog({
        transportadoraId: transportadora.id,
        userId: user?.id,
        dataReport,
        action,
        reasons: consistencyErrors,
        payloadSummary: {
          totalPedidosAnterior,
          totalPedidosAtual,
          previousStatusTotal: Object.values(previousStatus).reduce((sum, value) => sum + value, 0),
          currentStatusTotal: Object.values(currentStatus).reduce((sum, value) => sum + value, 0),
          ufTotal: ufRows.reduce((sum, row) => sum + row.total, 0),
          prazoTotal: totalNoPrazo + totalForaDoPrazo,
          finalizadosPrazo: finalizadosNoPrazo + finalizadosForaDoPrazo,
          totalFinalizado,
        },
      });
      redirectWithFormError(consistencyErrors.join(" "), formData);
    }
  }

  const submission = await prisma.dailyReportSubmission.upsert({
    where: {
      transportadoraId_dataReport: {
        transportadoraId: transportadora.id,
        dataReport,
      },
    },
    create: {
      transportadoraId: transportadora.id,
      dataReport,
      dataResultadoDiaAnterior: startOfLocalDay(parseDateInput(textFrom(formData, "dataResultadoDiaAnterior"))),
      dataPreviaDiaAtual: startOfLocalDay(parseDateInput(textFrom(formData, "dataPreviaDiaAtual"))),
      status,
      submittedAt: status === "submitted" ? new Date() : null,
      submittedByName: textFrom(formData, "submittedByName", 120) || null,
      submittedByEmail: textFrom(formData, "submittedByEmail", 180) || null,
      observacoes: textFrom(formData, "observacoes", 2000) || null,
    },
    update: {
      dataResultadoDiaAnterior: startOfLocalDay(parseDateInput(textFrom(formData, "dataResultadoDiaAnterior"))),
      dataPreviaDiaAtual: startOfLocalDay(parseDateInput(textFrom(formData, "dataPreviaDiaAtual"))),
      status,
      submittedAt: status === "submitted" ? new Date() : null,
      submittedByName: textFrom(formData, "submittedByName", 120) || null,
      submittedByEmail: textFrom(formData, "submittedByEmail", 180) || null,
      observacoes: textFrom(formData, "observacoes", 2000) || null,
    },
  });

  await prisma.dailyPreviousDayMetrics.upsert({
    where: { submissionId: submission.id },
    create: {
      submissionId: submission.id,
      totalPedidos: totalPedidosAnterior,
      ...previousStatus,
      totalNoPrazo,
      totalForaDoPrazo,
    },
    update: {
      totalPedidos: totalPedidosAnterior,
      ...previousStatus,
      totalNoPrazo,
      totalForaDoPrazo,
    },
  });

  await prisma.dailyCurrentDayPreviewMetrics.upsert({
    where: { submissionId: submission.id },
    create: {
      submissionId: submission.id,
      totalPedidos: totalPedidosAtual,
      totalFinalizado,
      ...currentStatus,
      finalizadosNoPrazo,
      finalizadosForaDoPrazo,
    },
    update: {
      totalPedidos: totalPedidosAtual,
      totalFinalizado,
      ...currentStatus,
      finalizadosNoPrazo,
      finalizadosForaDoPrazo,
    },
  });

  await prisma.previousDayUFMetric.deleteMany({ where: { submissionId: submission.id } });
  await prisma.previousDayUFMetric.createMany({
    data: ufRows.map((row) => ({ submissionId: submission.id, ...row })),
  });
  await auditLog({
    tipo: "audit",
    transportadoraId: transportadora.id,
    mensagem: status === "submitted" ? "Relatório enviado pela transportadora." : "Rascunho salvo pela transportadora.",
    payload: { dataReport: dataReport.toISOString().slice(0, 10), status },
  });

  revalidatePath("/");
  const successPath = safeRedirectPath(textFrom(formData, "successPath", 220), "/portal/sucesso");
  const draftPath = safeRedirectPath(textFrom(formData, "draftPath", 220), "/portal/formulario");
  redirect(action === "submit" ? successPath : draftPath);
}

export async function upsertDailySubmission() {
  redirect("/login?next=/portal/formulario");
}

export async function upsertAuthenticatedDailySubmission(formData: FormData) {
  await assertSameOrigin();

  const user = await requireCarrierUser("/portal/formulario");
  const transportadora = await prisma.transportadora.findUnique({ where: { id: user.transportadoraId! } });
  if (!transportadora || !transportadora.ativo) throw new Error("Transportadora inválida ou inativa.");

  return upsertDailySubmissionForTransportadora(transportadora, formData, user);
}
