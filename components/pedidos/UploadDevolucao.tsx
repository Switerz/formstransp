"use client";

import { useState, useTransition } from "react";
import { uploadDevolucaoTransportadora, type DevolucaoResumo } from "@/app/portal/minha-base/actions";

export function UploadDevolucao() {
  const [resumo, setResumo] = useState<DevolucaoResumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setErro(null);
    startTransition(async () => {
      try {
        const result = await uploadDevolucaoTransportadora(formData);
        setResumo(result);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Não foi possível processar a devolução.");
      }
    });
  }

  const violacoesProtegidas = resumo?.detalhes.flatMap((d) => d.violacoesProtegidas.map((v) => ({ ...v, linha: d.linha }))) ?? [];
  const tentativasBloqueadas = resumo?.detalhes.flatMap((d) => d.tentativasBloqueadas.map((v) => ({ ...v, linha: d.linha }))) ?? [];

  return (
    <section className="card" style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 15, marginTop: 0 }}>Devolução da base</h2>
      <p className="muted" style={{ marginTop: -6 }}>
        Envie o XLSX preenchido com os campos operacionais. Campos de origem (protegidos) não podem ser alterados.
      </p>

      <form action={onSubmit} className="actions" style={{ alignItems: "center" }}>
        <input type="file" name="arquivo" accept=".xlsx" required />
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Enviando..." : "Enviar devolução"}
        </button>
      </form>

      {erro ? (
        <div className="compact-alert">
          <div className="compact-alert-title">Falha ao processar: {erro}</div>
        </div>
      ) : null}

      {resumo ? (
        <div style={{ marginTop: 14 }}>
          {violacoesProtegidas.length > 0 ? (
            <div className="compact-alert">
              <div className="compact-alert-title">🚨 Divergência crítica: campo(s) protegido(s) alterado(s)</div>
              <div className="tamper-list">
                {violacoesProtegidas.map((v, i) => (
                  <div key={i} className="tamper-item">
                    <strong>
                      Linha {v.linha} · {v.campo}
                    </strong>
                    <br />
                    Original: "{String(v.antes)}" → Enviado: "{String(v.depois)}" (não aplicado)
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="compact-alert ok">
              <div className="compact-alert-title">✓ Nenhuma tentativa de alterar campo protegido</div>
            </div>
          )}

          {tentativasBloqueadas.length > 0 ? (
            <div className="compact-alert" style={{ marginTop: 10 }}>
              <div className="compact-alert-title">Campos já respondidos preservados (não sobrescritos)</div>
              <div className="tamper-list">
                {tentativasBloqueadas.map((v, i) => (
                  <div key={i} className="tamper-item">
                    <strong>
                      Linha {v.linha} · {v.campo}
                    </strong>
                    <br />
                    Valor atual mantido: "{String(v.antes)}" (tentativa enviada: "{String(v.depois)}")
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <p style={{ marginTop: 12, fontSize: 13 }}>
            {resumo.totalLinhas} linha(s) · {resumo.aplicados} aplicada(s) · {resumo.semAlteracao} sem alteração ·{" "}
            {resumo.erros} erro(s) · {resumo.pedidosNaoEncontrados} pedido(s) não encontrado(s) ·{" "}
            {resumo.pedidosDeOutraTransportadora} de outra transportadora
          </p>
        </div>
      ) : null}
    </section>
  );
}
