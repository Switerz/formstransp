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

const ufs = ["CE", "RN", "PB", "PE", "BA"];

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

  return (
    <>
      <div className="page-title">
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
        <form action={action} className="grid" data-daily-report-form>
          {successPath ? <input type="hidden" name="successPath" value={successPath} /> : null}
          {draftPath ? <input type="hidden" name="draftPath" value={draftPath} /> : null}
          {errorPath ? <input type="hidden" name="errorPath" value={errorPath} /> : null}
          <section className="card">
            <h2 className="section-title">1. Identificação</h2>
            <div className="form-grid">
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
              <div className="field">
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

          <section className="card">
            <h2 className="section-title">2. Resultado do dia anterior</h2>
            <div className="form-grid">
              {numberField("prev_totalPedidos", "Total de pedidos", prev?.totalPedidos)}
              {numberField("prev_totalNoPrazo", "Total no prazo", prev?.totalNoPrazo)}
              {numberField("prev_totalForaDoPrazo", "Total fora do prazo", prev?.totalForaDoPrazo)}
              {numberField("prev_totalEntregue", "Total entregue", prev?.totalEntregue)}
              {numberField("prev_totalEmAberto", "Total em aberto", prev?.totalEmAberto)}
              {numberField("prev_totalTentativaInsucesso", "Tentativa sem sucesso", prev?.totalTentativaInsucesso)}
              {numberField("prev_totalDevolucao", "Devolução", prev?.totalDevolucao)}
              {numberField("prev_totalCancelado", "Cancelado", prev?.totalCancelado)}
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">3. Pedidos por UF do dia anterior</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>UF</th>
                    <th>Dentro do prazo</th>
                    <th>Fora do prazo</th>
                  </tr>
                </thead>
                <tbody>
                  {ufs.map((uf) => {
                    const row = last?.ufMetrics.find((item) => item.uf === uf);
                    return (
                      <tr key={uf}>
                        <td>
                          <strong>{uf}</strong>
                        </td>
                        <td>
                          <input name={`uf_${uf}_dentro`} type="number" min="0" defaultValue={row?.dentroDoPrazo ?? 0} required />
                        </td>
                        <td>
                          <input name={`uf_${uf}_fora`} type="number" min="0" defaultValue={row?.foraDoPrazo ?? 0} required />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">4. Prévia do SLA do dia atual</h2>
            <div className="form-grid">
              {numberField("cur_totalPedidos", "Total de pedidos", cur?.totalPedidos)}
              {numberField("cur_totalFinalizado", "Total finalizado", cur?.totalFinalizado)}
              {numberField("cur_totalEmAberto", "Total em aberto", cur?.totalEmAberto)}
              {numberField("cur_totalEntregue", "Total entregue", cur?.totalEntregue)}
              {numberField("cur_totalTentativaInsucesso", "Tentativa sem sucesso", cur?.totalTentativaInsucesso)}
              {numberField("cur_totalDevolucao", "Devolução", cur?.totalDevolucao)}
              {numberField("cur_totalCancelado", "Cancelado", cur?.totalCancelado)}
              {numberField("cur_finalizadosNoPrazo", "Finalizados no prazo", cur?.finalizadosNoPrazo)}
              {numberField("cur_finalizadosForaDoPrazo", "Finalizados fora do prazo", cur?.finalizadosForaDoPrazo)}
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">5. Observações</h2>
            <div className="field">
              <label htmlFor="observacoes">Observações operacionais</label>
              <textarea id="observacoes" name="observacoes" defaultValue={last?.observacoes ?? ""} />
            </div>
            <div style={{ marginTop: 14 }}>
              <FormConsistencyAlerts />
            </div>
          </section>

          <div className="actions">
            <button className="btn secondary" name="intent" value="draft" type="submit">
              Salvar rascunho
            </button>
            <button className="btn" name="intent" value="submit" type="submit">
              Enviar relatório
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}
