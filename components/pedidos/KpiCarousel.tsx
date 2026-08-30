"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface KpiCard {
  icon: string;
  label: string;
  value: string;
  hint: string;
  calc: boolean; // true = calculado de verdade; false = "Aguardando regra"
}

interface KpiCarouselProps {
  geral: KpiCard[];
  integridade: KpiCard[];
}

function KpiGrid({ cards }: { cards: KpiCard[] }) {
  return (
    <div className="kpi-slide-grid">
      {cards.map((card) => (
        <div key={card.label} className={`kpi-card ${card.calc ? "calc" : "pending-rule"}`}>
          <div className="kpi-card-top">
            <span className="kpi-card-icon">{card.icon}</span>
            <span className="kpi-card-label">{card.label}</span>
          </div>
          <div className="kpi-card-value">{card.value}</div>
          <div className="kpi-card-hint">{card.hint}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Carrossel de Big Numbers, conforme o HTML oficial. Todos os 14 cards do
 * protótipo são preservados; os 9 sem fórmula definida no HTML/projeto
 * mostram "Aguardando regra" em vez de um número inventado.
 */
export function KpiCarousel({ geral, integridade }: KpiCarouselProps) {
  const slides = [
    { title: "Geral", cards: geral },
    { title: "Integridade de bases", cards: integridade },
  ];
  const [index, setIndex] = useState(0);
  const slide = slides[index];

  return (
    <div className="kpi-carousel">
      <div className="kpi-carousel-head">
        <div className="kpi-carousel-title">
          <span>▥</span>
          <span>Números</span>
        </div>
        <div className="kpi-carousel-view">{slide.title}</div>
        <div className="kpi-nav">
          <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} aria-label="Slide anterior">
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
            disabled={index === slides.length - 1}
            aria-label="Próximo slide"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <KpiGrid cards={slide.cards} />
    </div>
  );
}
