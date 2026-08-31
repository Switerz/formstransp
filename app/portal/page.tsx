import Link from "next/link";
import { History, Package } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { requireCarrierUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { KpiCarousel } from "@/components/pedidos/KpiCarousel";
import { PeriodoFilter } from "@/components/pedidos/PeriodoFilter";
import { montarDadosKpiCarousel } from "@/lib/pedidos-kpi-carousel";
import "@/components/pedidos/minha-base.css";

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireCarrierUser("/portal");
  const transportadoraId = user.transportadoraId!;
  const raw = await searchParams;

  const transportadora = await prisma.transportadora.findUnique({
    where: { id: transportadoraId },
    select: { id: true, nome: true },
  });

  if (!transportadora) {
    return (
      <main className="shell">
        <EmptyState
          title="Acesso sem transportadora vinculada"
          description="Seu usuário existe, mas ainda não está associado a uma transportadora ativa."
        />
      </main>
    );
  }

  // Mesma função usada por /portal/minha-base - única fonte de verdade dos
  // Big Numbers, sem duplicar consulta/lógica entre as duas telas.
  const dadosKpi = await montarDadosKpiCarousel(transportadoraId, raw);

  return (
    <main className="shell">
      <div className="page-title">
        <div>
          <h1>Portal da transportadora</h1>
          <p className="muted">{transportadora.nome}</p>
        </div>
      </div>

      <PeriodoFilter action="/portal" de={dadosKpi.periodo.de} ate={dadosKpi.periodo.ate} />

      {/* Mesmo wrapper .mb-html + mesmo componente da Minha Base, sem
          nenhum h2/card por cima - o KpiCarousel já renderiza seu próprio
          cabeçalho "Números". Garante CARROSSEL DA HOME = CARROSSEL DA
          MINHA BASE (mesma estrutura HTML, mesmas classes, mesmo CSS). */}
      <div className="mb-html" style={{ minHeight: 0 }}>
        <KpiCarousel {...dadosKpi.props} />
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="panel-heading">
          <div>
            <h2 className="section-title">Rotina diária</h2>
          </div>
        </div>
        <div className="actions" style={{ marginTop: 14 }}>
          <Link className="btn secondary" href="/portal/minha-base">
            <Package size={16} /> Minha Base
          </Link>
          <Link className="btn secondary" href={`/historico/${transportadora.id}`}>
            <History size={16} /> Ver histórico
          </Link>
        </div>
      </section>
    </main>
  );
}
