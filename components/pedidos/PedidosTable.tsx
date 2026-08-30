"use client";

import { useMemo, useState } from "react";
import { PRIMARY_COLUMNS, FILL_COLUMNS, PROTECTED_COLUMNS } from "@/lib/pedidos-devolucao-validation";
import { ORDEM_COLUNAS_TABELA, linhaCorrespondeABusca, type LinhaTabela } from "@/lib/pedidos-table-row";

const LIMITE_LINHAS_EXIBIDAS = 1000;

function classeColuna(col: string): string {
  if ((PRIMARY_COLUMNS as readonly string[]).includes(col)) return "primary-col";
  if ((FILL_COLUMNS as readonly string[]).includes(col)) return "fill-col";
  if ((PROTECTED_COLUMNS as readonly string[]).includes(col)) return "protected-extra";
  return "";
}

function FillBadge({ status }: { status: LinhaTabela["fillStatus"] }) {
  const label = status === "done" ? "Completo" : status === "partial" ? "Parcial" : "Pendente";
  return <span className={`fill-badge ${status}`}>{label}</span>;
}

export function PedidosTable({ linhas }: { linhas: LinhaTabela[] }) {
  const [busca, setBusca] = useState("");
  const [mostrarProtegidas, setMostrarProtegidas] = useState(false);

  const colunasVisiveis = useMemo(
    () => ORDEM_COLUNAS_TABELA.filter((col) => mostrarProtegidas || !(PROTECTED_COLUMNS as readonly string[]).includes(col)),
    [mostrarProtegidas],
  );

  const filtradas = useMemo(() => {
    return linhas.filter((linha) => linhaCorrespondeABusca(linha, busca));
  }, [linhas, busca]);

  const visiveis = filtradas.slice(0, LIMITE_LINHAS_EXIBIDAS);

  return (
    <div>
      <div className="mb-toolbar">
        <input
          type="search"
          placeholder="Pesquisar em qualquer coluna..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button type="button" className="excel-group-toggle" onClick={() => setMostrarProtegidas((v) => !v)}>
          {mostrarProtegidas ? "Ocultar colunas protegidas" : "Mostrar colunas protegidas"}
        </button>
        <span className="fill-badge pending">Pendente</span>
        <span className="fill-badge partial">Parcial</span>
        <span className="fill-badge done">Completo</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Preenchimento</th>
              <th>Ofensor GB</th>
              {colunasVisiveis.map((col) => (
                <th key={col} className={classeColuna(col)}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((linha) => (
              <tr key={linha.id}>
                <td>
                  <FillBadge status={linha.fillStatus} />
                </td>
                <td>{linha.ofensorGb ?? "-"}</td>
                {colunasVisiveis.map((col) => (
                  <td key={col} className={classeColuna(col)}>
                    {linha.colunas[col] || "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtradas.length > LIMITE_LINHAS_EXIBIDAS ? (
        <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          Exibindo as primeiras {LIMITE_LINHAS_EXIBIDAS.toLocaleString("pt-BR")} de{" "}
          {filtradas.length.toLocaleString("pt-BR")} linhas filtradas.
        </p>
      ) : null}
    </div>
  );
}
