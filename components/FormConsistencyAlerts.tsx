"use client";

import { useEffect, useState } from "react";
import { BRAZILIAN_UFS } from "@/lib/ufs";

function readNumber(form: HTMLFormElement, name: string) {
  const input = form.elements.namedItem(name) as HTMLInputElement | null;
  const value = Number(input?.value ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function FormConsistencyAlerts() {
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>("[data-daily-report-form]");
    if (!form) return;
    const currentForm = form;

    function validate() {
      const nextAlerts: string[] = [];
      const prevTotal = readNumber(currentForm, "prev_totalPedidos");
      const curTotal = readNumber(currentForm, "cur_totalPedidos");
      const prevStatusTotal =
        readNumber(currentForm, "prev_totalEntregue") +
        readNumber(currentForm, "prev_totalEmAberto") +
        readNumber(currentForm, "prev_totalTentativaInsucesso") +
        readNumber(currentForm, "prev_totalDevolucao") +
        readNumber(currentForm, "prev_totalCancelado");
      const curStatusTotal =
        readNumber(currentForm, "cur_totalEntregue") +
        readNumber(currentForm, "cur_totalEmAberto") +
        readNumber(currentForm, "cur_totalTentativaInsucesso") +
        readNumber(currentForm, "cur_totalDevolucao") +
        readNumber(currentForm, "cur_totalCancelado");
      const ufTotal = BRAZILIAN_UFS.reduce(
        (sum, uf) => sum + readNumber(currentForm, `uf_${uf}_dentro`) + readNumber(currentForm, `uf_${uf}_fora`),
        0,
      );
      const prazoTotal = readNumber(currentForm, "prev_totalNoPrazo") + readNumber(currentForm, "prev_totalForaDoPrazo");
      const finalizadosPrazo =
        readNumber(currentForm, "cur_finalizadosNoPrazo") + readNumber(currentForm, "cur_finalizadosForaDoPrazo");
      const totalFinalizado = readNumber(currentForm, "cur_totalFinalizado");

      if (prevTotal > 0 && ufTotal !== prevTotal) {
        nextAlerts.push(`Pedidos por UF somam ${ufTotal}, mas o total do dia anterior é ${prevTotal}.`);
      }
      if (prevTotal > 0 && prevStatusTotal !== prevTotal) {
        nextAlerts.push(`Status do dia anterior somam ${prevStatusTotal}, mas o total do dia anterior é ${prevTotal}.`);
      }
      if (prevTotal > 0 && prazoTotal !== prevTotal) {
        nextAlerts.push(`No prazo + fora do prazo somam ${prazoTotal}, mas o total do dia anterior é ${prevTotal}.`);
      }
      if (curTotal > 0 && curStatusTotal !== curTotal) {
        nextAlerts.push(`Status do dia atual somam ${curStatusTotal}, mas o total atual é ${curTotal}.`);
      }
      if (totalFinalizado > 0 && finalizadosPrazo > totalFinalizado) {
        nextAlerts.push(`Finalizados por prazo somam ${finalizadosPrazo}, acima do total finalizado ${totalFinalizado}.`);
      }

      setAlerts(nextAlerts);
    }

    validate();
    currentForm.addEventListener("input", validate);
    return () => currentForm.removeEventListener("input", validate);
  }, []);

  if (!alerts.length) {
    return (
      <div className="alert ok">
        Totais consistentes até aqui.
      </div>
    );
  }

  return (
    <div className="alert">
      <strong>Verifique antes de enviar:</strong>
      <ul>
        {alerts.map((alert) => (
          <li key={alert}>{alert}</li>
        ))}
      </ul>
    </div>
  );
}
