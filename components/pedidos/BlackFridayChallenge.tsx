import "./black-friday-challenge.css";

interface BlackFridayChallengeProps {
  transportadoraNome: string;
  slaOperacional: string;
  totalPedidos: number;
  pendentes: number;
  respondidos: number;
}

export function BlackFridayChallenge({
  transportadoraNome,
  slaOperacional,
  totalPedidos,
  pendentes,
  respondidos,
}: BlackFridayChallengeProps) {
  return (
    <div className="bf-challenge">
      <section className="bf-challenge-hero">
        <span className="bf-challenge-eyebrow">
          <span className="bf-challenge-live" />
          BLACK FRIDAY TRANSPORTES CHALLENGE
        </span>

        <h2>
          {transportadoraNome}, a corrida pela liderança começou.
        </h2>

        <p>
          Mantenha sua base atualizada, acompanhe os indicadores
          operacionais e prepare-se para conquistar o topo do ranking.
        </p>

        <div className="bf-challenge-pills">
          <span>⚡ Black Friday 2026</span>
          <span>Minha operação</span>
          <span>Ranking em preparação</span>
        </div>
      </section>

      <section className="bf-challenge-metrics">
        <div className="bf-challenge-metric">
          <small>Seus pontos</small>
          <strong>—</strong>
          <span>Aguardando apuração</span>
        </div>

        <div className="bf-challenge-metric">
          <small>SLA com Base Completa</small>
          <strong>{slaOperacional}%</strong>
          <span>Indicador operacional da base</span>
        </div>

        <div className="bf-challenge-metric">
          <small>Missões completas</small>
          <strong>—</strong>
          <span>Aguardando apuração</span>
        </div>

        <div className="bf-challenge-metric">
          <small>Sequência</small>
          <strong>—</strong>
          <span>Aguardando apuração</span>
        </div>

        <div className="bf-challenge-metric">
          <small>Avarias pendentes</small>
          <strong>—</strong>
          <span>Aguardando integração</span>
        </div>
      </section>

      <div className="bf-challenge-columns">
        <div className="bf-challenge-stack">
          <section className="bf-challenge-card">
            <div className="bf-challenge-heading">
              <div>
                <h3>🏁 Corrida pela liderança</h3>
                <p>Seu progresso na competição.</p>
              </div>
              <span className="bf-challenge-tag">Em preparação</span>
            </div>

            <div className="bf-challenge-rival">
              <strong>{transportadoraNome}</strong>
              <span>
                A pontuação e a diferença para a liderança serão
                exibidas após a apuração.
              </span>
              <div className="bf-challenge-progress">
                <div style={{ width: "0%" }} />
              </div>
            </div>
          </section>

          <section className="bf-challenge-card">
            <div className="bf-challenge-heading">
              <div>
                <h3>🎯 Suas missões</h3>
                <p>Desafios operacionais da Black Friday.</p>
              </div>
            </div>

            <div className="bf-challenge-mission">
              <span>🎯</span>
              <div>
                <strong>SLA Impecável</strong>
                <small>
                  Manter SLA ≥ 96% no fechamento da rodada.
                </small>
              </div>
              <b>A apurar</b>
            </div>

            <div className="bf-challenge-mission">
              <span>📦</span>
              <div>
                <strong>Base em dia</strong>
                <small>
                  Realizar uma atualização operacional válida.
                </small>
              </div>
              <b>A apurar</b>
            </div>

            <div className="bf-challenge-mission">
              <span>📸</span>
              <div>
                <strong>Zero avaria pendente</strong>
                <small>
                  Enviar as evidências operacionais pendentes.
                </small>
              </div>
              <b>A apurar</b>
            </div>
          </section>

          <section className="bf-challenge-card">
            <div className="bf-challenge-heading">
              <div>
                <h3>⚡ Ações que movem sua operação</h3>
                <p>Continue trabalhando sem sair da Minha Base.</p>
              </div>
            </div>

            <div className="bf-challenge-actions">
              <div>
                <strong>📥 Minha Base</strong>
                <small>
                  {totalPedidos.toLocaleString("pt-BR")} pedidos
                  disponíveis.
                </small>
                <a href="/portal/minha-base/download">
                  Baixar base
                </a>
              </div>

              <div>
                <strong>↥ Atualizar operação</strong>
                <small>
                  {pendentes.toLocaleString("pt-BR")} pedidos
                  pendentes e {respondidos.toLocaleString("pt-BR")} respondidos.
                </small>
                <a href="#bf-base-operacional">
                  Enviar atualização
                </a>
              </div>

              <div>
                <strong>📸 Evidências</strong>
                <small>
                  Consulte as orientações para envio de evidências.
                </small>
                <span className="bf-challenge-unavailable">
                  Integração pendente
                </span>
              </div>
            </div>
          </section>
        </div>

        <div className="bf-challenge-stack">
          <section className="bf-challenge-card">
            <div className="bf-challenge-heading">
              <div>
                <h3>🏆 Ranking Black Friday</h3>
                <p>Classificação da competição.</p>
              </div>
            </div>

            <div className="bf-challenge-ranking-empty">
              <strong>Ranking em preparação</strong>
              <p>
                A classificação será exibida quando os resultados
                oficiais estiverem disponíveis.
              </p>
            </div>
          </section>

          <section className="bf-challenge-card">
            <div className="bf-challenge-heading">
              <div>
                <h3>📊 Sua operação</h3>
                <p>Indicadores reais da Minha Base.</p>
              </div>
            </div>

            <div className="bf-challenge-operation-row">
              <span>Total de pedidos</span>
              <strong>{totalPedidos.toLocaleString("pt-BR")}</strong>
            </div>
            <div className="bf-challenge-operation-row">
              <span>Pendentes</span>
              <strong>{pendentes.toLocaleString("pt-BR")}</strong>
            </div>
            <div className="bf-challenge-operation-row">
              <span>Respondidos</span>
              <strong>{respondidos.toLocaleString("pt-BR")}</strong>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
