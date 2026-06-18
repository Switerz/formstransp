import { notFound } from "next/navigation";
import { upsertAuthenticatedDailySubmission } from "@/app/actions";
import { DailyReportForm } from "@/components/DailyReportForm";
import { requireCarrierUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function PortalFormularioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [user, query] = await Promise.all([requireCarrierUser("/portal/formulario"), searchParams]);
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
      />
    </main>
  );
}
