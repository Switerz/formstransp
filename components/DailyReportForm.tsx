import Link from "next/link";
import { Download } from "lucide-react";
import type {
  DailyCurrentDayPreviewMetrics,
  DailyPreviousDayMetrics,
  DailyReportSubmission,
  PreviousDayUFMetric,
  Transportadora,
} from "@prisma/client";
import { FormConsistencyAlerts } from "@/components/FormConsistencyAlerts";
import { formatDateInput } from "@/lib/dates";
import { BRAZILIAN_UFS } from "@/lib/ufs";

export type DailyReportFormLastSubmission = DailyReportSubmission & {
  previousDayMetrics: DailyPreviousDayMetrics | null;
  currentDayPreviewMetrics: DailyCurrentDayPreviewMetrics | null;
  ufMetrics: PreviousDayUFMetric[];
};

type DailyReportFormProps = {
  transportadora: Pick<Transportadora, "nome">;
  action: (formData: FormData) => void | Promise<void>;
  uploadAction?: (formData: FormData) => void | Promise<void>;
  error?: string;
  last?: DailyReportFormLastSubmission;
  defaultResponsibleName?: string;
  defaultResponsibleEmail?: string;
  backHref?: string;
  successPath?: string;
  draftPath?: string;
  errorPath?: string;
  draftValues?: Record<string, string>;
  errorSections?: string[];
};

function numberField(name: string, label: string, value: number | string = 0) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type="number" min="0" defaultValue={value} required />
    </div>
  );
}

function formatDateTime(value?: Date | null) {
  if (!value) return "Horário não informado";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}

export function DailyReportForm({
  transportadora,
  action,
  uploadAction,
  error,
  last,
  defaultResponsibleName = "",
  defaultResponsibleEmail = "",
  backHref,
  successPath,
  draftPath,
  errorPath,
  draftValues,
  errorSections = [],
}: DailyReportFormProps) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const prev = last?.previousDayMetrics;
  const cur = last?.currentDayPreviewMetrics;
  const todayInput = formatDateInput(today);
  const lockedToday =
    last?.dataReport.toISOString().slice(0, 10) === todayInput && ["submitted", "validated", "sent"].includes(last.status);

  function pick(name: string, fallback: number | string) {
    if (draftValues && Object.prototype.hasOwnProperty.call(draftValues, name)) {
      return draftValues[name];
    }
    return fallback;
  }

  const hasPreviousError = errorSections.includes("previous");
  const hasCurrentError = errorSections.includes("current");
  const hasUfError = errorSections.includes("uf");

  const previousFields = [
    ["prev_totalPedidos", "Total de pedidos", pick("prev_totalPedidos", prev?.totalPedidos ?? 0)],
    ["prev_totalNoPrazo", "No prazo", pick("prev_totalNoPrazo", prev?.totalNoPrazo ?? 0)],
    ["prev_totalForaDoPrazo", "Fora do prazo", pick("prev_totalForaDoPrazo", prev?.totalForaDoPrazo ?? 0)],
    ["prev_totalEntregue", "Entregue", pick("prev_totalEntregue", prev?.totalEntregue ?? 0)],
    ["prev_totalEmAberto", "Em aberto", pick("prev_totalEmAberto", prev?.totalEmAberto ?? 0)],
    ["prev_totalTentativaInsucesso", "Tentativa sem sucesso", pick("prev_totalTentativaInsucesso", prev?.totalTentativaInsucesso ?? 0)],
    ["prev_totalDevolucao", "Devolução", pick("prev_totalDevolucao", prev?.totalDevolucao ?? 0)],
    ["prev_totalCancelado", "Cancelado", pick("prev_totalCancelado", prev?.totalCancelado ?? 0)],
  ] as const;
  const currentFields = [
    ["cur_totalPedidos", "Total de pedidos", pick("cur_totalPedidos", cur?.totalPedidos ?? 0)],
    ["cur_totalFinalizado", "Finalizado", pick("cur_totalFinalizado", cur?.totalFinalizado ?? 0)],
    ["cur_totalEmAberto", "Em aberto", pick("cur_totalEmAberto", cur?.totalEmAberto ?? 0)],
    ["cur_totalEntregue", "Entregue", pick("cur_totalEntregue", cur?.totalEntregue ?? 0)],
    ["cur_totalTentativaInsucesso", "Tentativa sem sucesso", pick("cur_totalTentativaInsucesso", cur?.totalTentativaInsucesso ?? 0)],
    ["cur_totalDevolucao", "Devolução", pick("cur_totalDevolucao", cur?.totalDevolucao ?? 0)],
    ["cur_totalCancelado", "Cancelado", pick("cur_totalCancelado", cur?.totalCancelado ?? 0)],
    ["cur_finalizadosNoPrazo", "Finalizados no prazo", pick("cur_finalizadosNoPrazo", cur?.finalizadosNoPrazo ?? 0)],
    ["cur_finalizadosForaDoPrazo", "Finalizados fora do prazo", pick("cur_finalizadosForaDoPrazo", cur?.finalizadosForaDoPrazo ?? 0)],
  ] as const;
  const lockedUfWithVolume =
    last?.ufMetrics.filter((item) => item.dentroDoPrazo + item.foraDoPrazo > 0).length ?? 0;
  const lockedSubmitter = last?.submittedByName || last?.submittedByEmail || "Responsável não informado";

  return (
    <>
      <div className="page-title form-page-title">
        <div>
          <h1>Formulário diário</h1>
          <p className="muted">{transportadora.nome}</p>
        </div>
        <div className="actions">
          {backHref ? (
            <Link className="btn secondary" href={backHref}>
              Voltar
            </Link>
          ) : null}
          {!lockedToday ? (
            <Link className="btn secondary" href="/portal/formulario/modelo">
              <Download size={16} /> Baixar modelo (.xlsx)
            </Link>
          ) : null}
          <span className="pill">Envio esperado até 11h</span>
        </div>
      </div>

      {error ? (
        <div className="alert" style={{ marginBottom: 16 }}>
          <strong>Não foi possível salvar:</strong> {error}
        </div>
      ) : null}

      {lockedToday ? (
        <section className="card locked-report-card">
          <div className="locked-report-heading">
            <div>
              <h2 className="section-title">Relatório recebido</h2>
              <p className="muted">
                O envio de hoje foi concluído e está bloqueado para edição. Use este resumo como comprovante do registro.
              </p>
            </div>
            <span className="pill ok">{last?.status ?? "enviado"}</span>
          </div>

          <div className="locked-report-grid" aria-label="Resumo do relatório enviado">
            <div>
              <span>Dia anterior</span>
              <strong>{prev?.totalPedidos ?? 0}</strong>
              <small>{prev?.totalNoPrazo ?? 0} no prazo · {prev?.totalForaDoPrazo ?? 0} fora</small>
            </div>
            <div>
              <span>Prévia atual</span>
              <strong>{cur?.totalPedidos ?? 0}</strong>
              <small>{cur?.totalFinalizado ?? 0} finalizados · {cur?.totalEmAberto ?? 0} em aberto</small>
            </div>
            <div>
              <span>UFs preenchidas</span>
              <strong>{lockedUfWithVolume}</strong>
              <small>com volume informado</small>
            </div>
            <div>
              <span>Enviado por</span>
              <strong>{lockedSubmitter}</strong>
              <small>{formatDateTime(last?.submittedAt)}</small>
            </div>
          </div>

          {last?.observacoes ? (
            <div className="locked-report-note">
              <span>Observação enviada</span>
              <p>{last.observacoes}</p>
            </div>
          ) : null}

          <div className="locked-report-footer">
            <p className="muted">Para corrigir dados já enviados, acione o time interno informando data, UF e total correto.</p>
            {backHref ? (
              <Link className="btn secondary" href={backHref}>
                Voltar ao portal
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {!lockedToday ? (
        <>
          {uploadAction ? (
            <section className="card xlsx-upload-card" style={{ marginBottom: 18 }}>
              <div className="form-card-heading">
                <h2 className="section-title">Enviar planilha preenchida</h2>
                <span className="section-tag">Alternativa ao formulário</span>
              </div>
              <p className="muted">
                Baixe o modelo acima, preencha no Excel/Sheets e envie o arquivo aqui — as mesmas regras de conferência do
                formulário se aplicam.
              </p>
              <form action={uploadAction} className="xlsx-upload-form" encType="multipart/form-data">
                {errorPath ? <input type="hidden" name="errorPath" value={errorPath} /> : null}
                <div className="field">
                  <label htmlFor="arquivo">Arquivo .xlsx</label>
                  <input id="arquivo" name="arquivo" type="file" accept=".xlsx" required />
                </div>
                <div className="actions">
                  <button className="btn secondary" name="intent" value="draft" type="submit">
                    Salvar rascunho
                  </button>
                  <button className="btn" name="intent" value="submit" type="submit">
                    Enviar planilha
                  </button>
                </div>
              </form>
            </section>
          ) : null}

        <form action={action} className="grid compact-report-form" data-daily-report-form>
          {successPath ? <input type="hidden" name="successPath" value={successPath} /> : null}
          {draftPath ? <input type="hidden" name="draftPath" value={draftPath} /> : null}
          {errorPath ? <input type="hidden" name="errorPath" value={errorPath} /> : null}
          <section className="card form-identity-card">
            <div className="form-card-heading">
              <h2 className="section-title">Identificação</h2>
            </div>
            <div className="identity-grid">
              <div className="field">
                <label htmlFor="dataReport">Data do relatório</label>
                <input id="dataReport" name="dataReport" type="date" defaultValue={pick("dataReport", todayInput)} required />
              </div>
              <div className="field">
                <label htmlFor="dataResultadoDiaAnterior">Data do resultado anterior</label>
                <input
                  id="dataResultadoDiaAnterior"
                  name="dataResultadoDiaAnterior"
                  type="date"
                  defaultValue={pick("dataResultadoDiaAnterior", formatDateInput(yesterday))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="dataPreviaDiaAtual">Data da prévia atual</label>
                <input
                  id="dataPreviaDiaAtual"
                  name="dataPreviaDiaAtual"
                  type="date"
                  defaultValue={pick("dataPreviaDiaAtual", formatDateInput(today))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="submittedByName">Responsável</label>
                <input
                  id="submittedByName"
                  name="submittedByName"
                  defaultValue={pick("submittedByName", last?.submittedByName ?? defaultResponsibleName)}
                />
              </div>
              <div className="field identity-email">
                <label htmlFor="submittedByEmail">E-mail do responsável</label>
                <input
                  id="submittedByEmail"
                  name="submittedByEmail"
                  type="email"
                  defaultValue={pick("submittedByEmail", last?.submittedByEmail ?? defaultResponsibleEmail)}
                />
              </div>
            </div>
          </section>

          <div className="daily-metrics-grid">
            <section className={`card${hasPreviousError ? " has-error" : ""}`}>
              <div className="form-card-heading">
                <h2 className="section-title">Dia anterior</h2>
                <span className="section-tag">Resultado fechado</span>
                {hasPreviousError ? <span className="section-tag error">Verifique os totais</span> : null}
              </div>
              <div className="compact-field-grid">
                {previousFields.map(([name, label, value]) => (
                  <div key={name}>{numberField(name, label, value)}</div>
                ))}
              </div>
            </section>

            <section className={`card${hasCurrentError ? " has-error" : ""}`}>
              <div className="form-card-heading">
                <h2 className="section-title">Prévia atual</h2>
                <span className="section-tag">Parcial do dia</span>
                {hasCurrentError ? <span className="section-tag error">Verifique os totais</span> : null}
              </div>
              <div className="compact-field-grid">
                {currentFields.map(([name, label, value]) => (
                  <div key={name}>{numberField(name, label, value)}</div>
                ))}
              </div>
            </section>
          </div>

          <section className={`card uf-compact-section${hasUfError ? " has-error" : ""}`}>
            <div className="form-card-heading">
              <h2 className="section-title">Pedidos por UF do dia anterior</h2>
              <span className="section-tag">Dentro / fora do prazo</span>
              {hasUfError ? <span className="section-tag error">Verifique os totais</span> : null}
            </div>
            <div className="uf-compact-grid">
              {BRAZILIAN_UFS.map((uf) => {
                const row = last?.ufMetrics.find((item) => item.uf === uf);
                return (
                  <div className="uf-compact-row" key={uf}>
                    <strong>{uf}</strong>
                    <label>
                      <span>D</span>
                      <input
                        name={`uf_${uf}_dentro`}
                        type="number"
                        min="0"
                        defaultValue={pick(`uf_${uf}_dentro`, row?.dentroDoPrazo ?? 0)}
                        required
                        aria-label={`${uf} dentro do prazo`}
                      />
                    </label>
                    <label>
                      <span>F</span>
                      <input
                        name={`uf_${uf}_fora`}
                        type="number"
                        min="0"
                        defaultValue={pick(`uf_${uf}_fora`, row?.foraDoPrazo ?? 0)}
                        required
                        aria-label={`${uf} fora do prazo`}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="form-footer-grid">
            <div className="card">
              <h2 className="section-title">Observações</h2>
            <div className="field">
              <label htmlFor="observacoes">Observações operacionais</label>
              <textarea id="observacoes" name="observacoes" defaultValue={pick("observacoes", last?.observacoes ?? "")} />
            </div>
            </div>
            <div className="card form-submit-panel">
              <FormConsistencyAlerts />
              <div className="actions form-actions">
                <button className="btn secondary" name="intent" value="draft" type="submit">
                  Salvar rascunho
                </button>
                <button className="btn" name="intent" value="submit" type="submit">
                  Enviar relatório
                </button>
              </div>
            </div>
          </section>
        </form>
        </>
      ) : null}
    </>
  );
}
