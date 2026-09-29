export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-copy">
          <div className="auth-mark">FormsTransp</div>
          <h1>Acesso operacional</h1>
          <p>Portal Forms Transp</p>
        </div>

        <div className="auth-form">
          <div>
            <h2>Entrar</h2>
            <p className="muted">Carregamento do portal validado.</p>
          </div>

          <div className="field">
            <label>Usuário ou e-mail</label>
            <input disabled />
          </div>

          <div className="field">
            <label>Senha</label>
            <input type="password" disabled />
          </div>
        </div>
      </section>
    </main>
  );
}
