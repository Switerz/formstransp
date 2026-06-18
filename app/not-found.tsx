import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell">
      <section className="card">
        <h1>Página não encontrada</h1>
        <p className="muted">O recurso solicitado não existe ou não está disponível para acesso.</p>
        <Link className="btn" href="/">Voltar ao admin</Link>
      </section>
    </main>
  );
}
