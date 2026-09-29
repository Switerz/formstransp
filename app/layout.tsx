import { medirEtapa } from "@/lib/diagnostico-tempo";
import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/app/auth-actions";
import { getCurrentUser, isInternalAdmin, isInternalRole } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forms Transp",
  description: "MVP de diÃ¡rio de bordo operacional para transportadoras",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let currentUser: Awaited<ReturnType<typeof getCurrentUser>> = null;
  let erroAutenticacao: string | null = null;

  try {
    currentUser = await medirEtapa(
      "layout:usuario",
      () => getCurrentUser(),
    );
  } catch (error) {
    console.error("[diagnostico-layout] getCurrentUser falhou", error);

    erroAutenticacao =
      error instanceof Error
        ? error.message
        : "Erro desconhecido";
  }

  const isInternal = currentUser ? isInternalRole(currentUser.role) : false;
  const canManage = currentUser ? isInternalAdmin(currentUser.role) : false;
  const mustChangePassword = Boolean(currentUser?.passwordMustChange);

  if (erroAutenticacao) {
    return (
      <html lang="pt-BR">
        <body>
          <main className="shell">
            <section className="card" style={{ marginTop: 24 }}>
              <h1>Diagnostico temporario</h1>
              <p><strong>Etapa:</strong> layout:getCurrentUser</p>
              <p><strong>Erro:</strong> {erroAutenticacao}</p>
            </section>
          </main>
        </body>
      </html>
    );
  }

  return (
    <html lang="pt-BR">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link className="brand-lockup" href={isInternal ? "/" : currentUser ? "/portal" : "/login"}>
              <span className="brand-mark" aria-hidden="true">FT</span>
              <span>
                <strong>Forms Transp</strong>
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
                      <span className="nav-section-label">OperaÃ§Ã£o</span>
                      <Link href="/">Admin</Link>
                      <Link href="/base-completa">Base Completa</Link>
                      {canManage ? <Link href="/transportadoras/nova">Nova transportadora</Link> : null}
                      {canManage ? <Link href="/usuarios">UsuÃ¡rios</Link> : null}
                      {canManage ? <Link href="/automacoes/logs">Logs</Link> : null}
                    </div>
                  ) : (
                    <div className="nav-section">
                      <span className="nav-section-label">Portal</span>
                      
                      <Link href="/portal/minha-base">Minha Base</Link>
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
              ) : null}
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

