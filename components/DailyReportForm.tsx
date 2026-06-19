import Link from "next/link";
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
  error?: string;
  last?: DailyReportFormLastSubmission;
  defaultResponsibleName?: string;
  defaultResponsibleEmail?: string;
  backHref?: string;
  successPath?: string;
  draftPath?: string;
  errorPath?: string;
};

function numberField(name: string, label: string, value = 0) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type="number" min="0" defaultValue={value} required />
    </div>
  );
}

export function DailyReportForm({
  transportadora,
  action,
  error,
  last,
  defaultResponsibleName = "",
  defaultResponsibleEmail = "",
  backHref,
  successPath,
  draftPath,
  errorPath,
}: DailyReportFormProps) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const prev = last?.previousDayMetrics;
  const cur = last?.currentDayPreviewMetrics;
  const todayInput = formatDateInput(today);
  const lockedToday =
    last?.dataReport.toISOString().slice(0, 10) === todayInput && ["submitted", "validated", "sent"].includes(last.status);
  const previousFields = [
    ["prev_totalPedidos", "Total de pedidos", prev?.totalPedidos],
    ["prev_totalNoPrazo", "No prazo", prev?.totalNoPrazo],
    ["prev_totalForaDoPrazo", "Fora do prazo", prev?.totalForaDoPrazo],
    ["prev_totalEntregue", "Entregue", prev?.totalEntregue],
    ["prev_totalEmAberto", "Em aberto", prev?.totalEmAberto],
    ["prev_totalTentativaInsucesso", "Tentativa sem sucesso", prev?.totalTentativaInsucesso],
    ["prev_totalDevolucao", "Devolução", prev?.totalDevolucao],
    ["prev_totalCancelado", "Cancelado", prev?.totalCancelado],
  ] as const;
  const currentFields = [
    ["cur_totalPedidos", "Total de pedidos", cur?.totalPedidos],
    ["cur_totalFinalizado", "Finalizado", cur?.totalFinalizado],
    ["cur_totalEmAberto", "Em aberto", cur?.totalEmAberto],
    ["cur_totalEntregue", "Entregue", cur?.totalEntregue],
    ["cur_totalTentativaInsucesso", "Tentativa sem sucesso", cur?.totalTentativaInsucesso],
    ["cur_totalDevolucao", "Devolução", cur?.totalDevolucao],
    ["cur_totalCancelado", "Cancelado", cur?.totalCancelado],
    ["cur_finalizadosNoPrazo", "Finalizados no prazo", cur?.finalizadosNoPrazo],
    ["cur_finalizadosForaDoPrazo", "Finalizados fora do prazo", cur?.finalizadosForaDoPrazo],
  ] as const;

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
          <span className="pill">Envio esperado até 11h</span>
        </div>
      </div>

      {error ? (
        <div className="alert" style={{ marginBottom: 16 }}>
          <strong>Não foi possível salvar:</strong> {error}
        </div>
      ) : null}

      {lockedToday ? (
        <section className="card">
          <h2 className="section-title">Relatório já enviado</h2>
          <p className="muted">
            O relatório de hoje foi recebido e está bloqueado para edição. Para corrigir dados enviados, acione o time
            interno.
          </p>
        </section>
      ) : null}

      {!lockedToday ? (
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
                <input id="dataReport" name="dataReport" type="date" defaultValue={todayInput} required />
              </div>
              <div className="field">
                <label htmlFor="dataResultadoDiaAnterior">Data do resultado anterior</label>
                <input
                  id="dataResultadoDiaAnterior"
                  name="dataResultadoDiaAnterior"
                  type="date"
                  defaultValue={formatDateInput(yesterday)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="dataPreviaDiaAtual">Data da prévia atual</label>
                <input
                  id="dataPreviaDiaAtual"
                  name="dataPreviaDiaAtual"
                  type="date"
                  defaultValue={formatDateInput(today)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="submittedByName">Responsável</label>
                <input
                  id="submittedByName"
                  name="submittedByName"
                  defaultValue={last?.submittedByName ?? defaultResponsibleName}
                />
              </div>
              <div className="field identity-email">
                <label htmlFor="submittedByEmail">E-mail do responsável</label>
                <input
                  id="submittedByEmail"
                  name="submittedByEmail"
                  type="email"
                  defaultValue={last?.submittedByEmail ?? defaultResponsibleEmail}
                />
              </div>
            </div>
          </section>

          <div className="daily-metrics-grid">
            <section className="card">
              <div className="form-card-heading">
                <h2 className="section-title">Dia anterior</h2>
                <span className="section-tag">Resultado fechado</span>
              </div>
              <div className="compact-field-grid">
                {previousFields.map(([name, label, value]) => (
                  <div key={name}>{numberField(name, label, value)}</div>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="form-card-heading">
                <h2 className="section-title">Prévia atual</h2>
                <span className="section-tag">Parcial do dia</span>
              </div>
              <div className="compact-field-grid">
                {currentFields.map(([name, label, value]) => (
                  <div key={name}>{numberField(name, label, value)}</div>
                ))}
              </div>
            </section>
          </div>

          <section className="card uf-compact-section">
            <div className="form-card-heading">
              <h2 className="section-title">Pedidos por UF do dia anterior</h2>
              <span className="section-tag">Dentro / fora do prazo</span>
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
                        defaultValue={row?.dentroDoPrazo ?? 0}
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
                        defaultValue={row?.foraDoPrazo ?? 0}
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
              <textarea id="observacoes" name="observacoes" defaultValue={last?.observacoes ?? ""} />
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
      ) : null}
    </>
  );
}
