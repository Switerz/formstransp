import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { upsertAuthenticatedDailySubmission } from "@/app/actions";
import { DailyReportForm } from "@/components/DailyReportForm";
import { requireCarrierUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function readDraftErrorSnapshot(raw: string | undefined) {
  if (!raw) return { draftValues: undefined, errorSections: [] };
  try {
    const parsed = JSON.parse(raw);
    const values = parsed?.values;
    const sections = Array.isArray(parsed?.sections) ? parsed.sections : [];
    return {
      draftValues: values && typeof values === "object" ? (values as Record<string, string>) : undefined,
      errorSections: sections as string[],
    };
  } catch {
    return { draftValues: undefined, errorSections: [] };
  }
}

export default async function PortalFormularioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [user, query, cookieStore] = await Promise.all([
    requireCarrierUser("/portal/formulario"),
    searchParams,
    cookies(),
  ]);
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

  if (!transportadora || !transportadora.ativo) notFound();

  const { draftValues, errorSections } = readDraftErrorSnapshot(
    cookieStore.get(`report_draft_error_${transportadora.id}`)?.value,
  );

  return (
    <main className="shell">
      <DailyReportForm
        transportadora={transportadora}
        action={upsertAuthenticatedDailySubmission}
        error={query.error}
        last={transportadora.submissions[0]}
        defaultResponsibleName={user.nome}
        defaultResponsibleEmail={user.email}
        backHref="/portal"
        successPath="/portal/sucesso"
        draftPath="/portal/formulario"
        errorPath="/portal/formulario"
        draftValues={draftValues}
        errorSections={errorSections}
      />
    </main>
  );
}
