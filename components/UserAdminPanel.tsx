"use client";

import { useActionState, useMemo, useState } from "react";
import { CheckCircle2, Clipboard, KeyRound, MoreHorizontal, Plus, Search, UserRound } from "lucide-react";
import { createAppUser, resetAppUserPassword, type UserActionState } from "@/app/user-actions";

type TransportadoraOption = {
  id: string;
  nome: string;
};

type UserRow = {
  id: string;
  nome: string;
  username: string | null;
  email: string;
  role: string;
  ativo: boolean;
  passwordMustChange: boolean;
  credentialSentAt: string | null;
  credentialSentBy: string | null;
  transportadoraNome: string | null;
  lastLoginAt: string | null;
  passwordUpdatedAt: string | null;
};

type UserAdminPanelProps = {
  users: UserRow[];
  transportadoras: TransportadoraOption[];
  currentUserId: string;
  setStatusAction: (formData: FormData) => void | Promise<void>;
  markCredentialSentAction: (formData: FormData) => void | Promise<void>;
};

const initialState: UserActionState = { ok: false, message: "" };

const roleLabels: Record<string, string> = {
  internal_admin: "Administrador interno",
  internal_viewer: "Leitor interno",
  carrier_admin: "Admin da transportadora",
  carrier_operator: "Operador da transportadora",
};

function copyText(value: string | null) {
  if (!value || typeof navigator === "undefined" || !navigator.clipboard) return;
  void navigator.clipboard.writeText(value);
}

function ActionMessage({ state }: { state: UserActionState }) {
  if (!state.message) return null;

  return (
    <div className={`alert ${state.ok ? "ok" : ""}`} role="status">
      <strong>{state.ok ? "Pronto." : "Atenção."}</strong> {state.message}
      {state.temporaryPassword ? (
        <div className="credential-box">
          <span>Senha temporária</span>
          <code>{state.temporaryPassword}</code>
        </div>
      ) : null}
    </div>
  );
}

function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, action] = useActionState(resetAppUserPassword, initialState);

  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="userId" value={userId} />
      <button className="btn secondary compact" type="submit">
        <KeyRound size={16} /> Resetar senha
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

export function UserAdminPanel({
  users,
  transportadoras,
  currentUserId,
  setStatusAction,
  markCredentialSentAction,
}: UserAdminPanelProps) {
  const [createState, createAction] = useActionState(createAppUser, initialState);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const pendingCredentialUsers = users.filter((user) => user.passwordMustChange && !user.credentialSentAt);
  const activeUsers = users.filter((user) => user.ativo).length;
  const carrierUsers = users.filter((user) => user.role.startsWith("carrier_")).length;
  const visibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return users.filter((user) => {
      const statusMatches =
        statusFilter === "todos" ||
        (statusFilter === "ativos" && user.ativo) ||
        (statusFilter === "inativos" && !user.ativo) ||
        (statusFilter === "credencial_pendente" && user.passwordMustChange && !user.credentialSentAt);
      const roleMatches = roleFilter === "todos" || user.role === roleFilter;
      const textMatches =
        !normalizedQuery ||
        [user.nome, user.username, user.email, user.transportadoraNome]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));

      return statusMatches && roleMatches && textMatches;
    });
  }, [query, roleFilter, statusFilter, users]);

  return (
    <div className="user-admin-layout">
      <form action={createAction} className="card grid">
        <div>
          <h2 className="section-title">Novo usuário</h2>
          <p className="muted">Crie uma conta interna ou vinculada a uma transportadora.</p>
        </div>
        <ActionMessage state={createState} />
        <div className="form-grid">
          <div className="field">
            <label htmlFor="nome">Nome</label>
            <input id="nome" name="nome" required />
          </div>
          <div className="field">
            <label htmlFor="username">Usuário</label>
            <input id="username" name="username" required />
          </div>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" required />
          </div>
          <div className="field">
            <label htmlFor="role">Perfil</label>
            <select id="role" name="role" defaultValue="carrier_operator">
              <option value="carrier_operator">Operador da transportadora</option>
              <option value="carrier_admin">Admin da transportadora</option>
              <option value="internal_viewer">Leitor interno</option>
              <option value="internal_admin">Administrador interno</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="transportadoraId">Transportadora</label>
            <select id="transportadoraId" name="transportadoraId" defaultValue="">
              <option value="">Sem vínculo</option>
              {transportadoras.map((transportadora) => (
                <option key={transportadora.id} value={transportadora.id}>
                  {transportadora.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="actions">
          <button className="btn" type="submit">
            <Plus size={16} /> Criar usuário
          </button>
        </div>
      </form>

      <section className="card credential-delivery-panel">
        <div className="panel-heading">
          <div>
            <h2 className="section-title">Entrega de credenciais</h2>
            <p className="muted">Contas com senha temporária que ainda precisam de confirmação de envio.</p>
          </div>
          <span className={`pill ${pendingCredentialUsers.length ? "pending" : "ok"}`}>
            {pendingCredentialUsers.length} pendentes
          </span>
        </div>
        {pendingCredentialUsers.length ? (
          <div className="credential-pending-list">
            {pendingCredentialUsers.map((user) => (
              <div className="credential-pending-row" key={user.id}>
                <div>
                  <strong>{user.nome}</strong>
                  <span>
                    {user.username ?? user.email} · {user.transportadoraNome ?? "Sem transportadora"}
                  </span>
                </div>
                <div className="actions">
                  <button className="btn secondary compact" type="button" onClick={() => copyText(user.username ?? user.email)}>
                    <Clipboard size={16} /> Copiar usuário
                  </button>
                  <form action={markCredentialSentAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button className="btn secondary compact" type="submit">
                      <CheckCircle2 size={16} /> Marcar enviada
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="status-ok">
            <CheckCircle2 size={20} />
            <span>Todas as credenciais temporárias criadas/resetadas já foram marcadas como enviadas.</span>
          </div>
        )}
      </section>

      <section className="card">
        <div className="panel-heading">
          <div>
            <h2 className="section-title">Usuários cadastrados</h2>
            <p className="muted">Gerencie acesso, vínculo com transportadora e senhas temporárias.</p>
          </div>
          <span className="pill">{users.length} contas</span>
        </div>

        <div className="user-admin-summary" aria-label="Resumo de usuários">
          <span><strong>{activeUsers}</strong> ativos</span>
          <span><strong>{carrierUsers}</strong> transportadora</span>
          <span><strong>{pendingCredentialUsers.length}</strong> credenciais pendentes</span>
        </div>

        <div className="user-toolbar">
          <label className="user-search">
            <Search size={16} />
            <span className="sr-only">Buscar usuário</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar nome, usuário, e-mail ou transportadora"
            />
          </label>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filtrar perfil">
            <option value="todos">Todos os perfis</option>
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar status">
            <option value="todos">Todos os status</option>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
            <option value="credencial_pendente">Credencial pendente</option>
          </select>
          <span className="pill">{visibleUsers.length} visíveis</span>
        </div>

        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table>
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Perfil</th>
                <th>Transportadora</th>
                <th>Status</th>
                <th>Senha</th>
                <th>Credencial</th>
                <th>Último acesso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="user-cell">
                      <UserRound size={18} />
                      <div>
                        <strong>{user.nome}</strong>
                        <div className="muted">{user.username ?? user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{roleLabels[user.role] ?? user.role}</td>
                  <td>{user.transportadoraNome ?? "-"}</td>
                  <td>
                    <span className={`pill ${user.ativo ? "ok" : "pending"}`}>{user.ativo ? "Ativo" : "Inativo"}</span>
                  </td>
                  <td>
                    <span className={`pill ${user.passwordMustChange ? "pending" : "ok"}`}>
                      {user.passwordMustChange ? "Troca obrigatória" : "Atualizada"}
                    </span>
                  </td>
                  <td>
                    <div className="credential-status">
                      <span className={`pill ${user.credentialSentAt ? "ok" : "pending"}`}>
                        {user.credentialSentAt ? "Enviada" : "Pendente"}
                      </span>
                      {user.credentialSentAt ? (
                        <span className="muted">
                          {user.credentialSentAt}
                          {user.credentialSentBy ? ` · ${user.credentialSentBy}` : ""}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>{user.lastLoginAt ?? "-"}</td>
                  <td>
                    {user.id === currentUserId ? (
                      <span className="pill">Conta atual</span>
                    ) : (
                      <details className="row-action-menu">
                        <summary>
                          <MoreHorizontal size={16} />
                          <span>Ações</span>
                        </summary>
                        <div className="row-action-panel">
                        <button className="btn secondary compact" type="button" onClick={() => copyText(user.username ?? user.email)}>
                          <Clipboard size={16} /> Copiar usuário
                        </button>
                        <ResetPasswordForm userId={user.id} />
                        <form action={markCredentialSentAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <button className="btn secondary compact" type="submit">
                            <Clipboard size={16} /> Credencial enviada
                          </button>
                        </form>
                        <form action={setStatusAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="ativo" value={String(!user.ativo)} />
                          <button className="btn secondary compact" type="submit">
                            {user.ativo ? "Inativar" : "Ativar"}
                          </button>
                        </form>
                        </div>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
              {!visibleUsers.length ? (
                <tr>
                  <td colSpan={8}>
                    <div className="status-ok neutral">
                      <CheckCircle2 size={20} />
                      <span>Nenhum usuário encontrado com os filtros atuais.</span>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
