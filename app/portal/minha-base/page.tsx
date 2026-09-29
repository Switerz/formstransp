import { requireCarrierUser } from "@/lib/auth";
import { carregarBasesDrive } from "@/lib/bases-drive";
import {
  KpiCarousel,
  type KpiCard,
} from "@/components/pedidos/KpiCarousel";
import { BasePanel } from "@/components/pedidos/BasePanel";
import { HelpPanel } from "@/components/pedidos/HelpPanel";
import {
  uploadDevolucaoTransportadora,
} from "@/app/portal/minha-base/actions";
import "@/components/pedidos/minha-base.css";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function card(
  icon: string,
  label: string,
  value: string,
  hint: string,
): KpiCard {
  return { icon, label, value, hint };
}

function formatarAtualizacao(valor: string | null) {
  if (!valor) return "Base disponÃ­vel para download";

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return "Base disponÃ­vel para download";
  }

  return data.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function MinhaBasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireCarrierUser("/portal/minha-base");
  const raw = await searchParams;

  const filtroPreenchimento =
    raw.preenchimento === "preenchidas"
      ? "preenchidas"
      : "todas";

  const base = await carregarBasesDrive({
    transportadoraId: user.transportadoraId!,
    somentePreenchidas: filtroPreenchimento === "preenchidas",
    limiteLinhas: 500,
  });

  const totalRespondidos = base.partial + base.done;

  const percentualRespondido =
    base.total > 0
      ? Math.round((totalRespondidos / base.total) * 100)
      : 0;

  const percentualConcluido =
    base.total > 0
      ? Math.round((base.done / base.total) * 100)
      : 0;

  const allHref = "/portal/minha-base";
  const filledHref =
    "/portal/minha-base?preenchimento=preenchidas";

  return (
    <div className="mb-html">
      <main className="page">
        <div className="page-header">
          <div>
            <h1>Envio, atualizaÃ§Ã£o e conferÃªncia de bases</h1>

            <p>
              A Intelipost disponibiliza a base de origem
              automaticamente. FaÃ§a o download, atualize as
              informaÃ§Ãµes operacionais e devolva a nova versÃ£o
              nesta mesma tela.
            </p>
          </div>
        </div>

        <section className="grid">
          <KpiCarousel
            slaAjusteTransporte={card(
              "📦",
              "Total de pedidos",
              base.total.toLocaleString("pt-BR"),
              "Pedidos presentes na base atual",
            )}
            slaTransporte={card(
              "⏳",
              "Pendentes",
              base.pending.toLocaleString("pt-BR"),
              "Pedidos ainda sem preenchimento operacional",
            )}
            slaCliente={card(
              "📝",
              "Respondidos",
              totalRespondidos.toLocaleString("pt-BR"),
              `${percentualRespondido}% da base com algum preenchimento`,
            )}
            taxaInsucesso={card(
              "✅",
              "Concluídos",
              base.done.toLocaleString("pt-BR"),
              `${percentualConcluido}% da base totalmente preenchida`,
            )}
            taxaDevolucao={card(
              "📋",
              "Parciais",
              base.partial.toLocaleString("pt-BR"),
              "Pedidos parcialmente preenchidos",
            )}
            pedidosAbertos={card(
              "⏳",
              "Em aberto",
              base.pending.toLocaleString("pt-BR"),
              "Pedidos pendentes de tratativa",
            )}
            tratativaCx={card(
              "📝",
              "Com tratativa",
              totalRespondidos.toLocaleString("pt-BR"),
              "Pedidos com algum preenchimento operacional",
            )}
            riscoAtraso={card(
              "⚠️",
              "SLA atrasado",
              base.slaAtrasado.toLocaleString("pt-BR"),
              "Pedidos identificados como atrasados na base",
            )}
            processado={card(
              "⚙️",
              "Processados",
              base.total.toLocaleString("pt-BR"),
              "Registros carregados do arquivo atual",
            )}
            perdas={card(
              "⚠️",
              "Pendências",
              base.pending.toLocaleString("pt-BR"),
              "Registros ainda pendentes",
            )}
            totalPedidos={card(
              "📦",
              "Total da base",
              base.total.toLocaleString("pt-BR"),
              "Total de registros da base atual",
            )}
            abertoTotal={card(
              "📝",
              "Respondidos",
              totalRespondidos.toLocaleString("pt-BR"),
              `${percentualRespondido}% da base`,
            )}
            integridade={card(
              "📁",
              "Arquivo atual",
              base.arquivos > 0 ? "Disponível" : "Indisponível",
              `${base.arquivos} arquivo(s) encontrado(s) no Drive`,
            )}
            status={card(
              "✅",
              "SLA no prazo",
              base.slaNoPrazo.toLocaleString("pt-BR"),
              "Pedidos identificados como no prazo",
            )}
          />

          <BasePanel
            linhas={base.linhas}
            lastBaseUpdateLabel={formatarAtualizacao(
              base.ultimaAtualizacao,
            )}
            hasBaseUpdate={base.arquivos > 0}
            initialResumo={null}
            lastDevolucaoLabel="Consulte a base atualizada"
            hasDevolucaoHoje={false}
            fillPending={base.pending}
            fillPartial={base.partial}
            fillDone={base.done}
            serverFillFilter={filtroPreenchimento}
            allHref={allHref}
            filledHref={filledHref}
            downloadHref="/portal/minha-base/download"
            uploadAction={uploadDevolucaoTransportadora}
          />
        </section>
      </main>

      <HelpPanel />
    </div>
  );
}