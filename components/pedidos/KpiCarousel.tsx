"use client";

import { useRef, useState } from "react";

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

  // ---- Arraste (mouse/touch/pen unificados via Pointer Events) ----
  const viewportRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const widthRef = useRef(1);
  const axisLockedRef = useRef<"x" | "y" | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  const THRESHOLD_RATIO = 0.18; // % da largura do slide para trocar
  const EDGE_RESISTANCE = 0.35; // resistência ao tentar arrastar além da primeira/última

  function clampOffset(offset: number) {
    if (index === 0 && offset > 0) return offset * EDGE_RESISTANCE;
    if (index === slides.length - 1 && offset < 0) return offset * EDGE_RESISTANCE;
    return offset;
  }

  function onPointerDown(e: React.PointerEvent) {
    // Ignora clique com botão secundário/terciário do mouse.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    widthRef.current = viewportRef.current?.offsetWidth || 1;
    axisLockedRef.current = null;
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (pointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    // Define o eixo do gesto na primeira movimentação relevante: se for
    // majoritariamente vertical, libera o scroll da página (não arrasta o
    // carrossel) - é o que o touch-action:pan-y do CSS já sinaliza.
    if (!axisLockedRef.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      axisLockedRef.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (axisLockedRef.current !== "x") return;

    e.preventDefault();
    setDragOffset(clampOffset(dx));
  }

  function finishDrag() {
    if (pointerIdRef.current === null) return;
    pointerIdRef.current = null;

    if (axisLockedRef.current === "x") {
      const threshold = widthRef.current * THRESHOLD_RATIO;
      if (dragOffset <= -threshold && index < slides.length - 1) setIndex((i) => i + 1);
      else if (dragOffset >= threshold && index > 0) setIndex((i) => i - 1);
    }

    axisLockedRef.current = null;
    setDragging(false);
    setDragOffset(0);
  }

  const trackTransform = dragging
    ? `translate3d(calc(-${index * 100}% + ${dragOffset}px),0,0)`
    : `translate3d(-${index * 100}%,0,0)`;

  return (
    <section className="kpi-carousel" id="kpiCarousel" aria-label="Indicadores">
      <div className="kpi-carousel-head">
        <div className="kpi-carousel-title">
          <span>▥</span>
          <span>Números</span>
        </div>
        <div className="kpi-carousel-view">{slides[index].title}</div>
      </div>

      <div
        className="kpi-carousel-viewport"
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onPointerLeave={(e) => {
          if (pointerIdRef.current === e.pointerId) finishDrag();
        }}
      >
        <div className={`kpi-carousel-track ${dragging ? "dragging" : ""}`} style={{ transform: trackTransform }}>
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
