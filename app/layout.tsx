import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/auth-actions";
import { getCurrentUser, isInternalAdmin, isInternalRole } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Relatório Diário do Transportador",
  description: "MVP de diário de bordo operacional para transportadoras",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();
  const isInternal = currentUser ? isInternalRole(currentUser.role) : false;
  const canManage = currentUser ? isInternalAdmin(currentUser.role) : false;
  const mustChangePassword = Boolean(currentUser?.passwordMustChange);

  return (
    <html lang="pt-BR">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <strong>Relatório Transportador</strong>
            <nav className="nav">
              {currentUser ? (
                <>
                  {mustChangePassword ? (
                    <Link href="/alterar-senha">Alterar senha</Link>
                  ) : isInternal ? (
                    <>
                      <Link href="/">Admin</Link>
                      {canManage ? <Link href="/transportadoras/nova">Nova transportadora</Link> : null}
                      {canManage ? <Link href="/usuarios">Usuários</Link> : null}
                      <Link href="/automacoes/logs">Logs</Link>
                    </>
                  ) : (
                    <Link href="/portal">Portal</Link>
                  )}
                  <span className="nav-user">{currentUser.nome}</span>
                  <form action={logout}>
                    <button className="nav-button" type="submit">Sair</button>
                  </form>
                </>
              ) : (
                <Link href="/login">Entrar</Link>
              )}
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
