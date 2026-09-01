"use client";

import { PRIMARY_COLUMNS, FILL_COLUMNS, PROTECTED_COLUMNS } from "@/lib/pedidos-devolucao-validation";
import { ORDEM_COLUNAS_TABELA, type LinhaTabela } from "@/lib/pedidos-table-row";

const LIMITE_LINHAS_EXIBIDAS = 1000;

function classeColuna(col: string): string {
  if ((PRIMARY_COLUMNS as readonly string[]).includes(col)) return "primary-col";
  if ((FILL_COLUMNS as readonly string[]).includes(col)) return "fill-col";
  if ((PROTECTED_COLUMNS as readonly string[]).includes(col)) return "protected-extra";
  return "";
}

interface PedidosTableProps {
  linhas: LinhaTabela[];
  busca: string;
  mostrarProtegidas: boolean;
  onToggleProtegidas: () => void;
}

/**
 * Mesma estrutura do renderTable() do HTML oficial: grupo de toggle das
 * colunas protegidas (duplo clique, "+"/"−") logo acima da tabela, dentro
 * de .table-wrap (com scroll, max-height:520px como no protótipo).
 */
export function PedidosTable({ linhas, busca, mostrarProtegidas, onToggleProtegidas }: PedidosTableProps) {
  const colunasProtegidasExistem = PROTECTED_COLUMNS.length > 0;

  const q = busca.trim().toLowerCase();
  const filtradas = !q
    ? linhas
    : linhas.filter((linha) => Object.values(linha.colunas).some((v) => v.toLowerCase().includes(q)));

  const colunasVisiveis = ORDEM_COLUNAS_TABELA.filter(
    (col) =>
      mostrarProtegidas ||
      (PRIMARY_COLUMNS as readonly string[]).includes(col) ||
      !(PROTECTED_COLUMNS as readonly string[]).includes(col),
  );

  const visiveis = filtradas.slice(0, LIMITE_LINHAS_EXIBIDAS);

  if (!linhas.length) {
    return <div className="empty">Nenhuma base carregada para esta visão.</div>;
  }

  return (
    <>
      {colunasProtegidasExistem ? (
        <div className="excel-column-group">
          <span className="excel-group-line" />
          <button
            type="button"
            className="excel-group-toggle"
            onDoubleClick={onToggleProtegidas}
            title={mostrarProtegidas ? "Clique duas vezes para ocultar as colunas protegidas" : "Clique duas vezes para mostrar as colunas protegidas"}
          >
            {mostrarProtegidas ? "−" : "+"}
          </button>
          <span className="excel-group-line" />
          <span className="excel-group-hint">
            {mostrarProtegidas ? "duplo clique para recolher" : "duplo clique para mostrar colunas protegidas"}
          </span>
        </div>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
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
                {colunasVisiveis.map((col) => (
                  <td key={col} className={classeColuna(col)}>
                    {linha.colunas[col] || ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtradas.length > LIMITE_LINHAS_EXIBIDAS ? (
        <div style={{ paddingTop: 8, fontSize: 11, color: "var(--gray)" }}>
          Exibindo as primeiras {LIMITE_LINHAS_EXIBIDAS.toLocaleString("pt-BR")} de {filtradas.length.toLocaleString("pt-BR")} linhas filtradas.
        </div>
      ) : null}
    </>
  );
}
