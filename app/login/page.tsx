import { redirect } from "next/navigation";
import { login } from "@/app/auth-actions";
import { getCurrentUser, isInternalRole } from "@/lib/auth";
import { LoginSubmitButton } from "@/components/LoginSubmitButton";
import "./bright-login.css";

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
    <main className="bright-login">
      <section className="bright-login__visual" aria-label="Black Friday Forms Transp">
        <div className="bright-login__brand">Forms <span>Transp</span></div>
        <div className="bright-login__hero">
          <span className="bright-login__badge">⚡ Black Friday 2026</span>
          <h1>A operação começou.<br /><span>Sua performance conta.</span></h1>
          <p>Atualize seus pedidos, acompanhe a operação e ajude sua transportadora a conquistar o topo do ranking durante a Black Friday.</p>
          <div className="bright-login__features">
            <div className="bright-login__feature"><strong>🏆 Ranking</strong><small>Acompanhe sua posição na competição.</small></div>
            <div className="bright-login__feature"><strong>🎯 Missões</strong><small>Cumpra metas e acumule pontos.</small></div>
            <div className="bright-login__feature"><strong>⚡ Performance</strong><small>SLA e operação refletidos na disputa.</small></div>
          </div>
        </div>
        <div className="bright-login__operation"><span aria-hidden="true" className="bright-login__dot" />Operação Black Friday ativa · Forms Transp</div>
      </section>

      <section className="bright-login__side">
        <div className="bright-login__wrap">
          <div className="bright-login__mobile-brand">Forms <span>Transp</span></div>
          <h2>Bem-vindo à operação 👋</h2>
          <p className="bright-login__subtitle">Entre com o acesso da sua transportadora para continuar.</p>
          <div className="bright-login__notice">
            <span aria-hidden="true">⚡</span>
            <div><strong>Black Friday Transportes</strong><p>Acesse o portal, mantenha sua base em dia e acompanhe sua pontuação.</p></div>
          </div>

          <form action={login} className="bright-login__form">
            <input type="hidden" name="next" value={next} />
            {(hasError || isRateLimited) && (
              <div className="bright-login__error" role="alert">
                <strong>Não foi possível entrar.</strong>{" "}
                {isRateLimited
                  ? "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente."
                  : "Confira usuário e senha e tente novamente."}
              </div>
            )}
            <div className="bright-login__field">
              <label htmlFor="identifier">Usuário</label>
              <input id="identifier" name="identifier" type="text" autoComplete="username" placeholder="Digite seu usuário" defaultValue={params.login ?? ""} autoFocus required />
            </div>
            <div className="bright-login__field">
              <label htmlFor="password">Senha</label>
              <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Digite sua senha" required />
            </div>
            <div className="bright-login__submit"><LoginSubmitButton /></div>
          </form>

          <div className="bright-login__callout"><span aria-hidden="true" className="bright-login__flag">🏁</span><div><strong>A disputa já está valendo</strong><small>Depois do login, confira o ranking e as missões da sua transportadora.</small></div></div>
          <div className="bright-login__divider" />
          <p className="bright-login__help">Problemas para acessar?<br /><strong>Entre em contato com o time de Transportes.</strong></p>
        </div>
      </section>
    </main>
  );
}
