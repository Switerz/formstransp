import "server-only";

const BASE_URL = process.env.GODEPLOY_DB_URL?.replace(/\/+$/, "");
const API_KEY = process.env.GODEPLOY_DB_API_KEY;

export type GoDeployTransportadora = {
  id: string;
  nome: string;
  cnpj: string | null;
  codigoSlug: string;
  ativo: boolean;
  origem: string;
  tokenPublicoFormulario: string;
  emailsDestinatarios: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GoDeployAppUser = {
  id: string;
  authUserId: string | null;
  username: string | null;
  email: string;
  nome: string;
  passwordHash: string | null;
  passwordMustChange: boolean;
  credentialSentAt: Date | null;
  credentialSentBy: string | null;
  role: string;
  ativo: boolean;
  transportadoraId: string | null;
  lastLoginAt: Date | null;
  passwordUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  transportadora: GoDeployTransportadora | null;
};

type JsonRecord = Record<string, unknown>;

function requireConfig() {
  if (!BASE_URL) {
    throw new Error("GODEPLOY_DB_URL não configurada.");
  }

  if (!API_KEY) {
    throw new Error("GODEPLOY_DB_API_KEY não configurada.");
  }

  return { baseUrl: BASE_URL, apiKey: API_KEY };
}

function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const original = String(value).trim();

  // Normaliza timestamps migrados do PostgreSQL.
  let normalized = original.replace(
    /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)([+-]\d{2})$/,
    "$1T$2$3:00",
  );

  normalized = normalized.replace(
    /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)([+-]\d{2}:\d{2})$/,
    "$1T$2$3",
  );

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    console.warn("[godeploy-db] Data invalida ignorada.");
    return null;
  }

  return date;
}

function parseTransportadora(
  value: unknown,
): GoDeployTransportadora | null {
  if (!value || typeof value !== "object") return null;

  const row = value as JsonRecord;

  return {
    id: String(row.id),
    nome: String(row.nome),
    cnpj: row.cnpj == null ? null : String(row.cnpj),
    codigoSlug: String(row.codigoSlug),
    ativo: Boolean(row.ativo),
    origem: String(row.origem ?? "real"),
    tokenPublicoFormulario: String(row.tokenPublicoFormulario ?? ""),
    emailsDestinatarios:
      row.emailsDestinatarios == null
        ? null
        : String(row.emailsDestinatarios),
    createdAt: parseDate(row.createdAt) ?? new Date(0),
    updatedAt: parseDate(row.updatedAt) ?? new Date(0),
  };
}

function parseUser(value: unknown): GoDeployAppUser {
  if (!value || typeof value !== "object") {
    throw new Error("Usuário inválido recebido do GoDeploy.");
  }

  const row = value as JsonRecord;

  return {
    id: String(row.id),
    authUserId:
      row.authUserId == null ? null : String(row.authUserId),
    username:
      row.username == null ? null : String(row.username),
    email: String(row.email),
    nome: String(row.nome),
    passwordHash:
      row.passwordHash == null ? null : String(row.passwordHash),
    passwordMustChange: Boolean(row.passwordMustChange),
    credentialSentAt: parseDate(row.credentialSentAt),
    credentialSentBy:
      row.credentialSentBy == null
        ? null
        : String(row.credentialSentBy),
    role: String(row.role),
    ativo: Boolean(row.ativo),
    transportadoraId:
      row.transportadoraId == null
        ? null
        : String(row.transportadoraId),
    lastLoginAt: parseDate(row.lastLoginAt),
    passwordUpdatedAt: parseDate(row.passwordUpdatedAt),
    createdAt: parseDate(row.createdAt) ?? new Date(0),
    updatedAt: parseDate(row.updatedAt) ?? new Date(0),
    transportadora: parseTransportadora(row.transportadora),
  };
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { baseUrl, apiKey } = requireConfig();

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    throw new Error(
      `GoDeploy DB ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function findUserForLogin(identifier: string) {
  const result = await request<{ user: unknown | null }>(
    "/internal/auth/users/find-login",
    {
      method: "POST",
      body: JSON.stringify({ identifier }),
    },
  );

  return result.user ? parseUser(result.user) : null;
}

export async function createRemoteSession(input: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  await request("/internal/auth/sessions", {
    method: "POST",
    body: JSON.stringify({
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt.toISOString(),
    }),
  });
}

export async function getRemoteSession(tokenHash: string) {
  const result = await request<{
    session: null | {
      id: string;
      userId: string;
      tokenHash: string;
      expiresAt: string;
      createdAt: string;
      user: unknown;
    };
  }>(
    `/internal/auth/session/${encodeURIComponent(tokenHash)}`,
  );

  if (!result.session) return null;

  return {
    ...result.session,
    expiresAt: new Date(result.session.expiresAt),
    createdAt: new Date(result.session.createdAt),
    user: parseUser(result.session.user),
  };
}

export async function deleteRemoteSession(tokenHash: string) {
  await request("/internal/auth/sessions/delete", {
    method: "POST",
    body: JSON.stringify({ tokenHash }),
  });
}

export async function deleteOtherRemoteSessions(
  userId: string,
  currentTokenHash: string | null,
) {
  await request("/internal/auth/sessions/delete-other", {
    method: "POST",
    body: JSON.stringify({ userId, currentTokenHash }),
  });
}

export async function deleteExpiredRemoteSessions(userId: string) {
  await request("/internal/auth/sessions/delete-expired", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function registerLoginSuccess(userId: string) {
  await request("/internal/auth/users/login-success", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function updateRemotePassword(input: {
  userId: string;
  passwordHash: string;
}) {
  await request("/internal/auth/users/change-password", {
    method: "POST",
    body: JSON.stringify({
      userId: input.userId,
      passwordHash: input.passwordHash,
      passwordMustChange: false,
      passwordUpdatedAt: new Date().toISOString(),
    }),
  });
}

export async function listRemoteTransportadoras() {
  const result = await request<{ transportadoras: unknown[] }>(
    "/internal/transportadoras",
  );

  return result.transportadoras
    .map((item) => parseTransportadora(item))
    .filter(
      (item): item is GoDeployTransportadora => item !== null,
    );
}

