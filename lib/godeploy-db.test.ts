import { afterEach, describe, expect, it, vi } from "vitest";

describe("godeploy-db", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("envia autenticação M2M e busca usuário para login", async () => {
    vi.stubEnv("GODEPLOY_DB_URL", "https://forms-db.test/");
    vi.stubEnv("GODEPLOY_DB_API_KEY", "segredo-teste");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: "user-1",
            authUserId: null,
            username: "anjun",
            email: "anjun@formstransp.local",
            nome: "Operação Anjun",
            passwordHash: "scrypt$salt$hash",
            passwordMustChange: false,
            credentialSentAt: null,
            credentialSentBy: null,
            role: "carrier_admin",
            ativo: true,
            transportadoraId: "carrier-1",
            lastLoginAt: null,
            passwordUpdatedAt: null,
            createdAt: "2026-09-28T10:00:00.000Z",
            updatedAt: "2026-09-28T10:00:00.000Z",
            transportadora: {
              id: "carrier-1",
              nome: "Anjun",
              cnpj: null,
              codigoSlug: "anjun",
              ativo: true,
              origem: "real",
              tokenPublicoFormulario: "token",
              emailsDestinatarios: null,
              createdAt: "2026-09-28T10:00:00.000Z",
              updatedAt: "2026-09-28T10:00:00.000Z",
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const { findUserForLogin } = await import("./godeploy-db");
    const user = await findUserForLogin("anjun");

    expect(user?.id).toBe("user-1");
    expect(user?.transportadora?.nome).toBe("Anjun");
    expect(user?.createdAt).toBeInstanceOf(Date);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://forms-db.test/internal/auth/users/find-login",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer segredo-teste",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ identifier: "anjun" }),
      }),
    );
  });

  it("cria sessão enviando apenas o hash do token", async () => {
    vi.stubEnv("GODEPLOY_DB_URL", "https://forms-db.test");
    vi.stubEnv("GODEPLOY_DB_API_KEY", "segredo-teste");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const { createRemoteSession } = await import("./godeploy-db");

    await createRemoteSession({
      userId: "user-1",
      tokenHash: "hash-do-token",
      expiresAt: new Date("2026-10-12T10:00:00.000Z"),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://forms-db.test/internal/auth/sessions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          userId: "user-1",
          tokenHash: "hash-do-token",
          expiresAt: "2026-10-12T10:00:00.000Z",
        }),
      }),
    );
  });

  it("falha fechado quando o GoDeploy rejeita a requisição", async () => {
    vi.stubEnv("GODEPLOY_DB_URL", "https://forms-db.test");
    vi.stubEnv("GODEPLOY_DB_API_KEY", "segredo-teste");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Unauthorized", { status: 401 }),
      ),
    );

    const { findUserForLogin } = await import("./godeploy-db");

    await expect(
      findUserForLogin("anjun"),
    ).rejects.toThrow("GoDeploy DB 401");
  });
});
