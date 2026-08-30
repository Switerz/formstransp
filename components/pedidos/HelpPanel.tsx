"use client";

import { useState } from "react";

interface HelpItem {
  question: string;
  answer: string;
}

const HELP_ITEMS: HelpItem[] = [
  {
    question: "Como funciona o fluxo da base?",
    answer:
      "A Intelipost envia os pedidos diariamente e eles entram automaticamente na sua Minha Base. Você baixa a base, preenche os campos operacionais (coleta, previsão, status, ocorrência etc.) e devolve o arquivo pelo botão de upload. O sistema valida e aplica as respostas.",
  },
  {
    question: "Quem pode publicar a base original?",
    answer: "A base original vem automaticamente da integração com a Intelipost. Nenhum usuário publica manualmente.",
  },
  {
    question: "Quem pode devolver a base atualizada?",
    answer: "Somente usuários da própria transportadora, autenticados no portal. O sistema identifica sua transportadora pela sua sessão de login - não é possível enviar dados de outra transportadora.",
  },
  {
    question: "O que são colunas protegidas?",
    answer:
      "São os 14 campos que vêm da Intelipost (destinatário, endereço, transportadora, valores etc.). Eles não podem ser alterados na devolução. Se o arquivo devolvido tiver esses campos com valor diferente do original, a linha é rejeitada e a tentativa fica registrada.",
  },
  {
    question: "O que o comparativo mostra?",
    answer:
      "Depois de uma devolução, o sistema mostra quais campos operacionais foram efetivamente alterados (antes e depois) e sinaliza qualquer tentativa de alterar um campo protegido ou um campo que já tinha resposta.",
  },
  {
    question: "Como funciona o DE/PARA de status?",
    answer:
      "O sistema utiliza o DE/PARA de status para classificar os registros em grupos de Ofensores GB, como Transportadora, Ausente, Extravio, Devolução, Cancelado, End. Incorreto, Retirada e Ret. Fiscal.",
  },
];

export function HelpPanel() {
  const [open, setOpen] = useState(false);
  const [openItem, setOpenItem] = useState<number | null>(null);

  return (
    <>
      <button
        type="button"
        className="help-fab"
        onClick={() => setOpen(true)}
        title="Ajuda e informações"
        aria-label="Abrir ajuda e informações"
      >
        i
      </button>

      <div className={`help-backdrop ${open ? "show" : ""}`} onClick={() => setOpen(false)} />

      <aside className={`help-panel ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="help-panel-header">
          <h2 style={{ fontSize: 15, margin: 0 }}>Ajuda e informações</h2>
          <button type="button" className="btn secondary compact" onClick={() => setOpen(false)}>
            Fechar
          </button>
        </div>
        <div className="help-panel-body">
          {HELP_ITEMS.map((item, i) => (
            <div key={item.question} className={`help-item ${openItem === i ? "open" : ""}`}>
              <button type="button" className="help-question" onClick={() => setOpenItem(openItem === i ? null : i)}>
                <span>{item.question}</span>
                <span className="help-question-arrow">⌄</span>
              </button>
              <div className="help-answer">{item.answer}</div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
