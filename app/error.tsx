"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="shell">
      <section className="card">
        <h1>Algo saiu do esperado</h1>
        <p className="muted">A tela não carregou corretamente. Tente novamente ou volte para o admin.</p>
        <div className="actions">
          <button className="btn" type="button" onClick={reset}>
            Tentar novamente
          </button>
          <Link className="btn secondary" href="/">
            Voltar ao admin
          </Link>
        </div>
      </section>
    </main>
  );
}
