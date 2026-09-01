"use client";

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
  fillPending: number;
  fillPartial: number;
  fillDone: number;
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
  fillPending,
  fillPartial,
  fillDone,
  downloadHref,
  uploadAction,
  uploadOriginalAction,
  transportadorasParaSelecao,
  downloadLabel = "Baixar minha base",
  backendNote = "Você está autenticado como transportadora - os downloads e a devolução acima só afetam os pedidos vinculados à sua sessão.",
}: BasePanelProps) {
  const permiteDevolucao = Boolean(uploadAction);
  const permiteBaseOriginal = Boolean(uploadOriginalAction);
  const mostrarAccordion = permiteDevolucao || permiteBaseOriginal;
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("original");
  const [busca, setBusca] = useState("");
  const [mostrarProtegidas, setMostrarProtegidas] = useState(false);
  const [resumo, setResumo] = useState<DevolucaoResumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [alertOpen, setAlertOpen] = useState(false);

  const [origResumo, setOrigResumo] = useState<BaseOriginalResumo | null>(null);
  const [origErro, setOrigErro] = useState<string | null>(null);
  const [origPending, startOrigTransition] = useTransition();

  function onSubmit(formData: FormData) {
    if (!uploadAction) return;
    setErro(null);
    startTransition(async () => {
      try {
        const result = await uploadAction(formData);
        setResumo(result);
        setAccordionOpen(false);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Não foi possível processar a devolução.");
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
                    <strong>{origPending ? "Enviando..." : "Selecionar base original"}</strong>
                    <span>Mesmas colunas de origem da Base Completa</span>
                  </label>
                  <input type="file" id="fileOriginal" name="arquivo" accept=".xlsx" required disabled={origPending} />
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
                    <strong>{pending ? "Enviando..." : "Subir base atualizada"}</strong>
                    <span>Mantenha a mesma estrutura de colunas</span>
                  </label>
                  <input type="file" id="fileUpdated" name="arquivo" accept=".xlsx" required disabled={pending} />
                  <div className="mini-actions">
                    <button className="btn-secondary" type="submit" disabled={pending}>
                      {pending ? "Enviando..." : "Enviar devolução"}
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

      {erro ? (
        <div className="compact-alert open">
          <button type="button" className="compact-alert-toggle" disabled>
            <span className="compact-alert-title">🚨 Falha ao processar: {erro}</span>
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

        {pending ? <div className="backend-loading show">Processando devolução...</div> : null}

        <div className="panel-download">
          <a href={downloadHref} className="btn-transporter">
            <Download size={13} /> {downloadLabel}
          </a>
        </div>

        <div className="backend-note">{backendNote}</div>

        <div className="toolbar">
          <div className="toolbar-left">
            <strong>{TAB_INFO[activeTab].title}</strong>
            <div>{TAB_INFO[activeTab].hint(linhas.length)}</div>
          </div>
          <input className="search" placeholder="Pesquisar em qualquer coluna..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>

        {activeTab !== "compare" ? (
          <PedidosTable
            linhas={linhas}
            busca={busca}
            mostrarProtegidas={mostrarProtegidas}
            onToggleProtegidas={() => setMostrarProtegidas((v) => !v)}
          />
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
