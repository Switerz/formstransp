import Link from "next/link";
import { UserAdminPanel } from "@/components/UserAdminPanel";
import { markCredentialSent, setAppUserStatus } from "@/app/user-actions";
import { requireInternalAdmin } from "@/lib/auth";
import { formatBrazilianDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export default async function UsuariosPage() {
  const currentUser = await requireInternalAdmin("/usuarios");

  const [users, transportadoras] = await Promise.all([
    prisma.appUser.findMany({
      include: { transportadora: true },
      orderBy: [{ role: "asc" }, { nome: "asc" }],
    }),
    prisma.transportadora.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  return (
    <main className="shell">
      <div className="page-title">
        <div>
          <h1>Usuários e acessos</h1>
          <p className="muted">Crie contas, redefina senhas e controle o vínculo de cada usuário.</p>
        </div>
        <Link className="btn secondary" href="/">
          Voltar ao admin
        </Link>
      </div>

      <UserAdminPanel
        users={users.map((user) => ({
          id: user.id,
          nome: user.nome,
          username: user.username,
          email: user.email,
          role: user.role,
          ativo: user.ativo,
          passwordMustChange: user.passwordMustChange,
          credentialSentAt: user.credentialSentAt ? formatBrazilianDate(user.credentialSentAt) : null,
          credentialSentBy: user.credentialSentBy,
          transportadoraNome: user.transportadora?.nome ?? null,
          lastLoginAt: user.lastLoginAt ? formatBrazilianDate(user.lastLoginAt) : null,
          passwordUpdatedAt: user.passwordUpdatedAt ? formatBrazilianDate(user.passwordUpdatedAt) : null,
        }))}
        transportadoras={transportadoras}
        currentUserId={currentUser.id}
        setStatusAction={setAppUserStatus}
        markCredentialSentAction={markCredentialSent}
      />
    </main>
  );
}
