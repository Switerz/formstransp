"use client";

import { useState } from "react";

export interface KpiCard {
  icon: string;
  label: string;
  value: string;
  hint: string;
  id?: string;
  className?: string;
}

interface KpiSlideDef {
  title: string;
  cards: KpiCard[];
}

interface KpiCarouselProps {
  slaAjusteTransporte: KpiCard;
  slaTransporte: KpiCard;
  slaCliente: KpiCard;
  taxaInsucesso: KpiCard;
  taxaDevolucao: KpiCard;
  pedidosAbertos: KpiCard;
  tratativaCx: KpiCard;
  riscoAtraso: KpiCard;
  processado: KpiCard;
  perdas: KpiCard;
  totalPedidos: KpiCard;
  abertoTotal: KpiCard;
  integridade: KpiCard;
  status: KpiCard;
}

function KpiCardEl({ card }: { card: KpiCard }) {
  return (
    <div className={`kpi-card ${card.className ?? ""}`} id={card.id}>
      <div className="kpi-card-top">
        <span className="kpi-card-icon">{card.icon}</span>
        <span className="kpi-card-label">{card.label}</span>
      </div>
      <div className="kpi-card-value">{card.value}</div>
      <div className="kpi-card-hint">{card.hint}</div>
    </div>
  );
}

/**
 * Carrossel de Big Numbers - MESMA estrutura, MESMOS 5 slides, MESMA
 * quantidade/ordem de cards do HTML oficial. Navegação por dots (clique),
 * igual ao HTML. O gesto de arrastar (drag/swipe) do protótipo NÃO foi
 * portado - ver observação no relatório final; a navegação por clique nos
 * dots é 100% funcional e visualmente idêntica.
 */
export function KpiCarousel(props: KpiCarouselProps) {
  const slides: KpiSlideDef[] = [
    {
      title: "Geral",
      cards: [
        props.slaAjusteTransporte,
        props.slaTransporte,
        props.slaCliente,
        props.taxaInsucesso,
        props.taxaDevolucao,
        props.pedidosAbertos,
        props.tratativaCx,
        props.riscoAtraso,
        props.processado,
        props.perdas,
        props.totalPedidos,
        props.abertoTotal,
      ],
    },
    { title: "SLA", cards: [props.slaAjusteTransporte, props.slaTransporte, props.slaCliente] },
    {
      title: "Operação",
      cards: [props.taxaInsucesso, props.taxaDevolucao, props.pedidosAbertos, props.tratativaCx, props.riscoAtraso, props.perdas],
    },
    { title: "Processamento", cards: [props.processado, props.totalPedidos, props.abertoTotal] },
    { title: "Integridade de bases", cards: [props.integridade, props.status] },
  ];

  const [index, setIndex] = useState(0);

  return (
    <section className="kpi-carousel" id="kpiCarousel" aria-label="Indicadores">
      <div className="kpi-carousel-head">
        <div className="kpi-carousel-title">
          <span>▥</span>
          <span>Números</span>
        </div>
        <div className="kpi-carousel-view">{slides[index].title}</div>
      </div>

      <div className="kpi-carousel-viewport">
        <div className="kpi-carousel-track" style={{ transform: `translate3d(-${index * 100}%,0,0)` }}>
          {slides.map((slide) => (
            <div className="kpi-slide" data-title={slide.title} key={slide.title}>
              <div className="kpi-slide-grid" data-count={String(slide.cards.length)}>
                {slide.cards.map((card, i) => (
                  <KpiCardEl card={card} key={`${slide.title}-${i}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="kpi-carousel-nav" aria-label="Navegação dos indicadores">
        {slides.map((slide, i) => (
          <button
            key={slide.title}
            type="button"
            className={`kpi-dot ${i === index ? "active" : ""}`}
            title={slide.title}
            aria-current={i === index}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  );
}
