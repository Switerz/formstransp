"use client";

import { useState } from "react";

type JanelaSalvar = Window & {
  showSaveFilePicker?: (opcoes: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<{ createWritable(): Promise<FileSystemWritableFileStream> }>;
};

export function DownloadAdminCsv() {
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function baixar() {
    const salvar = (window as JanelaSalvar).showSaveFilePicker;
    if (!salvar) {
      setMensagem("Use o Chrome atualizado para salvar o CSV consolidado.");
      return;
    }
    let destino: FileSystemWritableFileStream | undefined;
    try {
      const arquivo = await salvar.call(window, {
        suggestedName: "base-consolidada.csv",
        types: [{ description: "Arquivo CSV", accept: { "text/csv": [".csv"] } }],
      });
      destino = await arquivo.createWritable();
      setOcupado(true);
      setMensagem("Preparando CSV...");
      const resposta = await fetch("/base-completa/download/csv-manifest", { cache: "no-store" });
      const dados = await resposta.json() as { partes?: Array<{ url: string }>; error?: string };
      if (!resposta.ok || !dados.partes?.length) throw new Error(dados.error || "CSV indisponível.");
      for (const [indice, parte] of dados.partes.entries()) {
        setMensagem(`Baixando CSV: parte ${indice + 1} de ${dados.partes.length}...`);
        const respostaParte = await fetch(parte.url);
        if (!respostaParte.ok || !respostaParte.body) throw new Error(`Falha na parte ${indice + 1}.`);
        const leitor = respostaParte.body.getReader();
        while (true) {
          const { done, value } = await leitor.read();
          if (done) break;
          await destino.write(new Uint8Array(value));
        }
      }
      await destino.close();
      destino = undefined;
      setMensagem("CSV finalizado.");
    } catch (erro) {
      await destino?.abort().catch(() => {});
      if ((erro as Error).name !== "AbortError") setMensagem((erro as Error).message || "Falha no CSV.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={baixar} disabled={ocupado} className="btn-transporter">
        {ocupado ? "Preparando CSV..." : "Baixar base consolidada (CSV)"}
      </button>
      {mensagem && <p role="status">{mensagem}</p>}
    </div>
  );
}
