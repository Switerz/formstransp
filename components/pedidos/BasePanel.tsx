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
  adminDownloadControl?: React.ReactNode;
  downloadHref?: string;
  /**
   * Opcional. Quando ausente (transportadora comum), o lado "Base
   * atualizada" fica indisponÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel junto com o resto do fluxo de
   * devoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o. Quando presente (Base Completa/acesso interno), a
   * devoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© enviada em nome da transportadora escolhida em
   * transportadorasParaSelecao (obrigatÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rio nesse caso) - a Server
   * Action valida isso no servidor (requireInternalAdmin), nunca confia
   * sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ no frontend.
   */
  uploadAction?: (formData: FormData) => Promise<DevolucaoResumo>;
  /**
   * Opcional. Quando ausente (transportadora comum), o lado "Base
   * original" continua bloqueado/decorativo, exatamente como sempre foi
   * (a base de origem ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© 100% automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡tica via Intelipost). Quando presente
   * (Base Completa/acesso interno), libera o upload manual de origem -
   * protegido no servidor por requireInternalAdmin dentro da prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³pria
   * action, nunca sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ escondendo/mostrando botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.
   */
  uploadOriginalAction?: (formData: FormData) => Promise<BaseOriginalResumo>;
  /** Lista de transportadoras para o seletor da devoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o em modo interno. Sem isso, o upload de devoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o sabe a quem atribuir a base. */
  transportadorasParaSelecao?: TransportadoraOption[];
  downloadLabel?: string;
  backendNote?: string;
}

const TAB_INFO: Record<Tab, { title: string; hint: (n: number) => string }> = {
  original: { title: "VisualizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o da base original", hint: (n) => (n ? `${n.toLocaleString("pt-BR")} registros carregados.` : "Nenhuma base carregada.") },
  updated: { title: "VisualizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o da base atualizada", hint: (n) => (n ? `${n.toLocaleString("pt-BR")} registros carregados.` : "Nenhuma base atualizada carregada.") },
  compare: { title: "Comparativo antes x depois", hint: () => "AlteraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes da ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºltima devoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o recebida." },
};

export function BasePanel({
  linhas,
  lastBaseUpdateLabel,
  hasBaseUpdate,
  initialResumo = null,
  lastDevolucaoLabel = "Nenhuma devoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o recebida",
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
  adminDownloadControl,
  downloadHref,
  uploadAction,
  uploadOriginalAction,
  transportadorasParaSelecao,
  downloadLabel = "Baixar minha base",
  backendNote = "VocÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âª estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ autenticado como transportadora - os downloads e a devoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o acima sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ afetam os pedidos vinculados ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  sua sessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.",
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

  async function onSubmit(formData: FormData) {
    setErro(null);
    setResumo(null);
    setProgressoUpload(0);
    setLinhasUploadTotal(0);
    setLinhasUploadProcessadas(0);
    setProcessandoUpload(true);

    try {
      const arquivo = formData.get("arquivo");

      if (!(arquivo instanceof File) || arquivo.size === 0) {
        throw new Error(
          "Selecione um arquivo .xlsx preenchido antes de enviar.",
        );
      }

      if (!arquivo.name.toLowerCase().endsWith(".xlsx")) {
        throw new Error("O arquivo precisa estar no formato .xlsx.");
      }

      const inicioResposta = await fetch(
        "/portal/minha-base/upload/iniciar",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nomeArquivo: arquivo.name,
            tamanhoBytes: arquivo.size,
          }),
        },
      );

      const inicioDados = (await inicioResposta.json()) as {
        uploadUrl?: string;
        contentType?: string;
        erro?: string;
      };

      if (!inicioResposta.ok || !inicioDados.uploadUrl) {
        throw new Error(
          inicioDados.erro ?? "NÃƒÆ’Ã‚Â£o foi possÃƒÆ’Ã‚Â­vel iniciar o envio.",
        );
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open("PUT", inicioDados.uploadUrl!, true);

        xhr.setRequestHeader(
          "Content-Type",
          inicioDados.contentType ??
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;

          const percentual = Math.round(
            (event.loaded / event.total) * 100,
          );

          setProgressoUpload(percentual);
        };

        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const respostaDrive = JSON.parse(xhr.responseText) as {
                id?: string;
              };

              if (!respostaDrive.id) {
                reject(
                  new Error(
                    "O Google Drive recebeu o arquivo, mas nÃƒÂ£o retornou sua identificaÃƒÂ§ÃƒÂ£o.",
                  ),
                );
                return;
              }

              const confirmacao = await fetch(
                "/portal/minha-base/upload/confirmar",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    fileId: respostaDrive.id,
                  }),
                },
              );

              const dadosConfirmacao = (await confirmacao.json()) as {
                ok?: boolean;
                erro?: string;
              };

              if (!confirmacao.ok || !dadosConfirmacao.ok) {
                reject(
                  new Error(
                    dadosConfirmacao.erro ??
                      "O arquivo foi enviado, mas nÃƒÂ£o foi possÃƒÂ­vel confirmar o recebimento.",
                  ),
                );
                return;
              }

              setProgressoUpload(100);
              resolve();
            } catch (error) {
              reject(
                error instanceof Error
                  ? error
                  : new Error(
                      "NÃƒÂ£o foi possÃƒÂ­vel confirmar o arquivo enviado.",
                    ),
              );
            }

            return;
          }

          reject(
            new Error(
              `O Google Drive recusou o arquivo (${xhr.status}).`,
            ),
          );
        };

        xhr.onerror = () => {
          reject(
            new Error(
              "A conexÃƒÆ’Ã‚Â£o com o Google Drive foi interrompida durante o envio.",
            ),
          );
        };

        xhr.send(arquivo);
      });

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
      setErro(
        err instanceof Error
          ? err.message
          : "NÃƒÆ’Ã‚Â£o foi possÃƒÆ’Ã‚Â­vel enviar a devoluÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o.",
      );
    } finally {
      setProcessandoUpload(false);
    }
  }
  function onSubmitOriginal(formData: FormData) {
    if (!uploadOriginalAction) return;
    setOrigErro(null);
    startOrigTransition(async () => {
      try {
        const result = await uploadOriginalAction(formData);
        setOrigResumo(result);
      } catch (err) {
        setOrigErro(err instanceof Error ? err.message : "NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel processar a base original.");
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
        : `${linhas.length.toLocaleString("pt-BR")} registros nesta pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina de ${totalRows.toLocaleString("pt-BR")} no total.`
      : TAB_INFO[activeTab].hint(linhas.length);

  return (
    <>
      {/* ---- Input de bases (accordion, 2 dropzones) ---- */}
      {/* SÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³ existe quando hÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ pelo menos um dos dois uploads liberados. */}
      {mostrarAccordion ? (
        <div className={`upload-accordion ${accordionOpen ? "open" : ""}`} id="uploadAccordion">
        <button className="upload-toggle" type="button" onClick={() => setAccordionOpen((v) => !v)}>
          <div className="upload-toggle-main">
            <div className="upload-toggle-icon">ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Ãƒâ€šÃ‚Â¥</div>
            <div>
              <div className="upload-toggle-title">Input de bases</div>
              <div className="upload-toggle-sub">Abra somente quando precisar devolver uma base.</div>
            </div>
          </div>
          <div className="upload-chevron">ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬â„¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾</div>
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
                    <div className="drop-icon">ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â </div>
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
                    <div className="drop-icon">ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â </div>
                    <strong>Selecionar base original</strong>
                    <span>Excel, CSV ou JSON</span>
                  </label>
                  <div className="access-note">
                    <div className="access-lock">ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢</div>
                    <div>PublicaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o exclusiva do Time de Transportes autorizado. A base original chega automaticamente pela integraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.</div>
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
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void onSubmit(new FormData(event.currentTarget));
                  }}
                >
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
                    <div className="drop-icon">ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Ãƒâ€šÃ‚Â»</div>
                    <strong>
                      {processandoUpload
                        ? `${arquivoAtualNome || "Base selecionada"} ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ${progressoUpload || 0}%`
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
                      {processandoUpload ? "Processando..." : devolucaoRecebidaHoje ? "Reenviar devoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o" : "Enviar devoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="access-note">
                  <div className="access-lock">ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢</div>
                  <div>DevoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o indisponÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel neste contexto.</div>
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
              ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Ãƒâ€šÃ‚Â» Processando: {arquivoAtualNome || "arquivo selecionado"}
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              {linhasUploadTotal > 0 ? (
                <>
                  {linhasUploadProcessadas.toLocaleString("pt-BR")} de {linhasUploadTotal.toLocaleString("pt-BR")} linhas concluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­das ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· faltam {Math.max(0, linhasUploadTotal - linhasUploadProcessadas).toLocaleString("pt-BR")} ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· {progressoUpload}%
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
            <span className="compact-alert-title">ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â¨ Falha ao processar: {erro}</span>
          </button>
        </div>
      ) : null}

      {!processandoUpload && !erro && resumo && arquivoAtualNome ? (
        <div className="compact-alert open ok">
          <button type="button" className="compact-alert-toggle" disabled>
            <span className="compact-alert-title">
              ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ Finalizado: {resumo.arquivoNome || arquivoAtualNome} ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· {resumo.totalLinhas.toLocaleString("pt-BR")} linha(s) lida(s) ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· {resumo.aplicados.toLocaleString("pt-BR")} atualizada(s) ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· {resumo.semAlteracao.toLocaleString("pt-BR")} sem alteraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· {(resumo.erros + resumo.pedidosNaoEncontrados + resumo.pedidosDeOutraTransportadora).toLocaleString("pt-BR")} com pendÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia
            </span>
          </button>
        </div>
      ) : null}

      {origErro ? (
        <div className="compact-alert open">
          <button type="button" className="compact-alert-toggle" disabled>
            <span className="compact-alert-title">ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â¨ Falha ao processar base original: {origErro}</span>
          </button>
        </div>
      ) : null}

      {origResumo ? (
        <div className={`compact-alert open ${origResumo.erros.length ? "" : "ok"}`}>
          <button type="button" className="compact-alert-toggle" disabled>
            <span className="compact-alert-title">
              {origResumo.erros.length ? "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â¨" : "ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ"} Base original: {origResumo.totalLinhas} linha(s), {origResumo.inseridos}{" "}
              inserida(s), {origResumo.atualizados} atualizada(s), {origResumo.erros.length} erro(s).
            </span>
          </button>
          {origResumo.erros.length ? (
            <div className="tamper-list">
              {origResumo.erros.map((e, i) => (
                <div key={i} className="tamper-item">
                  <strong>
                    Linha {e.linha} ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· {e.pedido || "(sem pedido)"}
                  </strong>
                  <br />
                  {e.motivo}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ---- Painel de visualizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o ---- */}
      <div className="card panel">
        <div className="tabs">
          <button className={`tab ${activeTab === "original" ? "active" : ""}`} type="button" onClick={() => setActiveTab("original")}>
            {permiteDevolucao ? "VisÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o original" : "Base"}
          </button>
          {permiteDevolucao ? (
            <>
              <button className={`tab ${activeTab === "updated" ? "active" : ""}`} type="button" onClick={() => setActiveTab("updated")}>
                VisÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o atualizada
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
              ÃƒÆ’Ã†â€™Ãƒâ€¦Ã‚Â¡ltima atualizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o: <strong>{lastBaseUpdateLabel}</strong>
            </span>
            <span className="backend-pill">
              <span
                className="backend-dot"
                style={{ background: devolucaoRecebidaHoje ? "#16a34a" : "#94a3b8" }}
              />
              {devolucaoRecebidaHoje ? "DevoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o recebida hoje:" : "ÃƒÆ’Ã†â€™Ãƒâ€¦Ã‚Â¡ltima devoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o:"}{" "}
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
            Processando {arquivoAtualNome || "devoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o"}{progressoUpload ? ` ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ${progressoUpload}%` : "..."}
          </div>
        ) : null}

        {downloadHref && (
          <div className="panel-download">
            <a href={downloadHref} className="btn-transporter">
              <Download size={13} /> {downloadLabel}
            </a>
          </div>
        )}

        <div className="backend-note">{backendNote}</div>

        <div className="toolbar">
          <div className="toolbar-left">
            <strong>{TAB_INFO[activeTab].title}</strong>
            <div>{activeTab === "compare" ? TAB_INFO[activeTab].hint(linhas.length) : textoQuantidade}</div>
            {adminDownloadControl ? <div style={{ marginTop: 12 }}>{adminDownloadControl}</div> : null}
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
                  ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Ãƒâ€šÃ‚Â Anterior
                </a>
              ) : (
                <span
                  className="btn-secondary"
                  style={{ opacity: 0.45, pointerEvents: "none" }}
                >
                  ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Ãƒâ€šÃ‚Â Anterior
                </span>
              )}

              <strong style={{ fontSize: 12 }}>
                PÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡gina {page.toLocaleString("pt-BR")} de {totalPages.toLocaleString("pt-BR")}
              </strong>

              {nextHref ? (
                <a className="btn-secondary" href={nextHref}>
                  PrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³xima ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢
                </a>
              ) : (
                <span
                  className="btn-secondary"
                  style={{ opacity: 0.45, pointerEvents: "none" }}
                >
                  PrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³xima ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢
                </span>
              )}
            </div>
          ) : null}
          </>
        ) : (
          <div>
            {!resumo ? (
              <div className="empty">Envie uma devoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o para gerar o comparativo antes ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â depois.</div>
            ) : (
              <>
                <div className={`compact-alert integrity-compact ${alertOpen ? "open" : ""} ${temViolacao ? "" : "ok"}`} id="integrityAlert">
                  <button type="button" className="compact-alert-toggle" onClick={() => setAlertOpen((v) => !v)}>
                    <span className="compact-alert-title">
                      {temViolacao ? "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â¨ DivergÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tica detectada na devoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o" : "ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ Integridade dos campos protegidos preservada"}
                    </span>
                    <span className="compact-alert-action" />
                  </button>
                  {temViolacao ? (
                    <div className="compact-alert-body">
                      <div>A transportadora alterou informaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes que deveriam permanecer idÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªnticas ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  base original. Revise antes de aceitar a devoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.</div>
                      <div className="tamper-list">
                        {violacoesProtegidas.map((v, i) => (
                          <div key={i} className="tamper-item">
                            <strong>
                              Linha {v.linha} ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· {v.campo}
                            </strong>
                            <br />
                            Original: "{String(v.antes)}" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Devolvido: "{String(v.depois)}" (nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o aplicado)
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="split">
                  <div className="split-box">
                    <div className="split-title">Campos operacionais aplicados (antes ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ depois)</div>
                    <div style={{ padding: 10 }}>
                      {alteracoesAplicadas.length === 0 ? (
                        <div className="empty">Nenhum campo novo aplicado nesta devoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.</div>
                      ) : (
                        <div className="tamper-list">
                          {alteracoesAplicadas.map((v, i) => (
                            <div key={i} className="tamper-item" style={{ borderColor: "#b6dfc5", background: "#f7fcf8" }}>
                              <strong>
                                Linha {v.linha} ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· {v.campo}
                              </strong>
                              <br />
                              "{String(v.antes) || "(vazio)"}" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ "{String(v.depois)}"
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="split-box">
                    <div className="split-title">Campos jÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ respondidos preservados (tentativa bloqueada)</div>
                    <div style={{ padding: 10 }}>
                      {tentativasBloqueadas.length === 0 ? (
                        <div className="empty">Nenhuma tentativa bloqueada nesta devoluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.</div>
                      ) : (
                        <div className="tamper-list">
                          {tentativasBloqueadas.map((v, i) => (
                            <div key={i} className="tamper-item">
                              <strong>
                                Linha {v.linha} ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· {v.campo}
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
