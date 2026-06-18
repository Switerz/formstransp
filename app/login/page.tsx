import { redirect } from "next/navigation";
import { LogIn } from "lucide-react";
import { login } from "@/app/auth-actions";
import { getCurrentUser, isInternalRole } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; login?: string; next?: string }>;
}) {
  const [params, currentUser] = await Promise.all([searchParams, getCurrentUser()]);
  if (currentUser?.passwordMustChange) redirect("/alterar-senha");
  if (currentUser) redirect(isInternalRole(currentUser.role) ? "/" : "/portal");

  const hasError = params.error === "invalid";
  const isRateLimited = params.error === "rate_limited";
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-copy">
          <div className="auth-mark">FormsTransp</div>
          <h1>Acesso operacional</h1>
          <p>
            Entre com as credenciais fornecidas para enviar relatórios da transportadora ou acompanhar a operação.
          </p>
        </div>

        <form action={login} className="auth-form">
          <input type="hidden" name="next" value={next} />
          <div>
            <h2>Entrar</h2>
            <p className="muted">Use seu usuário ou e-mail cadastrado.</p>
          </div>

          {hasError || isRateLimited ? (
            <div className="alert" role="alert">
              <strong>Não foi possível entrar.</strong>{" "}
              {isRateLimited
                ? "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente."
                : "Confira usuário e senha e tente novamente."}
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="identifier">Usuário ou e-mail</label>
            <input
              id="identifier"
              name="identifier"
              autoComplete="username"
              defaultValue={params.login ?? ""}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="btn" type="submit">
            <LogIn size={18} /> Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
