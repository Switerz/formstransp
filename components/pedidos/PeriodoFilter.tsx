"use client";

import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";

interface TransportadoraOption {
  id: string;
  nome: string;
}

interface PeriodoFilterProps {
  action: string;
  de: string;
  ate: string;
  /** Outros campos do formulário atual (ex.: transportadoraId) que devem ser preservados ao submeter este filtro junto. */
  hiddenFields?: Record<string, string>;
  /**
   * Opcional - só usado pela Base Completa (acesso interno). Quando
   * presente, adiciona um campo "Transportadora" ao painel expandido,
   * para o time interno escolher uma transportadora específica ou deixar
   * em branco para ver todas. Minha Base/Início nunca passam essa prop,
   * então continuam exatamente como estavam (sem esse campo).
   */
  transportadoras?: TransportadoraOption[];
  transportadoraId?: string;
}

function formatarBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * Filtro de período compacto e expansível, reutilizado em Minha Base e na
 * aba Início. Fechado: só "Filtros" (sem seta) + resumo do período + a
 * seta de expandir/recolher, que fica exclusivamente ao lado das datas.
 * Aberto: Data (Promessa Transporte) / De / Até / Aplicar período.
 */
export function PeriodoFilter({ action, de, ate, hiddenFields, transportadoras, transportadoraId }: PeriodoFilterProps) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="periodo-filter">
      <button
        type="button"
        className="periodo-filter-toggle"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
      >
        <span className="periodo-filter-label">Filtros</span>
        <span className="periodo-filter-summary">
          <Calendar size={13} />
          {formatarBr(de)} até {formatarBr(ate)}
          <ChevronDown size={14} className={`periodo-filter-chevron ${aberto ? "open" : ""}`} />
        </span>
      </button>

      {aberto ? (
        <form className="periodo-filter-body" action={action}>
          {Object.entries(hiddenFields ?? {}).map(([name, value]) =>
            value ? <input key={name} type="hidden" name={name} value={value} /> : null,
          )}
          <div className="field">
            <label htmlFor="referenciaData">Data</label>
            <select id="referenciaData" name="referenciaData" defaultValue="promessa_transporte" disabled>
              <option value="promessa_transporte">Promessa Transporte</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="de">De</label>
            <input type="date" id="de" name="de" defaultValue={de} />
          </div>
          <div className="field">
            <label htmlFor="ate">Até</label>
            <input type="date" id="ate" name="ate" defaultValue={ate} />
          </div>
          {transportadoras ? (
            <div className="field">
              <label htmlFor="transportadoraId">Transportadora</label>
              <select id="transportadoraId" name="transportadoraId" defaultValue={transportadoraId ?? ""}>
                <option value="">Todas</option>
                {transportadoras.map((transportadora) => (
                  <option key={transportadora.id} value={transportadora.id}>
                    {transportadora.nome}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="actions" style={{ alignItems: "end" }}>
            <button className="btn" type="submit">
              Aplicar período
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
