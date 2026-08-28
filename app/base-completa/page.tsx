import Link from "next/link";
import { Download } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { requireInternalUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBrazilianDate } from "@/lib/dates";
import { BRAZILIAN_UFS } from "@/lib/ufs";
import { parsePedidosFilters, filtersToSearchParams, buildPedidosWhere } from "@/lib/pedidos-query";

const PAGE_SIZE = 100;
const MAX_LIMIT = 2000;

export const dynamic = "force-dynamic";

export default async function BaseCompletaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireInternalUser("/base-completa");
  const raw = await searchParams;
  const filters = parsePedidosFilters(raw);
  const limit = Math.min(Number(raw.limite) || PAGE_SIZE, MAX_LIMIT);

  // Sem regra fixa de transportadoraId nem de dataEntregaOrigem: Base
  // Completa mostra todos os pedidos, abertos e finalizados, de todas as
  // transportadoras (o filtro de transportadora abaixo é opcional, da UI).
  const where = buildPedidosWhere(filters);

  interface PedidoListItem {
    id: string;
    pedido: string;
    uf: string;
    cidadeDestinatario: string;
    dataCriacaoPedido: Date;
    statusAtual: string | null;
    dataEntregaOrigem: Date | null;
    transportadora: { id: string; nome: string };
  }
  interface TransportadoraOption {
    id: string;
    nome: string;
  }

  const [pedidos, transportadoras]: [PedidoListItem[], TransportadoraOption[]] = await Promise.all([
    prisma.pedido.findMany({
      where,
      include: { transportadora: { select: { id: true, nome: true } } },
      orderBy: { dataCriacaoPedido: "desc" },
      take: limit,
    }),
    prisma.transportadora.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  const hasMore = pedidos.length === limit;
  const baseParams = filtersToSearchParams(filters);
  const loadMoreHref = `/base-completa?${filtersToSearchParams(filters, { limite: String(limit + PAGE_SIZE) })}`;
  const downloadHref = `/base-completa/download?${baseParams}`;

  return (
    <main className="shell">
      <div className="page-title">
        <div>
          <h1>Base Completa</h1>
          <p className="muted">Todos os pedidos, abertos e finalizados, de todas as transportadoras.</p>
        </div>
        <a className="btn" href={downloadHref}>
          <Download size={18} /> Baixar Base
        </a>
      </div>

      <form className="card form-grid" style={{ marginBottom: 18 }}>
        <div className="field">
          <label htmlFor="pedido">Pedido</label>
          <input id="pedido" name="pedido" defaultValue={filters.pedido ?? ""} placeholder="Número do pedido" />
        </div>
        <div className="field">
          <label htmlFor="transportadoraId">Transportadora</label>
          <select id="transportadoraId" name="transportadoraId" defaultValue={filters.transportadoraId ?? ""}>
            <option value="">Todas</option>
            {transportadoras.map((transportadora) => (
              <option key={transportadora.id} value={transportadora.id}>
                {transportadora.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="uf">UF</label>
          <select id="uf" name="uf" defaultValue={filters.uf ?? ""}>
            <option value="">Todas</option>
            {BRAZILIAN_UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="dataCriacaoDe">Data Criação (de)</label>
          <input type="date" id="dataCriacaoDe" name="dataCriacaoDe" defaultValue={filters.dataCriacaoDe ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="dataCriacaoAte">Data Criação (até)</label>
          <input type="date" id="dataCriacaoAte" name="dataCriacaoAte" defaultValue={filters.dataCriacaoAte ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="statusAtual">Status Atual</label>
          <input id="statusAtual" name="statusAtual" defaultValue={filters.statusAtual ?? ""} placeholder="Ex.: Entregue" />
        </div>
        <div className="actions" style={{ alignItems: "end" }}>
          <button className="btn" type="submit">
            Filtrar
          </button>
          <Link className="btn secondary" href="/base-completa">
            Limpar
          </Link>
        </div>
      </form>

      <section className="card">
        {!pedidos.length ? (
          <EmptyState
            title="Nenhum pedido encontrado"
            description="Não há pedidos para os filtros selecionados."
            action={{ href: "/base-completa", label: "Limpar filtros" }}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Transportadora</th>
                    <th>UF</th>
                    <th>Cidade</th>
                    <th>Data Criação</th>
                    <th>Status Atual</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map((pedido) => (
                    <tr key={pedido.id}>
                      <td>{pedido.pedido}</td>
                      <td>{pedido.transportadora.nome}</td>
                      <td>{pedido.uf}</td>
                      <td>{pedido.cidadeDestinatario}</td>
                      <td>{formatBrazilianDate(pedido.dataCriacaoPedido)}</td>
                      <td>{pedido.statusAtual ?? "-"}</td>
                      <td>
                        <span className={`pill ${pedido.dataEntregaOrigem ? "ok" : "pending"}`}>
                          {pedido.dataEntregaOrigem ? "Finalizado" : "Em aberto"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              {hasMore
                ? `Mostrando os últimos ${pedidos.length} pedidos. Pode haver mais.`
                : `Mostrando ${pedidos.length} pedido${pedidos.length === 1 ? "" : "s"}.`}
            </p>
            {hasMore ? (
              <div className="actions">
                <Link className="btn secondary compact" href={loadMoreHref}>
                  Carregar mais
                </Link>
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
