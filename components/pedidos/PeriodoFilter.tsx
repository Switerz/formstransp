"use client";

import { type CSSProperties, useMemo, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

interface TransportadoraOption {
  id: string;
  nome: string;
}

interface PeriodoFilterProps {
  action: string;
  de: string;
  ate: string;
  hiddenFields?: Record<string, string>;
  transportadoras?: TransportadoraOption[];
  transportadoraId?: string;
  datasDisponiveis?: string[];
  compact?: boolean;
  fillFilter?: "todas" | "preenchidas";
  allHref?: string;
  filledHref?: string;
}

function formatarBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function isoParaDataLocal(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function dataLocalParaIso(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function PeriodoFilter({
  action,
  de,
  ate,
  hiddenFields,
  transportadoras,
  transportadoraId,
  datasDisponiveis,
  compact = false,
  fillFilter,
  allHref,
  filledHref,
}: PeriodoFilterProps) {
  const [aberto, setAberto] = useState(false);
  const [deSelecionado, setDeSelecionado] = useState(de);
  const [ateSelecionado, setAteSelecionado] = useState(ate);
  const [campoAtivo, setCampoAtivo] = useState<"de" | "ate">("de");

  const datasSet = useMemo(
    () => new Set(datasDisponiveis ?? []),
    [datasDisponiveis],
  );

  const usarCalendarioDisponibilidade =
    Array.isArray(datasDisponiveis) && datasDisponiveis.length > 0;

  const primeiraData = usarCalendarioDisponibilidade
    ? isoParaDataLocal(datasDisponiveis![0])
    : undefined;

  const ultimaData = usarCalendarioDisponibilidade
    ? isoParaDataLocal(datasDisponiveis![datasDisponiveis!.length - 1])
    : undefined;

  const selecionarData = (data: Date | undefined) => {
    if (!data) return;

    const iso = dataLocalParaIso(data);

    if (usarCalendarioDisponibilidade && !datasSet.has(iso)) {
      return;
    }

    if (campoAtivo === "de") {
      setDeSelecionado(iso);

      if (iso > ateSelecionado) {
        setAteSelecionado(iso);
      }

      setCampoAtivo("ate");
      return;
    }

    if (iso < deSelecionado) {
      setDeSelecionado(iso);
    }

    setAteSelecionado(iso);
  };

  const dataCalendario =
    campoAtivo === "de"
      ? isoParaDataLocal(deSelecionado)
      : isoParaDataLocal(ateSelecionado);

  const calendarStyle = {
    "--rdp-day-width": "34px",
    "--rdp-day-height": "34px",
    "--rdp-day_button-width": "30px",
    "--rdp-day_button-height": "30px",
    "--rdp-weekday-padding": "4px",
    width: "100%",
    margin: 0,
    fontSize: "12px",
  } as CSSProperties;

  return (
    <div
      className="periodo-filter"
      style={{
        position: "relative",
        width: compact ? "auto" : undefined,
        margin: 0,
      }}
    >
      <button
        type="button"
        className="periodo-filter-toggle"
        onClick={() => setAberto((valor) => !valor)}
        aria-expanded={aberto}
        style={
          compact
            ? {
                minHeight: 40,
                width: "auto",
                padding: "0 12px",
                whiteSpace: "nowrap",
              }
            : undefined
        }
      >
        {!compact ? (
          <span className="periodo-filter-label">Filtros</span>
        ) : null}

        <span className="periodo-filter-summary">
          <Calendar size={13} />
          {compact && fillFilter ? (
            <>
              {fillFilter === "preenchidas" ? "Somente preenchidas" : "Todas"}
              {" • "}
            </>
          ) : null}
          {formatarBr(deSelecionado)} até {formatarBr(ateSelecionado)}
          <ChevronDown
            size={14}
            className={`periodo-filter-chevron ${aberto ? "open" : ""}`}
          />
        </span>
      </button>

      {aberto ? (
        <form
          className="periodo-filter-body"
          action={action}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            left: "auto",
            zIndex: 200,
            display: "block",
            width: 390,
            maxWidth: "calc(100vw - 32px)",
            padding: 16,
            background: "#fff",
            border: "1px solid #dbe3ee",
            borderRadius: 12,
            boxShadow: "0 14px 38px rgba(15, 39, 66, 0.18)",
          }}
        >
          {Object.entries(hiddenFields ?? {}).map(([name, value]) =>
            value ? (
              <input key={name} type="hidden" name={name} value={value} />
            ) : null,
          )}

          <input type="hidden" name="de" value={deSelecionado} />
          <input type="hidden" name="ate" value={ateSelecionado} />

          {compact && fillFilter && allHref && filledHref ? (
            <div className="field" style={{ marginBottom: 14 }}>
              <label>Visualização</label>

              <select
                value={fillFilter}
                onChange={(e) => {
                  const destino =
                    e.target.value === "preenchidas"
                      ? filledHref
                      : allHref;

                  window.location.href = destino;
                }}
                style={{ width: "100%" }}
              >
                <option value="todas">Todas</option>
                <option value="preenchidas">Somente preenchidas</option>
              </select>
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: transportadoras ? "1fr 1fr" : "1fr",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <div className="field" style={{ minWidth: 0 }}>
              <label>Data</label>
              <select
                defaultValue="promessa_transporte"
                disabled
                style={{ width: "100%" }}
              >
                <option value="promessa_transporte">
                  Promessa Transporte
                </option>
              </select>
            </div>

            {transportadoras ? (
              <div className="field" style={{ minWidth: 0 }}>
                <label>Transportadora</label>

                <select
                  name="transportadoraId"
                  defaultValue={transportadoraId ?? ""}
                  style={{ width: "100%" }}
                >
                  <option value="">Todas</option>

                  {transportadoras.map((transportadora) => (
                    <option
                      key={transportadora.id}
                      value={transportadora.id}
                    >
                      {transportadora.nome}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {usarCalendarioDisponibilidade ? (
            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: 700,
                  marginBottom: 7,
                }}
              >
                Período
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <button
                  type="button"
                  className={
                    campoAtivo === "de"
                      ? "btn"
                      : "btn secondary"
                  }
                  onClick={() => setCampoAtivo("de")}
                  style={{
                    width: "100%",
                    paddingLeft: 8,
                    paddingRight: 8,
                  }}
                >
                  De: {formatarBr(deSelecionado)}
                </button>

                <button
                  type="button"
                  className={
                    campoAtivo === "ate"
                      ? "btn"
                      : "btn secondary"
                  }
                  onClick={() => setCampoAtivo("ate")}
                  style={{
                    width: "100%",
                    paddingLeft: 8,
                    paddingRight: 8,
                  }}
                >
                  Até: {formatarBr(ateSelecionado)}
                </button>
              </div>

              <div
                style={{
                  width: "100%",
                  overflow: "hidden",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 8,
                  background: "#fff",
                }}
              >
                <DayPicker
                  mode="single"
                  selected={dataCalendario}
                  onSelect={selecionarData}
                  defaultMonth={dataCalendario}
                  startMonth={primeiraData}
                  endMonth={ultimaData}
                  disabled={(data) =>
                    !datasSet.has(dataLocalParaIso(data))
                  }
                  modifiers={{
                    semDados: (data) =>
                      !datasSet.has(dataLocalParaIso(data)),
                  }}
                  modifiersStyles={{
                    semDados: {
                      opacity: 0.25,
                      textDecoration: "line-through",
                    },
                  }}
                  styles={{
                    root: calendarStyle,
                    month: {
                      width: "100%",
                      maxWidth: "100%",
                    },
                  }}
                  showOutsideDays
                />
              </div>

              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.3,
                  color: "#64748b",
                  marginTop: 6,
                }}
              >
                Dias apagados não possuem dados de Promessa Transporte.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div className="field">
                <label>De</label>
                <input
                  type="date"
                  value={deSelecionado}
                  onChange={(e) => setDeSelecionado(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Até</label>
                <input
                  type="date"
                  value={ateSelecionado}
                  onChange={(e) => setAteSelecionado(e.target.value)}
                />
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 14,
            }}
          >
            <button className="btn" type="submit">
              Aplicar período
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}