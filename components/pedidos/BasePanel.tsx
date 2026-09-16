"use client";

import { useRouter } from "next/navigation";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { PedidosTable } from "@/components/pedidos/PedidosTable";
import type { LinhaTabela } from "@/lib/pedidos-table-row";
import type { DevolucaoResumo } from "@/app/portal/minha-base/actions";
import type { BaseOriginalResumo } from "@/app/base-completa/actions";

type Tab = "original" | "updated" | "compare";

interface TransportadoraOption {
  id: string;
  nome: string;
}

interface BasePanelProps {
  linhas: LinhaTabela[];
  lastBaseUpdateLabel: string;
  hasBaseUpdate: boolean;
  initialResumo?: DevolucaoResumo | null;
  lastDevolucaoLabel?: string;
  hasDevolucaoHoje?: boolean;
  fillPending: number;
  fillPartial: number;
  fillDone: number;
  serverFillFilter?: "todas" | "preenchidas";
  totalRows?: number;
  page?: number;
  totalPages?: number;
  previousHref?: string;
  nextHref?: string;
  allHref?: string;
  filledHref?: string;
  toolbarDateFilter?: React.ReactNode;
  downloadHref: string;
  /**
   * Opcional. Quando ausente (transportadora comum), o lado "Base
   * atualizada" fica indisponível junto com o resto do fluxo de
   * devolução. Quando presente (Base Completa/acesso interno), a
   * devolução é enviada em nome da transportadora escolhida em
   * transportadorasParaSelecao (obrigatório nesse caso) - a Server
   * Action valida isso no servidor (requireInternalAdmin), nunca confia
   * só no frontend.
   */
  uploadAction?: (formData: FormData) => Promise<DevolucaoResumo>;
  /**
   * Opcional. Quando ausente (transportadora comum), o lado "Base
   * original" continua bloqueado/decorativo, exatamente como sempre foi
   * (a base de origem é 100% automática via Intelipost). Quando presente
   * (Base Completa/acesso interno), libera o upload manual de origem -
   * protegido no servidor por requireInternalAdmin dentro da própria
   * action, nunca só escondendo/mostrando botão.
   */
  uploadOriginalAction?: (formData: FormData) => Promise<BaseOriginalResumo>;
  /** Lista de transportadoras para o seletor da devolução em modo interno. Sem isso, o upload de devolução não sabe a quem atribuir a base. */
  transportadorasParaSelecao?: TransportadoraOption[];
  downloadLabel?: string;
  backendNote?: string;
}

const TAB_INFO: Record<Tab, { title: string; hint: (n: number) => string }> = {
  original: { title: "Visualização da base original", hint: (n) => (n ? `${n.toLocaleString("pt-BR")} registros carregados.` : "Nenhuma base carregada.") },
  updated: { title: "Visualização da base atualizada", hint: (n) => (n ? `${n.toLocaleString("pt-BR")} registros carregados.` : "Nenhuma base atualizada carregada.") },
  compare: { title: "Comparativo antes x depois", hint: () => "Alterações da última devolução recebida." },
};

export function BasePanel({
  linhas,
  lastBaseUpdateLabel,
  hasBaseUpdate,
  initialResumo = null,
  lastDevolucaoLabel = "Nenhuma devolução recebida",
  hasDevolucaoHoje = false,
  fillPending,
  fillPartial,
  fillDone,
  serverFillFilter,
  totalRows,
  page = 1,
  totalPages = 1,
  previousHref,
  nextHref,
  allHref,
  filledHref,
  toolbarDateFilter,
  downloadHref,
  uploadAction,
  uploadOriginalAction,
  transportadorasParaSelecao,
  downloadLabel = "Baixar minha base",
  backendNote = "Você está autenticado como transportadora - os downloads e a devolução acima só afetam os pedidos vinculados à sua sessão.",
}: BasePanelProps) {
  const router = useRouter();
  const permiteDevolucao = Boolean(uploadAction);
  const permiteBaseOriginal = Boolean(uploadOriginalAction);
  const mostrarAccordion = permiteDevolucao || permiteBaseOriginal;
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("original");
  const [busca, setBusca] = useState("");
  const [filtroPreenchimento, setFiltroPreenchimento] = useState<"todas" | "preenchidas">("todas");
  const [mostrarProtegidas, setMostrarProtegidas] = useState(false);
  const [resumo, setResumo] = useState<DevolucaoResumo | null>(initialResumo);
  const [devolucaoRecebidaHoje, setDevolucaoRecebidaHoje] = useState(hasDevolucaoHoje);
  const [ultimaDevolucaoLabelAtual, setUltimaDevolucaoLabelAtual] = useState(lastDevolucaoLabel);
  const [erro, setErro] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [alertOpen, setAlertOpen] = useState(false);
  const [arquivoAtualNome, setArquivoAtualNome] = useState("");
  const [progressoUpload, setProgressoUpload] = useState(0);
  const [linhasUploadTotal, setLinhasUploadTotal] = useState(0);
  const [linhasUploadProcessadas, setLinhasUploadProcessadas] = useState(0);
  const [processandoUpload, setProcessandoUpload] = useState(false);

  const [origResumo, setOrigResumo] = useState<BaseOriginalResumo | null>(null);
  const [origErro, setOrigErro] = useState<string | null>(null);
  const [origPending, startOrigTransition] = useTransition();
  const [arquivoOriginalNome, setArquivoOriginalNome] = useState("");

  function somarResumos(anterior: DevolucaoResumo, atual: DevolucaoResumo): DevolucaoResumo {
    return {
      ...atual,
      totalLinhas: anterior.totalLinhas + atual.totalLinhas,
      aplicados: anterior.aplicados + atual.aplicados,
      semAlteracao: anterior.semAlteracao + atual.semAlteracao,
      erros: anterior.erros + atual.erros,
      pedidosNaoEncontrados: anterior.pedidosNaoEncontrados + atual.pedidosNaoEncontrados,
      pedidosDeOutraTransportadora:
        anterior.pedidosDeOutraTransportadora + atual.pedidosDeOutraTransportadora,
      detalhes: [...anterior.detalhes, ...atual.detalhes].slice(0, 250),
    };
  }

  async function enviarArquivoGrandeEmLotes(file: File, formDataOriginal: FormData) {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await file.arrayBuffer()) as ArrayBuffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("A planilha não possui nenhuma aba para processar.");

    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? "").trim();
    });

    const linhas: Record<string, unknown>[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const item: Record<string, unknown> = {};
      let temValor = false;

      headers.forEach((header, index) => {
        if (!header) return;
        let valor: unknown = row.getCell(index + 1).value;
        if (valor instanceof Date) valor = valor.toISOString();
        if (valor && typeof valor === "object" && "text" in (valor as Record<string, unknown>)) {
          valor = (valor as { text: unknown }).text;
        }
        if (valor && typeof valor === "object" && "result" in (valor as Record<string, unknown>)) {
          valor = (valor as { result: unknown }).result;
        }
        item[header] = valor ?? "";
        if (String(valor ?? "").trim()) temValor = true;
      });

      if (temValor) linhas.push(item);
    });

    if (!linhas.length) throw new Error("A planilha não possui pedidos para processar.");
    setLinhasUploadTotal(linhas.length);
    setLinhasUploadProcessadas(0);

    // Lotes adaptativos: aceleram bases grandes sem ultrapassar o limite de
    // corpo das funções da Vercel. O teto em bytes prevalece sobre a quantidade.
    const MAX_LINHAS_LOTE = 3_000;
    const MAX_BYTES_LOTE = 2.5 * 1024 * 1024;
    const lotes: Array<{ inicio: number; linhas: Record<string, unknown>[] }> = [];
    let loteAtualLinhas: Record<string, unknown>[] = [];
    let loteAtualBytes = 2;
    let inicioLote = 0;

    for (let indice = 0; indice < linhas.length; indice += 1) {
      const linha = linhas[indice];
      const tamanhoLinha = new TextEncoder().encode(JSON.stringify(linha)).length + 1;
      const precisaFechar =
        loteAtualLinhas.length > 0 &&
        (loteAtualLinhas.length >= MAX_LINHAS_LOTE || loteAtualBytes + tamanhoLinha > MAX_BYTES_LOTE);

      if (precisaFechar) {
        lotes.push({ inicio: inicioLote, linhas: loteAtualLinhas });
        inicioLote = indice;
        loteAtualLinhas = [];
        loteAtualBytes = 2;
      }

      loteAtualLinhas.push(linha);
      loteAtualBytes += tamanhoLinha;
    }

    if (loteAtualLinhas.length) lotes.push({ inicio: inicioLote, linhas: loteAtualLinhas });

    const totalLotes = lotes.length;
    let acumulado: DevolucaoResumo = {
      totalLinhas: 0,
      aplicados: 0,
      semAlteracao: 0,
      erros: 0,
      pedidosNaoEncontrados: 0,
      pedidosDeOutraTransportadora: 0,
      detalhes: [],
      arquivoNome: file.name,
      totalLotes,
    };

    for (let indice = 0; indice < totalLotes; indice += 1) {
      const { inicio, linhas: lote } = lotes[indice];
      const dadosLote = new FormData();
      const transportadoraId = formDataOriginal.get("transportadoraId");
      if (typeof transportadoraId === "string") dadosLote.set("transportadoraId", transportadoraId);
      dadosLote.set("loteJson", JSON.stringify(lote));
      dadosLote.set("arquivoNome", file.name);
      dadosLote.set("loteAtual", String(indice + 1));
      dadosLote.set("totalLotes", String(totalLotes));
      dadosLote.set("linhaInicial", String(inicio + 2));
      dadosLote.set("ultimoLote", String(indice === totalLotes - 1));
      if (indice === totalLotes - 1) {
        dadosLote.set("resumoAcumuladoJson", JSON.stringify(acumulado));
      }

      const resultado = await uploadAction!(dadosLote);
      if (resultado.erroSistema) throw new Error(resultado.erroSistema);
      acumulado = somarResumos(acumulado, resultado);
      setLinhasUploadProcessadas(Math.min(inicio + lote.length, linhas.length));
      setProgressoUpload(Math.round(((indice + 1) / totalLotes) * 100));
    }

    // O total de linhas vem da leitura local do Excel, portanto não depende
    // da resposta parcial do último lote.
    return {
      ...acumulado,
      totalLinhas: linhas.length,
      arquivoNome: file.name,
      loteAtual: totalLotes,
      totalLotes,
    };
  }

  function onSubmit(formData: FormData) {
    if (!uploadAction) return;
    setErro(null);
    setProgressoUpload(0);
    setLinhasUploadTotal(0);
    setLinhasUploadProcessadas(0);
    setProcessandoUpload(true);
    startTransition(async () => {
      try {
        const arquivo = formData.get("arquivo");
        if (!(arquivo instanceof File) || arquivo.size === 0) {
          throw new Error("Selecione um arquivo .xlsx preenchido antes de enviar.");
        }

        const result = arquivo.size > 3.5 * 1024 * 1024
          ? await enviarArquivoGrandeEmLotes(arquivo, formData)
          : await uploadAction(formData);

        if (arquivo.size <= 3.5 * 1024 * 1024) {
          setLinhasUploadTotal(result.totalLinhas);
          setLinhasUploadProcessadas(result.totalLinhas);
          setProgressoUpload(100);
        }

        if (result.erroSistema) {
          setResumo(null);
          setErro(result.erroSistema);
          return;
        }

        setResumo(result);
        setDevolucaoRecebidaHoje(true);
        setUltimaDevolucaoLabelAtual(
          new Date().toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            dateStyle: "short",
            timeStyle: "short",
          }),
        );
        setAccordionOpen(false);
        router.refresh();
      } catch (err) {
        const mensagem = err instanceof Error ? err.message : "";
        setErro(
          mensagem.includes("unexpected response")
            ? "O servidor interrompeu um dos lotes. Tente novamente; nenhum lote concluído será enviado outra vez automaticamente."
            : mensagem || "Não foi possível processar a devolução.",
        );
      } finally {
        setProcessandoUpload(false);
      }
    });
  }

  function onSubmitOriginal(formData: FormData) {
    if (!uploadOriginalAction) return;
    setOrigErro(null);
    startOrigTransition(async () => {
      try {
        const result = await uploadOriginalAction(formData);
        setOrigResumo(result);
      } catch (err) {
        setOrigErro(err instanceof Error ? err.message : "Não foi possível processar a base original.");
      }
    });
  }

  const violacoesProtegidas = resumo?.detalhes.flatMap((d) => d.violacoesProtegidas.map((v) => ({ ...v, linha: d.linha }))) ?? [];
  const tentativasBloqueadas = resumo?.detalhes.flatMap((d) => d.tentativasBloqueadas.map((v) => ({ ...v, linha: d.linha }))) ?? [];
  const alteracoesAplicadas = resumo?.detalhes.flatMap((d) => d.alteracoesAplicadas.map((v) => ({ ...v, linha: d.linha }))) ?? [];
  const temViolacao = violacoesProtegidas.length > 0;

  const usarFiltroServidor = Boolean(allHref && filledHref);

  const filtroAtual = usarFiltroServidor
    ? serverFillFilter ?? "todas"
    : filtroPreenchimento;

  const linhasExibidas =
    usarFiltroServidor
      ? linhas
      : filtroAtual === "preenchidas"
        ? linhas.filter((linha) => linha.fillStatus !== "pending")
        : linhas;

  const textoQuantidade =
    usarFiltroServidor && typeof totalRows === "number"
      ? filtroAtual === "preenchidas"
        ? `${totalRows.toLocaleString("pt-BR")} registros preenchidos.`
        : `${linhas.length.toLocaleString("pt-BR")} registros nesta página de ${totalRows.toLocaleString("pt-BR")} no total.`
      : TAB_INFO[activeTab].hint(linhas.length);

  return (
    <>
      {/* ---- Input de bases (accordion, 2 dropzones) ---- */}
      {/* Só existe quando há pelo menos um dos dois uploads liberados. */}
      {mostrarAccordion ? (
        <div className={`upload-accordion ${accordionOpen ? "open" : ""}`} id="uploadAccordion">
        <button className="upload-toggle" type="button" onClick={() => setAccordionOpen((v) => !v)}>
          <div className="upload-toggle-main">
            <div className="upload-toggle-icon">↥</div>
            <div>
              <div className="upload-toggle-title">Input de bases</div>
              <div className="upload-toggle-sub">Abra somente quando precisar devolver uma base.</div>
            </div>
          </div>
          <div className="upload-chevron">⌄</div>
        </button>

        <div className="upload-content">
          <div className="upload-grid">
            <div className={`upload-mini ${permiteBaseOriginal ? "" : "locked"}`} id="originalUploadCard">
              <div className="upload-mini-head">
                <div>
                  <div className="upload-mini-role">Time de Transportes</div>
                  <div className="upload-mini-title">Base original</div>
                </div>
              </div>
              {permiteBaseOriginal ? (
                <form action={onSubmitOriginal}>
                  <label className="dropzone compact" htmlFor="fileOriginal">
                    <div className="drop-icon">⬆</div>
                    <strong>{origPending ? "Enviando..." : arquivoOriginalNome || "Selecionar base original"}</strong>
                    <span>{arquivoOriginalNome ? "Arquivo selecionado" : "Mesmas colunas de origem da Base Completa"}</span>
                  </label>
                  <input
                    type="file"
                    id="fileOriginal"
                    name="arquivo"
                    accept=".xlsx"
                    required
                    disabled={origPending}
                    onChange={(event) => setArquivoOriginalNome(event.target.files?.[0]?.name ?? "")}
                  />
                  <div className="mini-actions">
                    <button className="btn-secondary" type="submit" disabled={origPending}>
                      {origPending ? "Enviando..." : "Enviar base original"}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <label className="dropzone compact" aria-disabled>
                    <div className="drop-icon">⬆</div>
                    <strong>Selecionar base original</strong>
                    <span>Excel, CSV ou JSON</span>
                  </label>
                  <div className="access-note">
                    <div className="access-lock">🔒</div>
                    <div>Publicação exclusiva do Time de Transportes autorizado. A base original chega automaticamente pela integração.</div>
                  </div>
                </>
              )}
            </div>

            <div className={`upload-mini ${permiteDevolucao ? "" : "locked"}`} id="updatedUploadCard">
              <div className="upload-mini-head">
                <div>
                  <div className="upload-mini-role">Transportador</div>
                  <div className="upload-mini-title">Base atualizada</div>
                </div>
              </div>
              {permiteDevolucao ? (
                <form action={onSubmit}>
                  {transportadorasParaSelecao ? (
                    <div className="field" style={{ marginBottom: 8 }}>
                      <label htmlFor="transportadoraIdDevolucao">Transportadora</label>
                      <select id="transportadoraIdDevolucao" name="transportadoraId" required defaultValue="">
                        <option value="" disabled>
                          Selecione...
                        </option>
                        {transportadorasParaSelecao.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <label className="dropzone compact" htmlFor="fileUpdated">
                    <div className="drop-icon">↻</div>
                    <strong>
                      {processandoUpload
                        ? `${arquivoAtualNome || "Base selecionada"} · ${progressoUpload || 0}%`
                        : arquivoAtualNome || "Subir base atualizada"}
                    </strong>
                    <span>{arquivoAtualNome ? "Arquivo selecionado" : "Mantenha a mesma estrutura de colunas"}</span>
                  </label>
                  <input
                    type="file"
                    id="fileUpdated"
                    name="arquivo"
                    accept=".xlsx"
                    required
                    disabled={processandoUpload}
                    onChange={(event) => {
                      setArquivoAtualNome(event.target.files?.[0]?.name ?? "");
                      setProgressoUpload(0);
                      setErro(null);
                      setResumo(null);
                    }}
                  />
                  <div className="mini-actions">
                    <button className="btn-secondary" type="submit" disabled={processandoUpload}>
                      {processandoUpload ? "Processando..." : devolucaoRecebidaHoje ? "Reenviar devolução" : "Enviar devolução"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="access-note">
                  <div className="access-lock">🔒</div>
                  <div>Devolução indisponível neste contexto.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {processandoUpload ? (
        <div className="compact-alert open" role="status" aria-live="polite">
          <div style={{ padding: "12px 16px", width: "100%" }}>
            <div className="compact-alert-title" style={{ marginBottom: 8 }}>
              ↻ Processando: {arquivoAtualNome || "arquivo selecionado"}
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              {linhasUploadTotal > 0 ? (
                <>
                  {linhasUploadProcessadas.toLocaleString("pt-BR")} de {linhasUploadTotal.toLocaleString("pt-BR")} linhas concluídas · faltam {Math.max(0, linhasUploadTotal - linhasUploadProcessadas).toLocaleString("pt-BR")} · {progressoUpload}%
                </>
              ) : (
                <>Lendo e preparando o arquivo...</>
              )}
            </div>
            <div style={{ height: 8, borderRadius: 999, overflow: "hidden", background: "#dbe5f1" }}>
              <div
                style={{
                  width: `${progressoUpload}%`,
                  height: "100%",
                  background: "#2563eb",
                  transition: "width 250ms ease",
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {erro ? (
        <div className="compact-alert open">
          <button type="button" className="compact-alert-toggle" disabled>
            <span className="compact-alert-title">🚨 Falha ao processar: {erro}</span>
          </button>
        </div>
      ) : null}

      {!processandoUpload && !erro && resumo && arquivoAtualNome ? (
        <div className="compact-alert open ok">
          <button type="button" className="compact-alert-toggle" disabled>
            <span className="compact-alert-title">
              ✓ Finalizado: {resumo.arquivoNome || arquivoAtualNome} · {resumo.totalLinhas.toLocaleString("pt-BR")} linha(s) lida(s) · {resumo.aplicados.toLocaleString("pt-BR")} atualizada(s) · {resumo.semAlteracao.toLocaleString("pt-BR")} sem alteração · {(resumo.erros + resumo.pedidosNaoEncontrados + resumo.pedidosDeOutraTransportadora).toLocaleString("pt-BR")} com pendência
            </span>
          </button>
        </div>
      ) : null}

      {origErro ? (
        <div className="compact-alert open">
          <button type="button" className="compact-alert-toggle" disabled>
            <span className="compact-alert-title">🚨 Falha ao processar base original: {origErro}</span>
          </button>
        </div>
      ) : null}

      {origResumo ? (
        <div className={`compact-alert open ${origResumo.erros.length ? "" : "ok"}`}>
          <button type="button" className="compact-alert-toggle" disabled>
            <span className="compact-alert-title">
              {origResumo.erros.length ? "🚨" : "✓"} Base original: {origResumo.totalLinhas} linha(s), {origResumo.inseridos}{" "}
              inserida(s), {origResumo.atualizados} atualizada(s), {origResumo.erros.length} erro(s).
            </span>
          </button>
          {origResumo.erros.length ? (
            <div className="tamper-list">
              {origResumo.erros.map((e, i) => (
                <div key={i} className="tamper-item">
                  <strong>
                    Linha {e.linha} · {e.pedido || "(sem pedido)"}
                  </strong>
                  <br />
                  {e.motivo}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ---- Painel de visualização ---- */}
      <div className="card panel">
        <div className="tabs">
          <button className={`tab ${activeTab === "original" ? "active" : ""}`} type="button" onClick={() => setActiveTab("original")}>
            {permiteDevolucao ? "Visão original" : "Base"}
          </button>
          {permiteDevolucao ? (
            <>
              <button className={`tab ${activeTab === "updated" ? "active" : ""}`} type="button" onClick={() => setActiveTab("updated")}>
                Visão atualizada
              </button>
              <button className={`tab ${activeTab === "compare" ? "active" : ""}`} type="button" onClick={() => setActiveTab("compare")}>
                Comparativo
              </button>
            </>
          ) : null}
        </div>

        <div className="backend-ready-bar" id="backendReadyBar">
          <div className="backend-ready-left">
            <span className="backend-ready-title">Base operacional</span>
            <span className="backend-pill">
              <span className="backend-dot" style={{ background: hasBaseUpdate ? "#16a34a" : "#94a3b8" }} />
              Última atualização: <strong>{lastBaseUpdateLabel}</strong>
            </span>
            <span className="backend-pill">
              <span
                className="backend-dot"
                style={{ background: devolucaoRecebidaHoje ? "#16a34a" : "#94a3b8" }}
              />
              {devolucaoRecebidaHoje ? "Devolução recebida hoje:" : "Última devolução:"}{" "}
              <strong>{ultimaDevolucaoLabelAtual}</strong>
            </span>
          </div>
          <div className="backend-ready-right">
            <span className="backend-pill">
              <span className="backend-dot pending" />
              Pendentes: <strong>{fillPending}</strong>
            </span>
            <span className="backend-pill">
              <span className="backend-dot partial" />
              Parciais: <strong>{fillPartial}</strong>
            </span>
            <span className="backend-pill">
              <span className="backend-dot done" />
              Respondidos: <strong>{fillDone}</strong>
            </span>
          </div>
        </div>

        {processandoUpload ? (
          <div className="backend-loading show">
            Processando {arquivoAtualNome || "devolução"}{progressoUpload ? ` · ${progressoUpload}%` : "..."}
          </div>
        ) : null}

        <div className="panel-download">
          <a href={downloadHref} className="btn-transporter">
            <Download size={13} /> {downloadLabel}
          </a>
        </div>

        <div className="backend-note">{backendNote}</div>

        <div className="toolbar">
          <div className="toolbar-left">
            <strong>{TAB_INFO[activeTab].title}</strong>
            <div>{activeTab === "compare" ? TAB_INFO[activeTab].hint(linhas.length) : textoQuantidade}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {activeTab !== "compare" && !toolbarDateFilter ? (
                <select
                  value={filtroAtual}
                onChange={(e) => {
                  const valor = e.target.value as "todas" | "preenchidas";

                  if (usarFiltroServidor) {
                    const destino =
                      valor === "preenchidas" ? filledHref : allHref;

                    if (destino) {
                      window.location.href = destino;
                    }

                    return;
                  }

                  setFiltroPreenchimento(valor);
                }}
                aria-label="Filtrar preenchimento da base"
                style={{
                  height: 40,
                  padding: "0 12px",
                  border: "1px solid #d8dee8",
                  borderRadius: 8,
                  background: "#fff",
                  color: "#0f2742",
                  fontWeight: 600,
                }}
              >
                <option value="todas">Todas</option>
                <option value="preenchidas">Somente preenchidas</option>
              </select>
            ) : null}
              {toolbarDateFilter}


            <input
              className="search"
              placeholder="Pesquisar em qualquer coluna..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        {activeTab !== "compare" ? (
          <>
          <PedidosTable
            linhas={linhasExibidas}
            busca={busca}
            mostrarProtegidas={mostrarProtegidas}
            onToggleProtegidas={() => setMostrarProtegidas((v) => !v)}
          />

          {usarFiltroServidor && filtroAtual === "todas" && totalPages > 1 ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 12,
                paddingTop: 14,
              }}
            >
              {previousHref ? (
                <a className="btn-secondary" href={previousHref}>
                  ← Anterior
                </a>
              ) : (
                <span
                  className="btn-secondary"
                  style={{ opacity: 0.45, pointerEvents: "none" }}
                >
                  ← Anterior
                </span>
              )}

              <strong style={{ fontSize: 12 }}>
                Página {page.toLocaleString("pt-BR")} de {totalPages.toLocaleString("pt-BR")}
              </strong>

              {nextHref ? (
                <a className="btn-secondary" href={nextHref}>
                  Próxima →
                </a>
              ) : (
                <span
                  className="btn-secondary"
                  style={{ opacity: 0.45, pointerEvents: "none" }}
                >
                  Próxima →
                </span>
              )}
            </div>
          ) : null}
          </>
        ) : (
          <div>
            {!resumo ? (
              <div className="empty">Envie uma devolução para gerar o comparativo antes × depois.</div>
            ) : (
              <>
                <div className={`compact-alert integrity-compact ${alertOpen ? "open" : ""} ${temViolacao ? "" : "ok"}`} id="integrityAlert">
                  <button type="button" className="compact-alert-toggle" onClick={() => setAlertOpen((v) => !v)}>
                    <span className="compact-alert-title">
                      {temViolacao ? "🚨 Divergência crítica detectada na devolução" : "✓ Integridade dos campos protegidos preservada"}
                    </span>
                    <span className="compact-alert-action" />
                  </button>
                  {temViolacao ? (
                    <div className="compact-alert-body">
                      <div>A transportadora alterou informações que deveriam permanecer idênticas à base original. Revise antes de aceitar a devolução.</div>
                      <div className="tamper-list">
                        {violacoesProtegidas.map((v, i) => (
                          <div key={i} className="tamper-item">
                            <strong>
                              Linha {v.linha} · {v.campo}
                            </strong>
                            <br />
                            Original: "{String(v.antes)}" → Devolvido: "{String(v.depois)}" (não aplicado)
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="split">
                  <div className="split-box">
                    <div className="split-title">Campos operacionais aplicados (antes → depois)</div>
                    <div style={{ padding: 10 }}>
                      {alteracoesAplicadas.length === 0 ? (
                        <div className="empty">Nenhum campo novo aplicado nesta devolução.</div>
                      ) : (
                        <div className="tamper-list">
                          {alteracoesAplicadas.map((v, i) => (
                            <div key={i} className="tamper-item" style={{ borderColor: "#b6dfc5", background: "#f7fcf8" }}>
                              <strong>
                                Linha {v.linha} · {v.campo}
                              </strong>
                              <br />
                              "{String(v.antes) || "(vazio)"}" → "{String(v.depois)}"
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="split-box">
                    <div className="split-title">Campos já respondidos preservados (tentativa bloqueada)</div>
                    <div style={{ padding: 10 }}>
                      {tentativasBloqueadas.length === 0 ? (
                        <div className="empty">Nenhuma tentativa bloqueada nesta devolução.</div>
                      ) : (
                        <div className="tamper-list">
                          {tentativasBloqueadas.map((v, i) => (
                            <div key={i} className="tamper-item">
                              <strong>
                                Linha {v.linha} · {v.campo}
                              </strong>
                              <br />
                              Mantido: "{String(v.antes)}" (tentativa: "{String(v.depois)}")
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
