import { requireCarrierUser } from "@/lib/auth";
import { BasePanel } from "@/components/pedidos/BasePanel";
import { HelpPanel } from "@/components/pedidos/HelpPanel";
import {
  uploadDevolucaoTransportadora,
} from "@/app/portal/minha-base/actions";
import "@/components/pedidos/minha-base.css";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function MinhaBasePage() {
  await requireCarrierUser("/portal/minha-base");

  return (
    <div className="mb-html">
      <main className="page">
        <div className="page-header">
          <div>
            <h1>Envio, atualização e conferência de bases</h1>

            <p>
              A Intelipost disponibiliza a base de origem
              automaticamente. Faça o download, atualize as
              informações operacionais e devolva a nova versão
              nesta mesma tela.
            </p>
          </div>
        </div>

        <section className="grid">
          <BasePanel
            linhas={[]}
            lastBaseUpdateLabel="Base disponível para download"
            hasBaseUpdate={true}
            initialResumo={null}
            lastDevolucaoLabel="Consulte a base atualizada"
            hasDevolucaoHoje={false}
            fillPending={0}
            fillPartial={0}
            fillDone={0}
            serverFillFilter="todas"
            allHref="/portal/minha-base"
            filledHref="/portal/minha-base"
            downloadHref="/portal/minha-base/download"
            uploadAction={uploadDevolucaoTransportadora}
          />
        </section>
      </main>

      <HelpPanel />
    </div>
  );
}
