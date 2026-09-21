"use client";

import { useState } from "react";

type Parte = { nome: string; url: string };
type ArquivoDestino = { createWritable(): Promise<FileSystemWritableFileStream> };
type JanelaComSalvar = Window & {
  showSaveFilePicker?: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<ArquivoDestino>;
};

const encoder = new TextEncoder();
const MAX_ZIP32 = 0xffffffff;

function registro(tamanho: number) {
  return new DataView(new ArrayBuffer(tamanho));
}

function tabelaCrc() {
  return Array.from({ length: 256 }, (_, indice) => {
    let valor = indice;
    for (let i = 0; i < 8; i++) valor = valor & 1 ? (valor >>> 1) ^ 0xedb88320 : valor >>> 1;
    return valor >>> 0;
  });
}
const CRC = tabelaCrc();

function atualizarCrc(crc: number, dados: Uint8Array) {
  for (const byte of dados) crc = (crc >>> 8) ^ CRC[(crc ^ byte) & 255];
  return crc;
}

async function gravarZip(destino: FileSystemWritableFileStream, partes: Parte[], progresso: (mensagem: string) => void) {
  let posicao = 0;
  const entradas: Array<{ nome: Uint8Array; crc: number; tamanho: number; inicio: number }> = [];
  const escrever = async (dados: Uint8Array) => {
    if (posicao + dados.length > MAX_ZIP32) throw new Error("A base excedeu o limite do ZIP; tente novamente ou consulte o suporte.");
    await destino.write(new Uint8Array(dados));
    posicao += dados.length;
  };

  for (const [indice, parte] of partes.entries()) {
    progresso(`Baixando parte ${indice + 1} de ${partes.length}...`);
    const resposta = await fetch(parte.url);
    if (!resposta.ok || !resposta.body) throw new Error(`Falha ao baixar a parte ${indice + 1}.`);
    const nome = encoder.encode(parte.nome);
    if (nome.length > 65535) throw new Error("Nome de arquivo invÃ¡lido.");
    const inicio = posicao;
    const cabecalho = registro(30);
    cabecalho.setUint32(0, 0x04034b50, true);
    cabecalho.setUint16(4, 20, true);
    cabecalho.setUint16(6, 0x808, true); // UTF-8 e valores no descritor final
    cabecalho.setUint16(26, nome.length, true);
    await escrever(new Uint8Array(cabecalho.buffer));
    await escrever(nome);

    const leitor = resposta.body.getReader();
    let crc = 0xffffffff;
    let tamanho = 0;
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      tamanho += value.length;
      if (tamanho > MAX_ZIP32) throw new Error("Parte muito grande para o ZIP.");
      crc = atualizarCrc(crc, value);
      await escrever(value);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const descritor = registro(16);
    descritor.setUint32(0, 0x08074b50, true);
    descritor.setUint32(4, crc, true);
    descritor.setUint32(8, tamanho, true);
    descritor.setUint32(12, tamanho, true);
    await escrever(new Uint8Array(descritor.buffer));
    entradas.push({ nome, crc, tamanho, inicio });
  }

  progresso("Finalizando ZIP...");
  const inicioIndice = posicao;
  for (const entrada of entradas) {
    const central = registro(46);
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x808, true);
    central.setUint32(16, entrada.crc, true);
    central.setUint32(20, entrada.tamanho, true);
    central.setUint32(24, entrada.tamanho, true);
    central.setUint16(28, entrada.nome.length, true);
    central.setUint32(42, entrada.inicio, true);
    await escrever(new Uint8Array(central.buffer));
    await escrever(entrada.nome);
  }
  const tamanhoIndice = posicao - inicioIndice;
  const fim = registro(22);
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, entradas.length, true);
  fim.setUint16(10, entradas.length, true);
  fim.setUint32(12, tamanhoIndice, true);
  fim.setUint32(16, inicioIndice, true);
  await escrever(new Uint8Array(fim.buffer));
}

export function DownloadAdminZip() {
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function baixar() {
    const salvar = (window as JanelaComSalvar).showSaveFilePicker;
    if (!salvar) {
      setMensagem("Este navegador nÃ£o permite salvar o ZIP durante o download. Use o Chrome atualizado.");
      return;
    }
    let destino: FileSystemWritableFileStream | undefined;
    try {
      // A janela de salvamento precisa abrir diretamente apÃ³s o clique.
      const arquivo = await salvar.call(window, {
        suggestedName: "base-completa.zip",
        types: [{ description: "Arquivo ZIP", accept: { "application/zip": [".zip"] } }],
      });
      destino = await arquivo.createWritable();
      setOcupado(true);
      setMensagem("Preparando download...");
      const resposta = await fetch("/base-completa/download/manifest", { cache: "no-store" });
      const dados = await resposta.json() as { partes?: Parte[]; error?: string };
      if (!resposta.ok || !dados.partes?.length) throw new Error(dados.error || "Base indisponÃ­vel.");
      await gravarZip(destino, dados.partes, setMensagem);
      await destino.close();
      destino = undefined;
      setMensagem("Download finalizado.");
    } catch (erro) {
      await destino?.abort().catch(() => {});
      if ((erro as Error).name !== "AbortError") setMensagem((erro as Error).message || "Falha no download.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={baixar} disabled={ocupado} className="btn-transporter">
        {ocupado ? "Preparando base..." : "Baixar base completa em um ZIP"}
      </button>
      {mensagem && <p role="status">{mensagem}</p>}
    </div>
  );
}

