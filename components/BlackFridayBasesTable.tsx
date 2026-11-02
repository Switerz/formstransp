"use client";

import { useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";

export type BlackFridayBaseRow = {
  id: string;
  nome: string;
  total: string;
  sla: string;
  atualizacao: string;
  upload: string;
  situacao: string;
  totalGeral?: boolean;
};

type Props = {
  rows: BlackFridayBaseRow[];
};

export default function BlackFridayBasesTable({ rows }: Props) {
  const [aberto, setAberto] = useState(false);
  const transportadoras = rows.filter((item) => item.id !== "__total_geral__");

  useEffect(() => {
    if (!aberto) return;

    function fecharComEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setAberto(false);
    }

    const overflowAnterior = document.body.style.overflow;

    document.addEventListener("keydown", fecharComEsc);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", fecharComEsc);
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto]);

  function tabela(completa: boolean) {
    const exibidas = completa ? rows : transportadoras.slice(0, 9);

    return (
      <div className="bf-modal-table-wrap">
        <table className="risk-table bf-expanded-table">
          <thead>
            <tr>
              <th>Transportadora</th>
              <th>Total da base</th>
              <th>SLA</th>
              <th>Atualização da base</th>
              <th>Último upload</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {exibidas.map((item) => (
              <tr key={item.id} className={item.id === "__total_geral__" ? "bf-total-row" : undefined}>
                <td><strong>{item.nome}</strong></td>
                <td>{item.total}</td>
                <td>{item.sla}%</td>
                <td>{item.atualizacao}</td>
                <td>{item.upload}</td>
                <td>{item.situacao}</td>
              </tr>
            ))}
            {!completa && transportadoras.length > 9 && (
              <tr>
                <td colSpan={6} className="bf-more-rows">
                  + {transportadoras.length - 9} transportadoras na tabela completa
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <section className="card bf-admin-table-card">
        <div className="bf-table-heading">
          <div>
            <h2 className="section-title">Resumo das Bases Atualizadas</h2>
            <p className="muted">
              Transportadoras com base oficial publicada no Drive.
            </p>
          </div>

          <button
            type="button"
            className="bf-expand-button"
            onClick={() => setAberto(true)}
          >
            <Maximize2 size={15} />
            Ampliar tabela
          </button>
        </div>

        {tabela(false)}
      </section>

      {aberto && (
        <div
          className="bf-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAberto(false);
          }}
        >
          <section
            className="bf-table-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bf-modal-title"
          >
            <header className="bf-modal-header">
              <div>
                <span className="bf-modal-kicker">BLACK FRIDAY 2026</span>
                <h2 id="bf-modal-title">Resumo das Bases Atualizadas</h2>
                <p>{transportadoras.length} transportadoras na visualização completa</p>
              </div>

              <button
                type="button"
                className="bf-modal-close"
                onClick={() => setAberto(false)}
                aria-label="Fechar tabela"
              >
                <X size={21} />
              </button>
            </header>

            {tabela(true)}
          </section>
        </div>
      )}
    </>
  );
}
