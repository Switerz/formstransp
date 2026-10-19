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
  if (!valor) return "Base disponível para download";

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return "Base disponível para download";
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

  const paginaSolicitada = Number.parseInt(
    raw.pagina ?? "1",
    10,
  );

  const pagina =
    Number.isFinite(paginaSolicitada) &&
    paginaSolicitada > 0
      ? paginaSolicitada
      : 1;

  const base = await carregarBasesDrive({
    transportadoraId: user.transportadoraId!,
    somentePreenchidas: filtroPreenchimento === "preenchidas",
    limiteLinhas: 500,
    pagina,
  });

  const totalPaginas = Math.max(
    1,
    Math.ceil(base.totalVisivel / 500),
  );

  const paginaAtual = Math.min(
    pagina,
    totalPaginas,
  );

  function hrefPagina(numero: number) {
    const params = new URLSearchParams();

    if (filtroPreenchimento === "preenchidas") {
      params.set(
        "preenchimento",
        "preenchidas",
      );
    }

    if (numero > 1) {
      params.set("pagina", String(numero));
    }

    const query = params.toString();

    return query
      ? `/portal/minha-base?${query}`
      : "/portal/minha-base";
  }

  const totalRespondidos = base.partial + base.done;

  const percentualRespondido =
    base.total > 0
      ? Math.round((totalRespondidos / base.total) * 100)
      : 0;

  const percentualSlaBase =
    base.total > 0
      ? ((base.slaNoPrazo / base.total) * 100).toFixed(2).replace(".", ",")
      : "0,00";


  const allHref = "/portal/minha-base";
  const filledHref =
    "/portal/minha-base?preenchimento=preenchidas";

  const previousHref =
    paginaAtual > 1
      ? hrefPagina(paginaAtual - 1)
      : undefined;

  const nextHref =
    paginaAtual < totalPaginas
      ? hrefPagina(paginaAtual + 1)
      : undefined;

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
          <KpiCarousel
            total={card(
              "??",
              "Total",
              base.total.toLocaleString("pt-BR"),
              "Total de pedidos da base",
            )}
            pendentes={card(
              "?",
              "Pendentes",
              base.pending.toLocaleString("pt-BR"),
              "Pedidos ainda sem resposta operacional",
            )}
            respondido={card(
              "??",
              "Respondido",
              totalRespondidos.toLocaleString("pt-BR"),
              `${percentualRespondido}% da base`,
            )}
            slaBaseCompleta={card(
              "??",
              "SLA com Base Completa",
              `${percentualSlaBase}%`,
              `${base.slaNoPrazo.toLocaleString("pt-BR")} pedidos no prazo sobre o total da base`,
            )}
          />

          <BasePanel
            linhas={base.linhas}
            lastBaseUpdateLabel={formatarAtualizacao(
              base.ultimaAtualizacao,
            )}
            hasBaseUpdate={base.arquivos > 0}
            initialResumo={null}
            lastDevolucaoLabel={
              base.ultimaDevolucao
                ? formatarAtualizacao(
                    base.ultimaDevolucao,
                  )
                : "Nenhuma devolu??o recebida"
            }
            hasDevolucaoHoje={false}
            fillPending={base.pending}
            fillPartial={base.partial}
            fillDone={base.done}
            serverFillFilter={filtroPreenchimento}
            totalRows={base.totalVisivel}
            page={paginaAtual}
            totalPages={totalPaginas}
            previousHref={previousHref}
            nextHref={nextHref}
            allHref={allHref}
            filledHref={filledHref}
            downloadHref="/portal/minha-base/download"
            uploadAction={uploadDevolucaoTransportadora}
            carrierCurrentMode
          />
        </section>
      </main>

      <HelpPanel />
    </div>
  );
}