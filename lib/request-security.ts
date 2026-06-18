import "server-only";

import { headers } from "next/headers";

export async function assertSameOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  if (!origin) return;

  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const expected = host ? `${proto}://${host}` : null;

  if (!expected || origin !== expected) {
    throw new Error("Origem da requisição inválida.");
  }
}
