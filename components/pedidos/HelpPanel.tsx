"use client";

import { useState } from "react";

interface HelpItem {
  question: string;
  helpText: string;
  answer: React.ReactNode;
}

const FLUXO = (
  <>
    O processo possui quatro etapas principais:
    <div className="help-flow">
      <div className="help-flow-step">
        <div className="help-flow-num">1</div>
        <div>
          <strong>Intelipost publica</strong>
          <span>A integração envia a base de origem automaticamente.</span>
        </div>
      </div>
      <div className="help-flow-step">
        <div className="help-flow-num">2</div>
        <div>
          <strong>Transportador baixa</strong>
          <span>A transportadora faz o download da base para tratamento.</span>
        </div>
      </div>
      <div className="help-flow-step">
        <div className="help-flow-num">3</div>
        <div>
          <strong>Transportador devolve</strong>
          <span>A versão atualizada é enviada novamente pelo portal.</span>
        </div>
      </div>
      <div className="help-flow-step">
        <div className="help-flow-num">4</div>
        <div>
          <strong>Portal compara</strong>
          <span>O sistema confronta os campos protegidos e destaca divergências.</span>
        </div>
      </div>
    </div>
  </>
);

const HELP_ITEMS: HelpItem[] = [
  {
    question: "Como funciona o fluxo da base?",
    helpText: "como funciona o fluxo da base publicação download devolução comparação transportes transportadora",
    answer: FLUXO,
  },
  {
    question: "Quem pode publicar a base original?",
    helpText: "quem pode publicar base original transportes permissão acesso",
    answer: "A base original vem automaticamente da integração com a Intelipost - nenhum usuário publica manualmente.",
  },
  {
    question: "Quem pode devolver uma base atualizada?",
    helpText: "quem pode devolver base atualizada transportadora upload permissão",
    answer: "A devolução deve ser feita pela transportadora vinculada à base, autenticada no portal. O sistema identifica a transportadora pela sessão, nunca por dado enviado no formulário.",
  },
  {
    question: "O que são colunas protegidas?",
    helpText: "o que são colunas protegidas integridade não pode alterar",
    answer: "São os 14 campos que vêm da Intelipost e devem permanecer idênticos na devolução. Se algum deles vier alterado, o portal rejeita a linha e sinaliza uma divergência de integridade.",
  },
  {
    question: "O que aparece no comparativo?",
    helpText: "o que o comparativo mostra antes depois linhas células alteradas",
    answer: "O comparativo mostra os campos operacionais efetivamente alterados na última devolução (antes e depois), além de qualquer tentativa de alterar campo protegido ou já respondido.",
  },
  {
    question: "Como funciona o De/Para de status?",
    helpText: "status atual ofensores gb de para transportadora ausente extravio devolução cancelado endereço retirada retenção fiscal",
    answer: "O portal utiliza o De/Para de status para classificar os registros em grupos de Ofensores GB, como Transportadora, Ausente, Extravio, Devolução, Cancelado, End. Incorreto, Retirada e Ret. Fiscal.",
  },
];

export function HelpPanel() {
  const [open, setOpen] = useState(false);
  const [openItem, setOpenItem] = useState<number | null>(null);
  const [busca, setBusca] = useState("");

  const q = busca.trim().toLowerCase();
  const visiveis = HELP_ITEMS.filter((item) => !q || item.helpText.includes(q) || item.question.toLowerCase().includes(q));

  return (
    <>
      <button type="button" className="help-fab" id="helpFab" onClick={() => setOpen(true)} title="Ajuda e informações" aria-label="Abrir ajuda e informações">
        i
      </button>

      <div className={`help-backdrop ${open ? "open" : ""}`} id="helpBackdrop" onClick={() => setOpen(false)} />

      <aside className={`help-panel ${open ? "open" : ""}`} id="helpPanel" aria-hidden={!open}>
        <div className="help-header">
          <div>
            <h2 className="help-header-title">Ajuda e informações</h2>
            <div className="help-header-sub">Consulte os principais fluxos e dúvidas sobre o uso do portal.</div>
          </div>
          <button className="help-close" id="helpClose" type="button" aria-label="Fechar ajuda" onClick={() => setOpen(false)}>
            ×
          </button>
        </div>

        <div className="help-search-wrap">
          <input
            id="helpSearch"
            className="help-search"
            type="text"
            placeholder="Pesquisar uma dúvida ou fluxo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="help-content" id="helpContent">
          <div className="help-section-title">Principais fluxos</div>
          {visiveis.slice(0, 3).map((item, i) => (
            <HelpItemEl key={item.question} item={item} isOpen={openItem === i} onToggle={() => setOpenItem(openItem === i ? null : i)} />
          ))}

          <div className="help-section-title">Conferência e validação</div>
          {visiveis.slice(3).map((item, i) => (
            <HelpItemEl
              key={item.question}
              item={item}
              isOpen={openItem === i + 3}
              onToggle={() => setOpenItem(openItem === i + 3 ? null : i + 3)}
            />
          ))}

          {visiveis.length === 0 ? <div className="help-empty">Nenhuma informação encontrada para essa busca.</div> : null}
        </div>
      </aside>
    </>
  );
}

function HelpItemEl({ item, isOpen, onToggle }: { item: HelpItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={`help-item ${isOpen ? "open" : ""}`} data-help-text={item.helpText}>
      <button className="help-question" type="button" onClick={onToggle}>
        <span>{item.question}</span>
        <span className="help-question-arrow">⌄</span>
      </button>
      <div className="help-answer">{item.answer}</div>
    </div>
  );
}
