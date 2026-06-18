import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { changeCurrentPassword } from "@/app/auth-actions";
import { getCurrentUser, isInternalRole } from "@/lib/auth";

const errorMessages: Record<string, string> = {
  current: "A senha atual não confere.",
  length: "A nova senha precisa ter pelo menos 10 caracteres.",
  match: "A confirmação precisa ser igual à nova senha.",
  same: "Escolha uma senha diferente da senha temporária.",
};

export default async function AlterarSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const [params, currentUser] = await Promise.all([searchParams, getCurrentUser()]);
  if (!currentUser) redirect("/login?next=/alterar-senha");

  const fallback = isInternalRole(currentUser.role) ? "/" : "/portal";
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : fallback;
  const errorMessage = params.error ? errorMessages[params.error] : null;

  return (
    <main className="auth-shell">
      <section className="auth-panel auth-panel-narrow">
        <div className="auth-copy">
          <div className="auth-mark">FormsTransp</div>
          <h1>Defina sua senha</h1>
          <p>
            Sua conta está usando uma senha temporária. Crie uma senha própria antes de acessar o portal.
          </p>
        </div>

        <form action={changeCurrentPassword} className="auth-form">
          <input type="hidden" name="next" value={next} />
          <div>
            <h2>Alterar senha</h2>
            <p className="muted">Use pelo menos 10 caracteres.</p>
          </div>

          {errorMessage ? (
            <div className="alert" role="alert">
              <strong>Não foi possível alterar.</strong> {errorMessage}
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="currentPassword">Senha atual</label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="newPassword">Nova senha</label>
            <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={10} required />
          </div>
          <div className="field">
            <label htmlFor="confirmPassword">Confirmar nova senha</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </div>
          <button className="btn" type="submit">
            <KeyRound size={18} /> Salvar nova senha
          </button>
        </form>
      </section>
    </main>
  );
}
