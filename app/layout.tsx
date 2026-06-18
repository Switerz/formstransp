import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
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
            <Link className="brand-lockup" href={isInternal ? "/" : currentUser ? "/portal" : "/login"}>
              <span className="brand-mark" aria-hidden="true">RT</span>
              <span>
                <strong>Relatório Transportador</strong>
                <small>Controle operacional</small>
              </span>
            </Link>
            <nav className="nav">
              {currentUser ? (
                <>
                  {mustChangePassword ? (
                    <div className="nav-section">
                      <span className="nav-section-label">Acesso</span>
                      <Link href="/alterar-senha">Alterar senha</Link>
                    </div>
                  ) : isInternal ? (
                    <div className="nav-section">
                      <span className="nav-section-label">Operação</span>
                      <Link href="/">Admin</Link>
                      {canManage ? <Link href="/transportadoras/nova">Nova transportadora</Link> : null}
                      {canManage ? <Link href="/usuarios">Usuários</Link> : null}
                      <Link href="/automacoes/logs">Logs</Link>
                    </div>
                  ) : (
                    <div className="nav-section">
                      <span className="nav-section-label">Portal</span>
                      <Link href="/portal">Início</Link>
                    </div>
                  )}
                  <div className="nav-session">
                    <span className="nav-user">{currentUser.nome}</span>
                    <form action={logout}>
                      <button className="nav-button" type="submit">
                        <LogOut size={16} /> Sair
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="nav-session">
                  <Link href="/login">Entrar</Link>
                </div>
              )}
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
