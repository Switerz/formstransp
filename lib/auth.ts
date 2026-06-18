import "server-only";

import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "forms_transp_session";
const SESSION_DAYS = 14;

export type AppRole = "internal_admin" | "internal_viewer" | "carrier_admin" | "carrier_operator";

export function isInternalRole(role: string) {
  return role === "internal_admin" || role === "internal_viewer";
}

export function isInternalAdmin(role: string) {
  return role === "internal_admin";
}

export function isCarrierRole(role: string) {
  return role === "carrier_admin" || role === "carrier_operator";
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.appSession.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.appSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function destroyOtherSessions(userId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const currentTokenHash = token ? hashToken(token) : null;

  await prisma.appSession.deleteMany({
    where: {
      userId,
      ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
    },
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.appSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { transportadora: true } } },
  });

  if (!session || session.expiresAt <= new Date() || !session.user.ativo) {
    await destroyCurrentSession();
    return null;
  }

  return session.user;
}

export async function requireUser(next = "/") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (user.passwordMustChange && next !== "/alterar-senha") {
    redirect(`/alterar-senha?next=${encodeURIComponent(next)}`);
  }
  return user;
}

export async function requireInternalUser(next = "/") {
  const user = await requireUser(next);
  if (!isInternalRole(user.role)) redirect("/portal");
  return user;
}

export async function requireInternalAdmin(next = "/") {
  const user = await requireInternalUser(next);
  if (!isInternalAdmin(user.role)) redirect("/");
  return user;
}

export async function requireCarrierUser(next = "/portal") {
  const user = await requireUser(next);
  if (!isCarrierRole(user.role) || !user.transportadoraId) redirect("/");
  return user;
}

export async function requireTransportadoraAccess(transportadoraId: string, next = "/") {
  const user = await requireUser(next);
  if (isInternalRole(user.role)) return user;
  if (isCarrierRole(user.role) && user.transportadoraId === transportadoraId) return user;
  redirect("/portal");
}
