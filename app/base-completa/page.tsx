import Link from "next/link";
import { Download } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { requireInternalUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBrazilianDate } from "@/lib/dates";
import { BRAZILIAN_UFS } from "@/lib/ufs";
import { parsePedidosFilters, filtersToSearchParams, buildPedidosWhere } from "@/lib/pedidos-query";
import { parsePeriodoFilters, periodoParaIntervaloDatas } from "@/lib/pedidos-periodo";
import { PeriodoFilter } from "@/components/pedidos/PeriodoFilter";
import "@/components/pedidos/minha-base.css";

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
  const periodo = parsePeriodoFilters(raw);
  const intervaloPeriodo = periodoParaIntervaloDatas(periodo);

  // Sem regra fixa de transportadoraId nem de dataEntregaOrigem: Base
  // Completa mostra todos os pedidos, abertos e finalizados, de todas as
  // transportadoras (o filtro de transportadora abaixo é opcional, da UI).
  // NENHUMA restrição de Minha Base foi copiada para cá - só o visual.
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

  // KPIs do admin respeitam o filtro opcional de transportadora (sem
  // filtro = consolidado de todas) e o período - independentes dos demais
  // filtros de tabela (pedido/UF/status), que não fazem sentido para os
  // Big Numbers.
  const kpiWhereBase = filters.transportadoraId ? { transportadoraId: filters.transportadoraId } : {};

  const [pedidos, transportadoras, totalPedidosKpi, pedidosAbertosKpi, pedidosVencidosKpi]: [
    PedidoListItem[],
    TransportadoraOption[],
    number,
    number,
    number,
  ] = await Promise.all([
    prisma.pedido.findMany({
      where,
      include: { transportadora: { select: { id: true, nome: true } } },
      orderBy: { dataCriacaoPedido: "desc" },
      take: limit,
    }),
    prisma.transportadora.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.pedido.count({ where: kpiWhereBase }),
    prisma.pedido.count({ where: { ...kpiWhereBase, dataEntregaOrigem: null } }),
    prisma.pedido.count({
      where: { ...kpiWhereBase, dataEntregaOrigem: null, dataPrevisao: intervaloPeriodo },
    }),
  ]);

  const hasMore = pedidos.length === limit;
  const baseParams = filtersToSearchParams(filters);
  const loadMoreHref = `/base-completa?${filtersToSearchParams(filters, { limite: String(limit + PAGE_SIZE) })}`;
  const downloadHref = `/base-completa/download?${baseParams}`;
  const percentualAbertoTotal = totalPedidosKpi > 0 ? Math.round((pedidosAbertosKpi / totalPedidosKpi) * 1000) / 10 : 0;

  return (
    <div className="mb-html">
      <main className="page">
        {/* Mesmo padrão visual de /portal/minha-base: mesmo wrapper .mb-html,
            mesmas classes (page-header, kpi-card, btn-transporter,
            table-wrap) - a diferença entre as duas telas é só de
            ACESSO/DADOS (requireInternalUser + sem filtro fixo de
            transportadora/dataEntregaOrigem), nunca de identidade visual. */}
        <div className="page-header">
          <div>
            <h1>Base Completa</h1>
            <p>Todos os pedidos, abertos e finalizados, de todas as transportadoras.</p>
          </div>
          <a className="btn-transporter" href={downloadHref}>
            <Download size={16} /> Baixar Base
          </a>
        </div>

        <div className="kpi-slide-grid" data-count="4" style={{ marginBottom: 18 }}>
          <div className="kpi-card">
            <div className="kpi-card-top">
              <span className="kpi-card-icon">▥</span>
              <span className="kpi-card-label">Total de Pedidos</span>
            </div>
            <div className="kpi-card-value">{totalPedidosKpi.toLocaleString("pt-BR")}</div>
            <div className="kpi-card-hint">{filters.transportadoraId ? "Da transportadora filtrada" : "Consolidado de todas as transportadoras"}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-card-top">
              <span className="kpi-card-icon">□</span>
              <span className="kpi-card-label">Pedidos em Aberto</span>
            </div>
            <div className="kpi-card-value">{pedidosAbertosKpi.toLocaleString("pt-BR")}</div>
            <div className="kpi-card-hint">dataEntregaOrigem em aberto</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-card-top">
              <span className="kpi-card-icon">◷</span>
              <span className="kpi-card-label">Pedidos Vencidos</span>
            </div>
            <div className="kpi-card-value">{pedidosVencidosKpi.toLocaleString("pt-BR")}</div>
            <div className="kpi-card-hint">
              Promessa Transporte {periodo.de.split("-").reverse().join("/")} a {periodo.ate.split("-").reverse().join("/")}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-card-top">
              <span className="kpi-card-icon">□</span>
              <span className="kpi-card-label">% Aberto/Total</span>
            </div>
            <div className="kpi-card-value">{percentualAbertoTotal}%</div>
            <div className="kpi-card-hint">Sobre o escopo selecionado</div>
          </div>
        </div>

        <PeriodoFilter
          action="/base-completa"
          de={periodo.de}
          ate={periodo.ate}
          hiddenFields={{
            pedido: filters.pedido ?? "",
            transportadoraId: filters.transportadoraId ?? "",
            uf: filters.uf ?? "",
            dataCriacaoDe: filters.dataCriacaoDe ?? "",
            dataCriacaoAte: filters.dataCriacaoAte ?? "",
            statusAtual: filters.statusAtual ?? "",
          }}
        />

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
            <button className="btn-transporter" type="submit">
              Filtrar
            </button>
            <Link className="btn-secondary" href="/base-completa">
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
                  <Link className="btn-secondary" href={loadMoreHref}>
                    Carregar mais
                  </Link>
                </div>
              ) : null}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
