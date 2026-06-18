import Link from "next/link";
import { CheckCircle2, ClipboardList, History } from "lucide-react";
import { requireCarrierUser } from "@/lib/auth";

export default async function PortalSuccessPage() {
  await requireCarrierUser("/portal/sucesso");

  return (
    <main className="shell">
      <section className="success-panel">
        <CheckCircle2 size={34} aria-hidden="true" />
        <h1>Relatório enviado</h1>
        <p>Recebemos o preenchimento diário. O time interno já consegue acompanhar o envio no painel operacional.</p>
        <div className="actions">
          <Link className="btn secondary" href="/portal">
            <History size={16} /> Voltar ao portal
          </Link>
          <Link className="btn secondary" href="/portal/formulario">
            <ClipboardList size={16} /> Abrir formulário
          </Link>
        </div>
      </section>
    </main>
  );
}
