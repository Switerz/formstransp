"use client";

import { useState } from "react";
import { PedidosTable } from "@/components/pedidos/PedidosTable";
import type { LinhaTabela } from "@/lib/pedidos-table-row";

interface PedidosTablePanelProps {
  linhas: LinhaTabela[];
  title: string;
  hint: string;
}

/**
 * Reaproveita o MESMO componente PedidosTable (25 colunas, mesma
 * distinção primária/preenchível/protegida, mesma busca) usado dentro de
 * BasePanel.tsx (Minha Base) - só sem as partes específicas de devolução
 * (upload/abas/comparativo), que não fazem sentido numa visão interna.
 * Extraído como componente pequeno e seguro, sem tocar em BasePanel.tsx
 * nem em nenhum arquivo de Minha Base.
 */
export function PedidosTablePanel({ linhas, title, hint }: PedidosTablePanelProps) {
  const [busca, setBusca] = useState("");
  const [mostrarProtegidas, setMostrarProtegidas] = useState(false);

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-left">
          <strong>{title}</strong>
          <div>{hint}</div>
        </div>
        <input
          className="search"
          placeholder="Pesquisar em qualquer coluna..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      <PedidosTable
        linhas={linhas}
        busca={busca}
        mostrarProtegidas={mostrarProtegidas}
        onToggleProtegidas={() => setMostrarProtegidas((v) => !v)}
      />
    </>
  );
}
